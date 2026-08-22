from __future__ import annotations

import copy
import hmac
import math
import secrets
from datetime import timedelta
from typing import Any

from .errors import IntegrityError, ValidationError
from .utils import (
    ensure_slug,
    format_utc_timestamp,
    parse_utc_timestamp,
    sha256_bytes,
    sha256_json,
    utc_now,
)

TASK_SCHEMA_VERSION = "axm.challenge-seat-task/0.4"
TASK_PLAN_SCHEMA_VERSION = "axm.challenge-seat-task-plan/0.4"
TASK_RECEIPT_SCHEMA_VERSION = "axm.challenge-seat-task-receipt/0.5"
ORCHESTRATION_REPORT_SCHEMA_VERSION = "axm.challenge-orchestration-report/0.4"

TASK_PHASES = {"BUILD", "REVIEW"}
TASK_STATUSES = {"READY", "LEASED", "COMPLETED", "DEAD_LETTER", "CANCELLED"}
FAILURE_CLASSES = {
    "INFRASTRUCTURE",
    "MODEL_UNAVAILABLE",
    "TIMEOUT",
    "INVALID_OUTPUT",
    "POLICY_REFUSAL",
    "OPERATOR_CANCELLED",
    "UNKNOWN",
}

_TASK_CORE_FIELDS = (
    "schema_version",
    "task_id",
    "challenge_id",
    "phase",
    "participant_id",
    "required",
    "packet_hash",
    "rubric_hash",
    "participant_roster_hash",
    "assignment_hash",
    "assigned_candidate_labels",
    "budget",
    "lease_policy",
    "authority_boundary",
)


def new_lease_token() -> str:
    """Return a high-entropy bearer token safe as a positional CLI argument.

    ``token_urlsafe`` can legally begin with ``-``.  A bare leading dash is
    interpreted by command-line parsers as an option, so every Arena-generated
    lease token carries a fixed alphanumeric prefix.  Only the contextual hash
    is persisted.
    """

    return "lease_" + secrets.token_urlsafe(32)


def new_lease_id(task_id: str) -> str:
    return ensure_slug(f"lease-{sha256_bytes((task_id + chr(0) + secrets.token_hex(16)).encode())[:24]}", "lease_id")


def lease_token_hash(task_id: str, token: str) -> str:
    if not isinstance(token, str) or not token:
        raise ValidationError("A non-empty task lease token is required.")
    return sha256_bytes(f"{task_id}\0{token}".encode("utf-8"))


def _task_id(phase: str, participant_id: str) -> str:
    readable = f"{phase.lower()}-{participant_id}"
    if len(readable) <= 128:
        return ensure_slug(readable, "task_id")
    digest = sha256_bytes(f"{phase}\0{participant_id}".encode("utf-8"))[:32]
    return ensure_slug(f"task-{phase.lower()[0]}-{digest}", "task_id")


def _policy(state: dict[str, Any]) -> dict[str, Any]:
    policy = state.get("packet", {}).get("orchestration_policy", {})
    return policy if isinstance(policy, dict) else {}


def _phase_budget(state: dict[str, Any], phase: str) -> dict[str, Any]:
    key = "build_budget" if phase == "BUILD" else "review_budget"
    value = _policy(state).get(key, {})
    return copy.deepcopy(value if isinstance(value, dict) else {})


def _lease_policy(state: dict[str, Any]) -> dict[str, Any]:
    policy = _policy(state)
    return {
        "leases_required": bool(policy.get("task_leases_required", False)),
        "allow_delegate_workers": bool(policy.get("allow_delegate_workers", False)),
        "lease_seconds": int(policy.get("lease_seconds", 900)),
        "lease_extension_seconds": int(policy.get("lease_extension_seconds", 900)),
        "max_total_lease_seconds": int(policy.get("max_total_lease_seconds", 7200)),
        "max_heartbeat_count": int(policy.get("max_heartbeat_count", 32)),
        "max_attempts": int(policy.get("max_attempts", 3)),
    }

def _task_core(
    state: dict[str, Any],
    phase: str,
    participant_id: str,
    *,
    assigned_candidate_labels: list[str] | None = None,
) -> dict[str, Any]:
    if phase not in TASK_PHASES:
        raise ValidationError(f"Unknown seat-task phase: {phase!r}")
    participant = state.get("participants", {}).get(participant_id)
    if not isinstance(participant, dict):
        raise ValidationError(f"Unknown participant for seat task: {participant_id!r}")
    labels = sorted(set(str(item) for item in (assigned_candidate_labels or [])))
    required = bool(
        participant.get("can_submit", True)
        if phase == "BUILD"
        else participant.get("can_review", True)
        and participant.get("review_required", True)
        and labels
    )
    return {
        "schema_version": TASK_SCHEMA_VERSION,
        "task_id": _task_id(phase, participant_id),
        "challenge_id": str(state.get("challenge_id")),
        "phase": phase,
        "participant_id": participant_id,
        "required": required,
        "packet_hash": state.get("packet_hash"),
        "rubric_hash": state.get("rubric_hash"),
        # Build tasks are bound to the roster present at the original challenge
        # lock.  When a challenge explicitly permits late registration, the
        # phase plan changes and receives a new plan hash, but already-issued
        # task cores remain immutable instead of being silently rewritten.
        "participant_roster_hash": (
            state.get("locked_participant_roster_hash")
            if phase == "BUILD"
            else state.get("participant_roster_hash")
        ),
        "assignment_hash": (
            state.get("review_assignment_report", {}).get("assignment_hash")
            if phase == "REVIEW"
            else None
        ),
        "assigned_candidate_labels": labels,
        "budget": _phase_budget(state, phase),
        "lease_policy": _lease_policy(state),
        "authority_boundary": (
            "The task coordinates availability, budget evidence, and retries only. "
            "Task completion is not candidate approval, a score, a merge, or canon."
        ),
    }


def task_core(task: dict[str, Any]) -> dict[str, Any]:
    return {key: copy.deepcopy(task.get(key)) for key in _TASK_CORE_FIELDS}


def task_plan_hash(tasks: list[dict[str, Any]]) -> str:
    cores = [task_core(task) for task in sorted(tasks, key=lambda item: str(item.get("task_id")))]
    return sha256_json(cores)


def _new_task(core: dict[str, Any], now: str) -> dict[str, Any]:
    return {
        **copy.deepcopy(core),
        "task_core_hash": sha256_json(core),
        "status": "READY",
        "created_at": now,
        "updated_at": now,
        "active_lease": None,
        "attempts": [],
        "completion_history": [],
        "completed_output": None,
        "final_failure": None,
        "cancelled": None,
    }


def ensure_phase_tasks(state: dict[str, Any], phase: str, *, now: str | None = None) -> dict[str, Any]:
    """Create missing immutable task cores and refresh the phase plan evidence."""

    if phase not in TASK_PHASES:
        raise ValidationError(f"Unknown seat-task phase: {phase!r}")
    now = now or utc_now()
    tasks = state.setdefault("seat_tasks", {})
    index = state.setdefault("seat_task_index", {})
    plans = state.setdefault("seat_task_plans", {})
    if not isinstance(tasks, dict) or not isinstance(index, dict) or not isinstance(plans, dict):
        raise IntegrityError("Stored seat-task containers are malformed.")

    expected: list[tuple[str, list[str]]] = []
    if phase == "BUILD":
        expected = [
            (participant_id, [])
            for participant_id, participant in sorted(state.get("participants", {}).items())
            if participant.get("can_submit", True)
        ]
    else:
        assignments = state.get("review_assignments", {})
        expected = [
            (participant_id, sorted(str(item) for item in assignments.get(participant_id, [])))
            for participant_id, participant in sorted(state.get("participants", {}).items())
            if participant.get("can_review", True) and assignments.get(participant_id)
        ]

    phase_tasks: list[dict[str, Any]] = []
    for participant_id, labels in expected:
        core = _task_core(
            state,
            phase,
            participant_id,
            assigned_candidate_labels=labels,
        )
        task_id = str(core["task_id"])
        key = f"{phase}:{participant_id}"
        existing_id = index.get(key)
        if existing_id is not None and existing_id != task_id:
            raise IntegrityError(f"Seat-task index drift for {key}: {existing_id!r} != {task_id!r}")
        existing = tasks.get(task_id)
        if existing is None:
            existing = _new_task(core, now)
            tasks[task_id] = existing
            index[key] = task_id
        elif task_core(existing) != core or existing.get("task_core_hash") != sha256_json(core):
            raise IntegrityError(
                f"Immutable seat-task core changed for {task_id}; create a new challenge or task instead."
            )
        phase_tasks.append(existing)

    plan_core = {
        "schema_version": TASK_PLAN_SCHEMA_VERSION,
        "challenge_id": state.get("challenge_id"),
        "phase": phase,
        "packet_hash": state.get("packet_hash"),
        "rubric_hash": state.get("rubric_hash"),
        "participant_roster_hash": state.get("participant_roster_hash"),
        "assignment_hash": (
            state.get("review_assignment_report", {}).get("assignment_hash")
            if phase == "REVIEW"
            else None
        ),
        "task_ids": sorted(str(task["task_id"]) for task in phase_tasks),
        "task_core_hashes": {
            str(task["task_id"]): str(task["task_core_hash"])
            for task in sorted(phase_tasks, key=lambda item: str(item["task_id"]))
        },
        "budget_hashes": {
            str(task["task_id"]): sha256_json(task.get("budget", {}))
            for task in sorted(phase_tasks, key=lambda item: str(item["task_id"]))
        },
        "task_count": len(phase_tasks),
        "required_task_count": sum(1 for task in phase_tasks if task.get("required")),
        "authority_boundary": "A task plan is operational evidence, never an automatic score or acceptance decision.",
    }
    plan = {**plan_core, "task_plan_hash": sha256_json(plan_core)}
    plans[phase] = plan
    return copy.deepcopy(plan)


def task_for(state: dict[str, Any], phase: str, participant_id: str) -> dict[str, Any] | None:
    task_id = state.get("seat_task_index", {}).get(f"{phase}:{participant_id}")
    task = state.get("seat_tasks", {}).get(task_id) if task_id else None
    return task if isinstance(task, dict) else None


def _nonnegative_int(value: Any, field: str) -> int:
    if isinstance(value, bool):
        raise ValidationError(f"{field} must be an integer, not true/false.")
    if isinstance(value, int):
        parsed = value
    elif isinstance(value, float):
        if not math.isfinite(value) or not value.is_integer():
            raise ValidationError(f"{field} must be a whole finite number.")
        parsed = int(value)
    elif isinstance(value, str) and value.strip().isdigit():
        parsed = int(value.strip())
    else:
        raise ValidationError(f"{field} must be a non-negative integer.")
    if parsed < 0:
        raise ValidationError(f"{field} must be non-negative.")
    return parsed


def normalize_task_usage(value: dict[str, Any] | None) -> dict[str, Any]:
    value = value or {}
    if not isinstance(value, dict):
        raise ValidationError("Task usage must be an object.")
    wall_raw = value.get("wall_seconds")
    wall_seconds: float | None = None
    if wall_raw is not None:
        if isinstance(wall_raw, bool):
            raise ValidationError("task usage.wall_seconds must not be true/false.")
        try:
            wall_seconds = float(wall_raw)
        except (TypeError, ValueError) as exc:
            raise ValidationError("task usage.wall_seconds must be numeric.") from exc
        if not math.isfinite(wall_seconds) or wall_seconds < 0:
            raise ValidationError("task usage.wall_seconds must be finite and non-negative.")
        wall_seconds = round(wall_seconds, 6)

    measurement_source = (
        str(value.get("measurement_source", "self_reported")).strip()
        or "self_reported"
    )
    if len(measurement_source.encode("utf-8")) > 256:
        raise ValidationError(
            "task usage.measurement_source may not exceed 256 UTF-8 bytes."
        )
    result: dict[str, Any] = {
        "wall_seconds": wall_seconds,
        "input_bytes": None,
        "output_bytes": None,
        "token_units": None,
        "tool_calls": None,
        "measurement_source": measurement_source,
        "notes": str(value.get("notes", "")),
    }
    for field in ("input_bytes", "output_bytes", "token_units", "tool_calls"):
        if value.get(field) is not None:
            result[field] = _nonnegative_int(value[field], f"task usage.{field}")
    if len(result["notes"].encode("utf-8")) > 4096:
        raise ValidationError("task usage.notes may not exceed 4096 UTF-8 bytes.")
    return result


def evaluate_budget(task: dict[str, Any], usage: dict[str, Any]) -> dict[str, Any]:
    budget = task.get("budget", {}) if isinstance(task.get("budget"), dict) else {}
    mapping = {
        "wall_seconds": "max_wall_seconds",
        "input_bytes": "max_input_bytes",
        "output_bytes": "max_output_bytes",
        "token_units": "max_token_units",
        "tool_calls": "max_tool_calls",
    }
    signals: list[dict[str, Any]] = []
    checked: dict[str, Any] = {}
    for usage_field, budget_field in mapping.items():
        actual = usage.get(usage_field)
        limit = budget.get(budget_field)
        checked[usage_field] = {"actual": actual, "limit": limit}
        if actual is not None and limit is not None and actual > limit:
            signals.append(
                {
                    "code": f"{usage_field.upper()}_OVER_LOCKED_BUDGET",
                    "actual": actual,
                    "limit": limit,
                }
            )
    return {
        "within_locked_budget": not signals,
        "signals": signals,
        "checked": checked,
        "automatic_score_effect": False,
        "authority_note": "Budget signals are operational evidence only unless a locked rubric check explicitly evaluates them.",
    }


def _attempt(task: dict[str, Any], attempt_number: int) -> dict[str, Any]:
    attempts = task.get("attempts", [])
    if not isinstance(attempts, list):
        raise IntegrityError(f"Seat task {task.get('task_id')} attempts are malformed.")
    for attempt in attempts:
        if attempt.get("attempt_number") == attempt_number:
            return attempt
    raise IntegrityError(
        f"Seat task {task.get('task_id')} is missing attempt {attempt_number}."
    )


def _reap_one(task: dict[str, Any], now: str) -> bool:
    lease = task.get("active_lease")
    if task.get("status") != "LEASED" or not isinstance(lease, dict):
        return False
    if parse_utc_timestamp(now) <= parse_utc_timestamp(str(lease.get("expires_at"))):
        return False
    attempt = _attempt(task, int(lease["attempt_number"]))
    attempt.update(
        {
            "status": "EXPIRED",
            "finished_at": now,
            "failure": {
                "class": "TIMEOUT",
                "detail": "Lease expired before task completion or an explicit failure receipt.",
                "retryable": True,
            },
        }
    )
    max_attempts = int(task.get("lease_policy", {}).get("max_attempts", 3))
    task["active_lease"] = None
    task["updated_at"] = now
    if len(task.get("attempts", [])) >= max_attempts:
        task["status"] = "DEAD_LETTER"
        task["final_failure"] = copy.deepcopy(attempt["failure"])
    else:
        task["status"] = "READY"
    return True


def claim_task(
    task: dict[str, Any],
    *,
    worker_id: str,
    token: str,
    lease_id: str,
    now: str | None = None,
    lease_seconds: int | None = None,
) -> dict[str, Any]:
    now = now or utc_now()
    _reap_one(task, now)
    if task.get("status") != "READY":
        raise ValidationError(
            f"Seat task {task.get('task_id')} is {task.get('status')}, not READY."
        )
    try:
        worker_id = ensure_slug(worker_id, "worker_id")
        lease_id = ensure_slug(lease_id, "lease_id")
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc
    policy = task.get("lease_policy", {})
    if not policy.get("allow_delegate_workers", False) and worker_id != task.get("participant_id"):
        raise ValidationError(
            f"Task {task.get('task_id')} is assigned to {task.get('participant_id')!r}; delegate workers are not enabled."
        )
    max_attempts = int(policy.get("max_attempts", 3))
    attempt_number = len(task.get("attempts", [])) + 1
    if attempt_number > max_attempts:
        task["status"] = "DEAD_LETTER"
        task["updated_at"] = now
        raise ValidationError(
            f"Seat task {task.get('task_id')} exhausted its {max_attempts} attempts."
        )
    requested_raw = (
        policy.get("lease_seconds", 900)
        if lease_seconds is None
        else lease_seconds
    )
    requested = _nonnegative_int(requested_raw, "lease_seconds")
    if requested < 1:
        raise ValidationError("lease_seconds must be positive.")
    max_total = int(policy.get("max_total_lease_seconds", 7200))
    requested = min(requested, max_total)
    claimed = parse_utc_timestamp(now)
    expires = claimed + timedelta(seconds=requested)
    max_expires = claimed + timedelta(seconds=max_total)
    token_digest = lease_token_hash(str(task.get("task_id")), token)
    lease = {
        "lease_id": lease_id,
        "attempt_number": attempt_number,
        "worker_id": worker_id,
        "claimed_at": now,
        "expires_at": format_utc_timestamp(expires),
        "max_expires_at": format_utc_timestamp(max_expires),
        "heartbeat_count": 0,
        "lease_token_hash": token_digest,
    }
    task.setdefault("attempts", []).append(
        {
            "attempt_number": attempt_number,
            "lease_id": lease_id,
            "worker_id": worker_id,
            "status": "ACTIVE",
            "claimed_at": now,
            "finished_at": None,
            "failure": None,
            "completion": None,
        }
    )
    task["active_lease"] = lease
    task["status"] = "LEASED"
    task["updated_at"] = now
    task["final_failure"] = None
    return copy.deepcopy(lease)


def _verified_active_lease(task: dict[str, Any], token: str, now: str) -> dict[str, Any]:
    lease = task.get("active_lease")
    if task.get("status") != "LEASED" or not isinstance(lease, dict):
        raise ValidationError(f"Seat task {task.get('task_id')} has no active lease.")
    expected = str(lease.get("lease_token_hash", ""))
    supplied = lease_token_hash(str(task.get("task_id")), token)
    if not hmac.compare_digest(expected, supplied):
        raise ValidationError("Seat-task lease token does not match the active lease.")
    if parse_utc_timestamp(now) > parse_utc_timestamp(str(lease.get("expires_at"))):
        raise ValidationError("Seat-task lease has expired; reap and reclaim it before continuing.")
    return lease


def heartbeat_task(
    task: dict[str, Any],
    *,
    token: str,
    now: str | None = None,
    extension_seconds: int | None = None,
) -> dict[str, Any]:
    now = now or utc_now()
    lease = _verified_active_lease(task, token, now)
    policy = task.get("lease_policy", {})
    count = int(lease.get("heartbeat_count", 0))
    maximum = int(policy.get("max_heartbeat_count", 32))
    if count >= maximum:
        raise ValidationError(
            f"Seat task {task.get('task_id')} reached its {maximum}-heartbeat limit."
        )
    extension_raw = (
        policy.get("lease_extension_seconds", 900)
        if extension_seconds is None
        else extension_seconds
    )
    extension = _nonnegative_int(extension_raw, "extension_seconds")
    if extension < 1:
        raise ValidationError("extension_seconds must be positive.")
    current_expiry = parse_utc_timestamp(str(lease["expires_at"]))
    cap = parse_utc_timestamp(str(lease["max_expires_at"]))
    base = max(parse_utc_timestamp(now), current_expiry)
    updated = min(base + timedelta(seconds=extension), cap)
    if updated <= current_expiry:
        raise ValidationError("Seat-task lease is already at its maximum allowed expiry.")
    lease["expires_at"] = format_utc_timestamp(updated)
    lease["heartbeat_count"] = count + 1
    lease["last_heartbeat_at"] = now
    task["updated_at"] = now
    return copy.deepcopy(lease)


def fail_task(
    task: dict[str, Any],
    *,
    token: str,
    failure_class: str,
    detail: str,
    retryable: bool,
    now: str | None = None,
) -> dict[str, Any]:
    now = now or utc_now()
    lease = _verified_active_lease(task, token, now)
    failure_class = str(failure_class).upper()
    if failure_class not in FAILURE_CLASSES:
        raise ValidationError(
            f"Unknown task failure class {failure_class!r}; allowed: {sorted(FAILURE_CLASSES)}"
        )
    if not isinstance(retryable, bool):
        raise ValidationError("task failure retryable must be true or false.")
    detail_text = str(detail)
    if len(detail_text.encode("utf-8")) > 16 * 1024:
        raise ValidationError("task failure detail may not exceed 16384 UTF-8 bytes.")
    failure = {
        "class": failure_class,
        "detail": detail_text,
        "retryable": retryable,
    }
    attempt = _attempt(task, int(lease["attempt_number"]))
    attempt.update({"status": "FAILED", "finished_at": now, "failure": failure})
    task["active_lease"] = None
    task["updated_at"] = now
    max_attempts = int(task.get("lease_policy", {}).get("max_attempts", 3))
    if retryable and len(task.get("attempts", [])) < max_attempts:
        task["status"] = "READY"
        task["final_failure"] = None
    else:
        task["status"] = "DEAD_LETTER"
        task["final_failure"] = copy.deepcopy(failure)
    return {
        "task_id": task.get("task_id"),
        "status": task.get("status"),
        "attempt_number": attempt.get("attempt_number"),
        "failure": copy.deepcopy(failure),
    }


def complete_task(
    task: dict[str, Any],
    *,
    output_kind: str,
    output_id: str,
    output_hash: str,
    actor: str,
    token: str | None = None,
    usage: dict[str, Any] | None = None,
    now: str | None = None,
    direct_authority: bool = False,
) -> dict[str, Any]:
    now = now or utc_now()
    if task.get("status") in {"CANCELLED", "DEAD_LETTER"}:
        raise ValidationError(
            f"Seat task {task.get('task_id')} cannot complete from {task.get('status')}."
        )
    if not isinstance(output_hash, str) or len(output_hash) != 64:
        raise ValidationError("Task completion output_hash must be a 64-character SHA-256 hex digest.")
    try:
        int(output_hash, 16)
    except ValueError as exc:
        raise ValidationError("Task completion output_hash must be lowercase hexadecimal.") from exc
    if output_hash.lower() != output_hash:
        raise ValidationError("Task completion output_hash must use lowercase hexadecimal.")
    usage_value = normalize_task_usage(usage)
    budget_evaluation = evaluate_budget(task, usage_value)
    output = {
        "kind": str(output_kind),
        "id": str(output_id),
        "hash": output_hash,
        "actor": str(actor),
        "completed_at": now,
        "usage": usage_value,
        "budget_evaluation": budget_evaluation,
    }

    current = task.get("completed_output")
    if task.get("status") == "COMPLETED" and isinstance(current, dict):
        if current.get("id") == output["id"] and current.get("hash") == output["hash"]:
            return copy.deepcopy(current)
        task.setdefault("completion_history", []).append(copy.deepcopy(current))

    lease = task.get("active_lease")
    if task.get("status") == "LEASED" and isinstance(lease, dict):
        if token is None:
            raise ValidationError("The active seat-task lease token is required to complete this task.")
        lease = _verified_active_lease(task, token, now)
        attempt = _attempt(task, int(lease["attempt_number"]))
        attempt.update(
            {
                "status": "COMPLETED",
                "finished_at": now,
                "completion": copy.deepcopy(output),
            }
        )
    else:
        if task.get("lease_policy", {}).get("leases_required", False) and not direct_authority:
            raise ValidationError(
                f"Seat task {task.get('task_id')} requires a lease before completion."
            )
        attempt_number = len(task.get("attempts", [])) + 1
        task.setdefault("attempts", []).append(
            {
                "attempt_number": attempt_number,
                "lease_id": None,
                "worker_id": str(actor),
                "status": "COMPLETED_DIRECT",
                "claimed_at": None,
                "finished_at": now,
                "failure": None,
                "completion": copy.deepcopy(output),
            }
        )

    task["active_lease"] = None
    task["status"] = "COMPLETED"
    task["completed_output"] = output
    task["updated_at"] = now
    task["final_failure"] = None
    return copy.deepcopy(output)


def reap_expired_tasks(state: dict[str, Any], *, now: str | None = None) -> list[dict[str, Any]]:
    now = now or utc_now()
    reaped: list[dict[str, Any]] = []
    for task_id, task in sorted(state.get("seat_tasks", {}).items()):
        before = task.get("status")
        if _reap_one(task, now):
            reaped.append(
                {
                    "task_id": task_id,
                    "old_status": before,
                    "new_status": task.get("status"),
                    "attempt_count": len(task.get("attempts", [])),
                }
            )
    return reaped


def cancel_task(task: dict[str, Any], *, reason: str, actor: str, now: str | None = None) -> dict[str, Any]:
    now = now or utc_now()
    if task.get("status") == "COMPLETED":
        raise ValidationError("A completed seat task cannot be cancelled; preserve it and create a new task.")
    if task.get("status") == "CANCELLED":
        return copy.deepcopy(task.get("cancelled") or {})
    lease = task.get("active_lease")
    if isinstance(lease, dict):
        attempt = _attempt(task, int(lease["attempt_number"]))
        attempt.update(
            {
                "status": "CANCELLED",
                "finished_at": now,
                "failure": {
                    "class": "OPERATOR_CANCELLED",
                    "detail": str(reason),
                    "retryable": False,
                },
            }
        )
    cancellation = {"reason": str(reason), "actor": str(actor), "cancelled_at": now}
    task["active_lease"] = None
    task["status"] = "CANCELLED"
    task["cancelled"] = cancellation
    task["updated_at"] = now
    return copy.deepcopy(cancellation)


def task_receipt(task: dict[str, Any]) -> dict[str, Any]:
    """Return a hash-bound receipt for the task's current terminal or active state."""

    core = {
        "schema_version": TASK_RECEIPT_SCHEMA_VERSION,
        "task_id": task.get("task_id"),
        "task_core_hash": task.get("task_core_hash"),
        "challenge_id": task.get("challenge_id"),
        "phase": task.get("phase"),
        "participant_id": task.get("participant_id"),
        "status": task.get("status"),
        "attempt_count": len(task.get("attempts", [])),
        "attempts_hash": sha256_json(task.get("attempts", [])),
        "completion_history_hash": sha256_json(task.get("completion_history", [])),
        "active_lease_hash": (
            sha256_json(task.get("active_lease"))
            if isinstance(task.get("active_lease"), dict)
            else None
        ),
        "completed_output": copy.deepcopy(task.get("completed_output")),
        "final_failure": copy.deepcopy(task.get("final_failure")),
        "cancelled": copy.deepcopy(task.get("cancelled")),
        "updated_at": task.get("updated_at"),
        "authority_boundary": "This receipt proves recorded orchestration state, not output quality or acceptance.",
    }
    return {**core, "receipt_hash": sha256_json(core)}


def public_task(task: dict[str, Any]) -> dict[str, Any]:
    clean = copy.deepcopy(task)
    lease = clean.get("active_lease")
    if isinstance(lease, dict):
        lease.pop("lease_token_hash", None)
    for attempt in clean.get("attempts", []):
        if isinstance(attempt, dict):
            completion = attempt.get("completion")
            if isinstance(completion, dict):
                completion.pop("notes", None)
                usage = completion.get("usage")
                if isinstance(usage, dict):
                    usage.pop("notes", None)
    completed_output = clean.get("completed_output")
    if isinstance(completed_output, dict):
        completed_output.pop("notes", None)
        usage = completed_output.get("usage")
        if isinstance(usage, dict):
            usage.pop("notes", None)
    for completion in clean.get("completion_history", []):
        if isinstance(completion, dict):
            completion.pop("notes", None)
            usage = completion.get("usage")
            if isinstance(usage, dict):
                usage.pop("notes", None)
    return clean


def orchestration_report(state: dict[str, Any], *, phase: str | None = None) -> dict[str, Any]:
    phases = [phase] if phase else sorted(TASK_PHASES)
    tasks = [
        task
        for task in state.get("seat_tasks", {}).values()
        if isinstance(task, dict) and task.get("phase") in phases
    ]
    status_counts = {status: 0 for status in sorted(TASK_STATUSES)}
    required_incomplete: list[str] = []
    budget_signal_tasks: list[str] = []
    operational_failures: list[dict[str, Any]] = []
    for task in tasks:
        status = str(task.get("status"))
        status_counts[status] = status_counts.get(status, 0) + 1
        if task.get("required") and status != "COMPLETED":
            required_incomplete.append(str(task.get("task_id")))
        completion = task.get("completed_output")
        signals = (
            completion.get("budget_evaluation", {}).get("signals", [])
            if isinstance(completion, dict)
            else []
        )
        if signals:
            budget_signal_tasks.append(str(task.get("task_id")))
        if task.get("final_failure"):
            operational_failures.append(
                {
                    "task_id": task.get("task_id"),
                    "participant_id": task.get("participant_id"),
                    "phase": task.get("phase"),
                    "failure": copy.deepcopy(task.get("final_failure")),
                }
            )
    completed = status_counts.get("COMPLETED", 0)
    total = len(tasks)
    report_core = {
        "schema_version": ORCHESTRATION_REPORT_SCHEMA_VERSION,
        "challenge_id": state.get("challenge_id"),
        "phase_scope": phases,
        "task_count": total,
        "required_task_count": sum(1 for task in tasks if task.get("required")),
        "completed_task_count": completed,
        "completion_ratio": round(completed / total, 6) if total else 1.0,
        "status_counts": status_counts,
        "required_incomplete_task_ids": sorted(required_incomplete),
        "budget_signal_task_ids": sorted(budget_signal_tasks),
        "operational_failures": operational_failures,
        "task_plan_hashes": {
            item: state.get("seat_task_plans", {}).get(item, {}).get("task_plan_hash")
            for item in phases
            if state.get("seat_task_plans", {}).get(item)
        },
        "automatic_score_effect": False,
        "authority_boundary": "Missing, expired, or failed seats are operational evidence and are not silently scored as poor candidates.",
    }
    return {**report_core, "report_hash": sha256_json(report_core)}


def public_orchestration_report(report: dict[str, Any]) -> dict[str, Any]:
    """Return count-only observer evidence without seat/participant status mapping."""

    if not isinstance(report, dict):
        raise ValidationError("orchestration report must be an object")
    failure_classes: dict[str, int] = {}
    failure_phases: dict[str, int] = {}
    for item in report.get("operational_failures", []):
        if not isinstance(item, dict):
            continue
        failure = item.get("failure", {})
        failure_class = (
            str(failure.get("class", "UNKNOWN"))
            if isinstance(failure, dict)
            else "UNKNOWN"
        )
        phase = str(item.get("phase", "UNKNOWN"))
        failure_classes[failure_class] = failure_classes.get(failure_class, 0) + 1
        failure_phases[phase] = failure_phases.get(phase, 0) + 1
    core = {
        "schema_version": "axm.challenge-orchestration-public-report/0.4",
        "challenge_id": report.get("challenge_id"),
        "phase_scope": copy.deepcopy(report.get("phase_scope", [])),
        "task_count": report.get("task_count", 0),
        "required_task_count": report.get("required_task_count", 0),
        "completed_task_count": report.get("completed_task_count", 0),
        "completion_ratio": report.get("completion_ratio", 1.0),
        "status_counts": copy.deepcopy(report.get("status_counts", {})),
        "required_incomplete_task_count": len(
            report.get("required_incomplete_task_ids", [])
        ),
        "budget_signal_task_count": len(report.get("budget_signal_task_ids", [])),
        "operational_failure_count": len(report.get("operational_failures", [])),
        "operational_failure_classes": dict(sorted(failure_classes.items())),
        "operational_failure_phases": dict(sorted(failure_phases.items())),
        "task_plan_hashes": copy.deepcopy(report.get("task_plan_hashes", {})),
        "automatic_score_effect": False,
        "details_hidden": True,
        "source_report_hash": report.get("report_hash"),
        "authority_boundary": (
            "Observer output exposes aggregate availability only. Task identities, "
            "participant mappings, failure detail, and lease evidence remain sealed."
        ),
    }
    return {**core, "public_report_hash": sha256_json(core)}


def verify_orchestration_state(state: dict[str, Any]) -> dict[str, Any]:
    """Recompute orchestration semantics instead of trusting self-rehashed objects."""

    errors: list[str] = []
    warnings: list[str] = []
    tasks = state.get("seat_tasks", {})
    index = state.get("seat_task_index", {})
    plans = state.get("seat_task_plans", {})
    reports = state.get("orchestration_reports", {})
    if not isinstance(tasks, dict):
        return {"valid": False, "errors": ["seat_tasks is not an object"], "warnings": []}
    if not isinstance(index, dict):
        errors.append("seat_task_index is not an object")
        index = {}
    if not isinstance(plans, dict):
        errors.append("seat_task_plans is not an object")
        plans = {}
    if not isinstance(reports, dict):
        errors.append("orchestration_reports is not an object")
        reports = {}

    policy = _policy(state)
    orchestration_expected = bool(policy.get("enabled", False) and state.get("locked_at"))
    expected_index: dict[str, str] = {}
    expected_labels: dict[str, list[str]] = {}
    expected_plan_phases: set[str] = set()
    if orchestration_expected:
        expected_plan_phases.add("BUILD")
        for participant_id, participant in sorted(state.get("participants", {}).items()):
            if isinstance(participant, dict) and participant.get("can_submit", True):
                task_id = _task_id("BUILD", participant_id)
                expected_index[f"BUILD:{participant_id}"] = task_id
                expected_labels[task_id] = []
        assignments = state.get("review_assignments", {})
        if isinstance(assignments, dict) and state.get("review_assignment_report"):
            expected_plan_phases.add("REVIEW")
            for participant_id, participant in sorted(state.get("participants", {}).items()):
                labels = assignments.get(participant_id, [])
                if (
                    isinstance(participant, dict)
                    and participant.get("can_review", True)
                    and isinstance(labels, list)
                    and labels
                ):
                    task_id = _task_id("REVIEW", participant_id)
                    expected_index[f"REVIEW:{participant_id}"] = task_id
                    expected_labels[task_id] = sorted(set(str(item) for item in labels))

    if orchestration_expected:
        missing = sorted(set(expected_index.values()) - set(tasks))
        extra = sorted(set(tasks) - set(expected_index.values()))
        if missing:
            errors.append(f"missing expected seat tasks: {missing}")
        if extra:
            errors.append(f"unexpected seat tasks are present: {extra}")
        if index != expected_index:
            errors.append("seat_task_index does not match the locked participant/assignment plan")
    elif tasks or index or plans:
        warnings.append(
            "orchestration evidence exists although the locked packet does not enable orchestration"
        )

    allowed_attempt_statuses = {
        "ACTIVE",
        "EXPIRED",
        "FAILED",
        "COMPLETED",
        "COMPLETED_DIRECT",
        "CANCELLED",
    }

    def _verify_output_binding(
        task_id: str,
        task: dict[str, Any],
        output: Any,
        *,
        location: str,
        require_active: bool,
    ) -> None:
        if not isinstance(output, dict):
            errors.append(f"seat task {task_id} {location} is not an object")
            return
        phase = task.get("phase")
        participant_id = task.get("participant_id")
        output_id = output.get("id")
        output_hash = output.get("hash")
        if phase == "BUILD":
            if output.get("kind") != "submission":
                errors.append(
                    f"seat task {task_id} {location} kind must be 'submission' for BUILD"
                )
                return
            record = state.get("submissions", {}).get(output_id)
            if not isinstance(record, dict):
                errors.append(
                    f"seat task {task_id} {location} references unknown submission {output_id!r}"
                )
                return
            if record.get("participant_id") != participant_id:
                errors.append(
                    f"seat task {task_id} {location} submission belongs to a different participant"
                )
            if record.get("content_hash") != output_hash:
                errors.append(
                    f"seat task {task_id} {location} hash does not match submission content_hash"
                )
            if require_active and state.get("participant_active_submission", {}).get(participant_id) != output_id:
                errors.append(
                    f"seat task {task_id} completed output is not the participant's active submission"
                )
        elif phase == "REVIEW":
            if output.get("kind") != "review":
                errors.append(
                    f"seat task {task_id} {location} kind must be 'review' for REVIEW"
                )
                return
            record = state.get("reviews", {}).get(output_id)
            if not isinstance(record, dict):
                errors.append(
                    f"seat task {task_id} {location} references unknown review {output_id!r}"
                )
                return
            if record.get("reviewer_id") != participant_id:
                errors.append(
                    f"seat task {task_id} {location} review belongs to a different reviewer"
                )
            if record.get("review_hash") != output_hash:
                errors.append(
                    f"seat task {task_id} {location} hash does not match review review_hash"
                )
            if require_active and state.get("participant_active_review", {}).get(participant_id) != output_id:
                errors.append(
                    f"seat task {task_id} completed output is not the participant's active review"
                )

    for task_id, task in sorted(tasks.items()):
        if not isinstance(task, dict):
            errors.append(f"seat task {task_id!r} is not an object")
            continue
        if task.get("task_id") != task_id:
            errors.append(f"seat task key/id mismatch: {task_id!r}")
        phase = task.get("phase")
        participant_id = task.get("participant_id")
        status = task.get("status")
        if phase not in TASK_PHASES:
            errors.append(f"seat task {task_id} has unknown phase {phase!r}")
        if status not in TASK_STATUSES:
            errors.append(f"seat task {task_id} has unknown status {status!r}")
        core = task_core(task)
        if task.get("task_core_hash") != sha256_json(core):
            errors.append(f"seat task {task_id} core hash mismatch")
        if phase in TASK_PHASES and isinstance(participant_id, str):
            try:
                recomputed_core = _task_core(
                    state,
                    phase,
                    participant_id,
                    assigned_candidate_labels=expected_labels.get(task_id, []),
                )
                if core != recomputed_core:
                    errors.append(
                        f"seat task {task_id} core does not reproduce from locked challenge state"
                    )
            except (ValidationError, IntegrityError) as exc:
                errors.append(f"seat task {task_id} core cannot be reproduced: {exc}")
        key = f"{phase}:{participant_id}"
        if index.get(key) != task_id:
            errors.append(f"seat task {task_id} is missing or mismatched in seat_task_index")

        for timestamp_field in ("created_at", "updated_at"):
            try:
                parse_utc_timestamp(str(task.get(timestamp_field)))
            except ValueError as exc:
                errors.append(
                    f"seat task {task_id} {timestamp_field} is invalid: {exc}"
                )

        attempts = task.get("attempts", [])
        if not isinstance(attempts, list):
            errors.append(f"seat task {task_id} attempts are not a list")
            continue
        if not all(isinstance(attempt, dict) for attempt in attempts):
            errors.append(f"seat task {task_id} contains a non-object attempt")
        expected_numbers = list(range(1, len(attempts) + 1))
        actual_numbers = [
            attempt.get("attempt_number")
            for attempt in attempts
            if isinstance(attempt, dict)
        ]
        if actual_numbers != expected_numbers:
            errors.append(f"seat task {task_id} attempt numbering is not contiguous")
        active_attempts = []
        for attempt in attempts:
            if not isinstance(attempt, dict):
                continue
            attempt_status = attempt.get("status")
            if attempt_status not in allowed_attempt_statuses:
                errors.append(
                    f"seat task {task_id} attempt has unknown status {attempt_status!r}"
                )
            if attempt_status == "ACTIVE":
                active_attempts.append(attempt)
            for timestamp_field in ("claimed_at", "finished_at"):
                raw = attempt.get(timestamp_field)
                if raw is not None:
                    try:
                        parse_utc_timestamp(str(raw))
                    except ValueError as exc:
                        errors.append(
                            f"seat task {task_id} attempt {timestamp_field} is invalid: {exc}"
                        )

        active = task.get("active_lease")
        if status == "LEASED":
            if not isinstance(active, dict):
                errors.append(f"seat task {task_id} is LEASED without an active lease")
            else:
                digest = active.get("lease_token_hash")
                if not isinstance(digest, str) or len(digest) != 64:
                    errors.append(f"seat task {task_id} active lease token hash is invalid")
                else:
                    try:
                        int(digest, 16)
                    except ValueError:
                        errors.append(
                            f"seat task {task_id} active lease token hash is not hexadecimal"
                        )
                try:
                    claimed = parse_utc_timestamp(str(active.get("claimed_at")))
                    expires = parse_utc_timestamp(str(active.get("expires_at")))
                    maximum = parse_utc_timestamp(str(active.get("max_expires_at")))
                    if not claimed < expires <= maximum:
                        errors.append(
                            f"seat task {task_id} active lease timestamp order is invalid"
                        )
                except ValueError as exc:
                    errors.append(f"seat task {task_id} active lease timestamp is invalid: {exc}")
                if len(active_attempts) != 1:
                    errors.append(
                        f"seat task {task_id} must have exactly one ACTIVE attempt while leased"
                    )
                elif (
                    active_attempts[0].get("attempt_number")
                    != active.get("attempt_number")
                    or active_attempts[0].get("lease_id") != active.get("lease_id")
                ):
                    errors.append(
                        f"seat task {task_id} active lease does not match its ACTIVE attempt"
                    )
                heartbeat_count = active.get("heartbeat_count")
                maximum_heartbeats = task.get("lease_policy", {}).get(
                    "max_heartbeat_count", 32
                )
                if (
                    isinstance(heartbeat_count, bool)
                    or not isinstance(heartbeat_count, int)
                    or heartbeat_count < 0
                    or heartbeat_count > maximum_heartbeats
                ):
                    errors.append(
                        f"seat task {task_id} active lease heartbeat count is invalid"
                    )
        else:
            if active is not None:
                errors.append(
                    f"seat task {task_id} has an active lease while status is {status}"
                )
            if active_attempts:
                errors.append(
                    f"seat task {task_id} has ACTIVE attempts while status is {status}"
                )

        completed_output = task.get("completed_output")
        if status == "COMPLETED":
            if not isinstance(completed_output, dict):
                errors.append(f"seat task {task_id} is COMPLETED without completed_output")
            else:
                output_hash = completed_output.get("hash")
                if (
                    not isinstance(output_hash, str)
                    or len(output_hash) != 64
                    or output_hash.lower() != output_hash
                ):
                    errors.append(
                        f"seat task {task_id} completed output hash is invalid"
                    )
                else:
                    try:
                        int(output_hash, 16)
                    except ValueError:
                        errors.append(
                            f"seat task {task_id} completed output hash is not hexadecimal"
                        )
                try:
                    parse_utc_timestamp(str(completed_output.get("completed_at")))
                except ValueError as exc:
                    errors.append(
                        f"seat task {task_id} completion timestamp is invalid: {exc}"
                    )
                try:
                    normalized_usage = normalize_task_usage(completed_output.get("usage"))
                    if normalized_usage != completed_output.get("usage"):
                        errors.append(
                            f"seat task {task_id} completed usage is not canonical"
                        )
                    if evaluate_budget(task, normalized_usage) != completed_output.get(
                        "budget_evaluation"
                    ):
                        errors.append(
                            f"seat task {task_id} budget evaluation does not reproduce"
                        )
                except ValidationError as exc:
                    errors.append(
                        f"seat task {task_id} completed usage is invalid: {exc}"
                    )
            if task.get("final_failure") is not None:
                errors.append(f"seat task {task_id} is COMPLETED with a final failure")
            if task.get("cancelled") is not None:
                errors.append(f"seat task {task_id} is COMPLETED with cancellation evidence")
        elif completed_output is not None:
            errors.append(
                f"seat task {task_id} has completed_output while status is {status}"
            )

        if isinstance(completed_output, dict):
            _verify_output_binding(
                task_id, task, completed_output, location="completed_output", require_active=True
            )
        completion_history = task.get("completion_history", [])
        if not isinstance(completion_history, list):
            errors.append(f"seat task {task_id} completion_history is not a list")
            completion_history = []
        for history_index, historical_output in enumerate(completion_history):
            _verify_output_binding(
                task_id,
                task,
                historical_output,
                location=f"completion_history[{history_index}]",
                require_active=False,
            )

        completion_fingerprints = {
            sha256_json(item)
            for item in ([completed_output] if isinstance(completed_output, dict) else []) + [
                item for item in completion_history if isinstance(item, dict)
            ]
        }
        attempt_completion_fingerprints: set[str] = set()
        for attempt in attempts:
            if not isinstance(attempt, dict):
                continue
            completion = attempt.get("completion")
            if completion is None:
                continue
            if not isinstance(completion, dict):
                errors.append(
                    f"seat task {task_id} attempt {attempt.get('attempt_number')} completion is not an object"
                )
                continue
            fingerprint = sha256_json(completion)
            attempt_completion_fingerprints.add(fingerprint)
            if fingerprint not in completion_fingerprints:
                errors.append(
                    f"seat task {task_id} attempt {attempt.get('attempt_number')} completion is disconnected from completed_output/history"
                )
        missing_attempt_evidence = completion_fingerprints - attempt_completion_fingerprints
        if missing_attempt_evidence:
            errors.append(
                f"seat task {task_id} has completion output/history without matching completed attempt evidence"
            )

        if status == "DEAD_LETTER" and not isinstance(task.get("final_failure"), dict):
            errors.append(f"seat task {task_id} is DEAD_LETTER without final_failure")
        if status == "CANCELLED" and not isinstance(task.get("cancelled"), dict):
            errors.append(f"seat task {task_id} is CANCELLED without cancellation evidence")

    if set(plans) != expected_plan_phases and orchestration_expected:
        errors.append(
            "seat-task plan phases do not match the phases created by the locked challenge"
        )
    for phase, plan in sorted(plans.items()):
        if phase not in TASK_PHASES or not isinstance(plan, dict):
            errors.append(f"invalid seat-task plan entry: {phase!r}")
            continue
        plan_core = {
            key: copy.deepcopy(value)
            for key, value in plan.items()
            if key != "task_plan_hash"
        }
        if plan.get("task_plan_hash") != sha256_json(plan_core):
            errors.append(f"seat-task plan hash mismatch for {phase}")
        phase_task_ids = sorted(
            task_id
            for task_id, task in tasks.items()
            if isinstance(task, dict) and task.get("phase") == phase
        )
        expected_core_hashes = {
            task_id: tasks[task_id].get("task_core_hash")
            for task_id in phase_task_ids
        }
        expected_budget_hashes = {
            task_id: sha256_json(tasks[task_id].get("budget", {}))
            for task_id in phase_task_ids
        }
        if plan.get("task_ids") != phase_task_ids:
            errors.append(f"seat-task plan {phase} task_ids do not reproduce")
        if plan.get("task_core_hashes") != expected_core_hashes:
            errors.append(f"seat-task plan {phase} core hashes do not reproduce")
        if plan.get("budget_hashes") != expected_budget_hashes:
            errors.append(f"seat-task plan {phase} budget hashes do not reproduce")
        if plan.get("task_count") != len(phase_task_ids):
            errors.append(f"seat-task plan {phase} task_count is wrong")
        if plan.get("required_task_count") != sum(
            1 for task_id in phase_task_ids if tasks[task_id].get("required")
        ):
            errors.append(f"seat-task plan {phase} required_task_count is wrong")
        if plan.get("challenge_id") != state.get("challenge_id"):
            errors.append(f"seat-task plan {phase} challenge_id mismatch")
        if plan.get("packet_hash") != state.get("packet_hash"):
            errors.append(f"seat-task plan {phase} packet_hash mismatch")
        if plan.get("rubric_hash") != state.get("rubric_hash"):
            errors.append(f"seat-task plan {phase} rubric_hash mismatch")
        if plan.get("participant_roster_hash") != state.get("participant_roster_hash"):
            errors.append(f"seat-task plan {phase} participant roster hash mismatch")
        expected_assignment_hash = (
            state.get("review_assignment_report", {}).get("assignment_hash")
            if phase == "REVIEW"
            else None
        )
        if plan.get("assignment_hash") != expected_assignment_hash:
            errors.append(f"seat-task plan {phase} assignment hash mismatch")

    unknown_index_ids = sorted(set(index.values()) - set(tasks))
    if unknown_index_ids:
        errors.append(f"seat_task_index references unknown tasks: {unknown_index_ids}")

    for phase, stored_report in sorted(reports.items()):
        if phase not in TASK_PHASES or not isinstance(stored_report, dict):
            errors.append(f"invalid stored orchestration report entry: {phase!r}")
            continue
        if stored_report != orchestration_report(state, phase=phase):
            errors.append(f"stored orchestration report for {phase} does not reproduce")

    return {
        "valid": not errors,
        "errors": sorted(set(errors)),
        "warnings": sorted(set(warnings)),
        "task_count": len(tasks),
        "plan_count": len(plans),
        "expected_task_count": len(expected_index),
    }
