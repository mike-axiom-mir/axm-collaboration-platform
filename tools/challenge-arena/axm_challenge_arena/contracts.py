from __future__ import annotations

import math
from copy import deepcopy
from typing import Any

from .errors import ValidationError
from .utils import (
    ensure_slug,
    ensure_unique_portable_names,
    ensure_unique_portable_paths,
    safe_relative_path,
    sha256_json,
    utc_now,
)

SCHEMA_VERSION = "axm.challenge-arena/0.5"
SUPPORTED_SCHEMA_VERSIONS = {
    "axm.challenge-arena/0.1",
    "axm.challenge-arena/0.2",
    "axm.challenge-arena/0.3",
    "axm.challenge-arena/0.4",
    SCHEMA_VERSION,
}
ALLOWED_CRITERION_SOURCES = {"deterministic", "peer", "human"}
ALLOWED_CATEGORIES = {
    "OPEN",
    "BUILD",
    "WILD",
    "REPAIR",
    "LEAN",
    "LOCAL",
    "BEGINNER",
    "SAFETY",
    "PERFORMANCE",
    "ART",
    "RESEARCH",
}


def _need(obj: dict[str, Any], key: str, expected: type | tuple[type, ...]) -> Any:
    if key not in obj:
        raise ValidationError(f"Missing required field: {key}")
    value = obj[key]
    if not isinstance(value, expected):
        raise ValidationError(f"Field {key!r} must be {expected}; got {type(value).__name__}")
    return value


def _finite_number(value: Any, field: str) -> float:
    if isinstance(value, bool):
        raise ValidationError(f"{field} must be numeric, not true/false.")
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"{field} must be numeric.") from exc
    if not math.isfinite(number):
        raise ValidationError(f"{field} must be finite.")
    return number


def _bounded_int(value: Any, field: str, *, minimum: int, maximum: int) -> int:
    if isinstance(value, bool):
        raise ValidationError(f"{field} must be an integer, not true/false.")
    if isinstance(value, int):
        parsed = value
    elif isinstance(value, float):
        if not math.isfinite(value) or not value.is_integer():
            raise ValidationError(f"{field} must be a whole finite number.")
        parsed = int(value)
    elif isinstance(value, str) and value.strip() and value.strip().lstrip("+-").isdigit():
        parsed = int(value.strip())
    else:
        raise ValidationError(f"{field} must be an integer.")
    if not minimum <= parsed <= maximum:
        raise ValidationError(f"{field} must be in {minimum}..{maximum}.")
    return parsed


def _bounded_optional_int(
    value: Any,
    field: str,
    *,
    minimum: int = 0,
    maximum: int = 64 * 1024**4,
) -> int | None:
    if value is None:
        return None
    return _bounded_int(value, field, minimum=minimum, maximum=maximum)


def normalize_packet(packet: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(packet, dict):
        raise ValidationError("Challenge packet must be a JSON object.")

    result = deepcopy(packet)
    result.setdefault("schema_version", SCHEMA_VERSION)
    if result["schema_version"] not in SUPPORTED_SCHEMA_VERSIONS:
        raise ValidationError(
            f"Unsupported schema_version {result['schema_version']!r}; expected one of {sorted(SUPPORTED_SCHEMA_VERSIONS)!r}."
        )
    is_v04 = result["schema_version"] in {"axm.challenge-arena/0.4", "axm.challenge-arena/0.5"}
    is_v05 = result["schema_version"] == SCHEMA_VERSION

    challenge_id = _need(result, "challenge_id", str)
    try:
        result["challenge_id"] = ensure_slug(challenge_id, "challenge_id")
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc

    title = _need(result, "title", str).strip()
    goal = _need(result, "goal", str).strip()
    if not title or not goal:
        raise ValidationError("title and goal may not be empty.")
    result["title"] = title
    result["goal"] = goal

    category = str(result.get("category", "OPEN")).upper()
    if category not in ALLOWED_CATEGORIES:
        raise ValidationError(f"Unknown category {category!r}. Allowed: {sorted(ALLOWED_CATEGORIES)}")
    result["category"] = category

    constraints = result.setdefault("constraints", [])
    if not isinstance(constraints, list) or not all(isinstance(item, str) for item in constraints):
        raise ValidationError("constraints must be a list of strings.")
    result["constraints"] = [item.strip() for item in constraints if item.strip()]

    deliverables = _need(result, "deliverables", list)
    if not deliverables:
        raise ValidationError("At least one deliverable is required.")
    seen_deliverables: set[str] = set()
    for deliverable in deliverables:
        if not isinstance(deliverable, dict):
            raise ValidationError("Each deliverable must be an object.")
        did = _need(deliverable, "id", str)
        try:
            did = ensure_slug(did, "deliverable.id")
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        if did in seen_deliverables:
            raise ValidationError(f"Duplicate deliverable id: {did}")
        seen_deliverables.add(did)
        deliverable["id"] = did
        deliverable.setdefault("description", "")
        if not isinstance(deliverable["description"], str):
            raise ValidationError(f"deliverable {did}: description must be a string.")
        deliverable.setdefault("required", True)
        if not isinstance(deliverable["required"], bool):
            raise ValidationError(f"deliverable {did}: required must be true or false.")
        deliverable.setdefault("accepted_media_types", ["application/octet-stream"])
        if not isinstance(deliverable["accepted_media_types"], list) or not all(
            isinstance(item, str) and item.strip() for item in deliverable["accepted_media_types"]
        ):
            raise ValidationError(f"deliverable {did}: accepted_media_types must be a list of strings.")
        deliverable["accepted_media_types"] = sorted(set(item.strip().lower() for item in deliverable["accepted_media_types"]))
        deliverable["minimum_artifacts"] = _bounded_int(
            deliverable.get("minimum_artifacts", 1 if deliverable["required"] else 0),
            f"deliverable {did}.minimum_artifacts",
            minimum=0,
            maximum=100_000,
        )
        maximum_artifacts = deliverable.get("maximum_artifacts")
        if maximum_artifacts is not None:
            deliverable["maximum_artifacts"] = _bounded_int(
                maximum_artifacts,
                f"deliverable {did}.maximum_artifacts",
                minimum=deliverable["minimum_artifacts"],
                maximum=100_000,
            )
    try:
        ensure_unique_portable_names(
            [str(item["id"]) for item in deliverables],
            field="deliverable.id",
        )
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc

    rubric = _need(result, "rubric", list)
    if not rubric:
        raise ValidationError("At least one rubric criterion is required.")
    seen_criteria: set[str] = set()
    total_weight = 0.0
    for criterion in rubric:
        if not isinstance(criterion, dict):
            raise ValidationError("Each rubric criterion must be an object.")
        cid = _need(criterion, "id", str)
        try:
            cid = ensure_slug(cid, "rubric.id")
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        if cid in seen_criteria:
            raise ValidationError(f"Duplicate criterion id: {cid}")
        seen_criteria.add(cid)
        criterion["id"] = cid
        criterion.setdefault("label", cid.replace("_", " ").title())
        criterion.setdefault("description", "")
        if not isinstance(criterion["label"], str) or not isinstance(criterion["description"], str):
            raise ValidationError(f"criterion {cid}: label and description must be strings.")
        source = str(criterion.get("source", "peer")).lower()
        if source not in ALLOWED_CRITERION_SOURCES:
            raise ValidationError(f"criterion {cid}: invalid source {source!r}")
        criterion["source"] = source
        weight = _finite_number(criterion.get("weight", 1.0), f"criterion {cid}.weight")
        if weight <= 0:
            raise ValidationError(f"criterion {cid}: weight must be above zero.")
        criterion["weight"] = weight
        total_weight += weight
        score_min = _finite_number(criterion.get("score_min", 0), f"criterion {cid}.score_min")
        score_max = _finite_number(criterion.get("score_max", 100), f"criterion {cid}.score_max")
        if score_max <= score_min:
            raise ValidationError(f"criterion {cid}: score_max must be above score_min.")
        criterion["score_min"] = score_min
        criterion["score_max"] = score_max
    if total_weight <= 0:
        raise ValidationError("Rubric weights must add up to more than zero.")
    try:
        ensure_unique_portable_names(
            [str(item["id"]) for item in rubric],
            field="rubric.id",
        )
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc

    checks = result.setdefault("deterministic_checks", [])
    if not isinstance(checks, list):
        raise ValidationError("deterministic_checks must be a list.")
    seen_checks: set[str] = set()
    for check in checks:
        if not isinstance(check, dict):
            raise ValidationError("Each deterministic check must be an object.")
        check_id = _need(check, "id", str)
        kind = _need(check, "kind", str)
        try:
            check_id = ensure_slug(check_id, "check.id")
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        if check_id in seen_checks:
            raise ValidationError(f"Duplicate check id: {check_id}")
        seen_checks.add(check_id)
        check["id"] = check_id
        check["kind"] = kind.strip().lower()
        if not check["kind"]:
            raise ValidationError(f"check {check_id}: kind may not be empty.")
        check.setdefault("criterion_id", None)
        if check["criterion_id"] is not None and check["criterion_id"] not in seen_criteria:
            raise ValidationError(
                f"check {check_id}: criterion_id {check['criterion_id']!r} is not in the rubric."
            )
        check_weight = _finite_number(check.get("weight", 1.0), f"check {check_id}.weight")
        if check_weight <= 0:
            raise ValidationError(f"check {check_id}: weight must be above zero.")
        check["weight"] = check_weight
        check.setdefault("required", True)
        if not isinstance(check["required"], bool):
            raise ValidationError(f"check {check_id}: required must be true or false.")
        check.setdefault("config", {})
        if not isinstance(check["config"], dict):
            raise ValidationError(f"check {check_id}: config must be an object.")
    try:
        ensure_unique_portable_names(
            [str(item["id"]) for item in checks],
            field="check.id",
        )
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc

    policy = result.setdefault("participant_policy", {})
    if not isinstance(policy, dict):
        raise ValidationError("participant_policy must be an object.")
    policy["minimum_participants"] = _bounded_int(
        policy.get("minimum_participants", 2), "participant_policy.minimum_participants", minimum=2, maximum=10_000
    )
    for key, default in {
        "blind_authorship": True,
        "allow_self_vote": False,
        "require_complete_ballot": True,
        "reveal_authors_after_close": True,
        "allow_late_registration": False,
        "require_submission_packet_ack": False,
        # Exact packet acknowledgement, evidence-linked scoring, abstention, and
        # tied ranking tiers belong to the v0.4 wire contract.  Earlier packets
        # keep their historical defaults unless explicitly upgraded.
        "require_review_packet_ack": is_v04,
        "allow_criterion_abstention": is_v04,
        "allow_tied_rankings": is_v04,
        "require_score_evidence": is_v04,
        "hide_reviewer_own_blind_label": is_v05,
        "require_revision_precondition": is_v05,
        "reject_symlinks": True,
    }.items():
        policy.setdefault(key, default)
        if not isinstance(policy[key], bool):
            raise ValidationError(f"participant_policy.{key} must be true or false.")
    policy["max_artifacts_per_submission"] = _bounded_int(
        policy.get("max_artifacts_per_submission", 10_000),
        "participant_policy.max_artifacts_per_submission",
        minimum=1,
        maximum=1_000_000,
    )
    policy["max_single_artifact_bytes"] = _bounded_int(
        policy.get("max_single_artifact_bytes", 2 * 1024**3),
        "participant_policy.max_single_artifact_bytes",
        minimum=1,
        maximum=16 * 1024**4,
    )
    policy["max_total_artifact_bytes"] = _bounded_int(
        policy.get("max_total_artifact_bytes", 8 * 1024**3),
        "participant_policy.max_total_artifact_bytes",
        minimum=1,
        maximum=64 * 1024**4,
    )
    if policy["max_single_artifact_bytes"] > policy["max_total_artifact_bytes"]:
        raise ValidationError("max_single_artifact_bytes may not exceed max_total_artifact_bytes.")
    policy["minimum_peer_reviews_per_candidate"] = _bounded_int(
        policy.get("minimum_peer_reviews_per_candidate", 0),
        "participant_policy.minimum_peer_reviews_per_candidate",
        minimum=0,
        maximum=10_000,
    )
    policy["minimum_independent_review_groups_per_candidate"] = _bounded_int(
        policy.get("minimum_independent_review_groups_per_candidate", 0),
        "participant_policy.minimum_independent_review_groups_per_candidate",
        minimum=0,
        maximum=10_000,
    )
    assignment_mode = str(policy.get("review_assignment_mode", "all")).lower()
    if assignment_mode not in {"all", "balanced"}:
        raise ValidationError(
            "participant_policy.review_assignment_mode must be 'all' or 'balanced'."
        )
    policy["review_assignment_mode"] = assignment_mode
    policy["reviews_per_reviewer"] = _bounded_int(
        policy.get("reviews_per_reviewer", 0),
        "participant_policy.reviews_per_reviewer",
        minimum=0,
        maximum=10_000,
    )
    policy["minimum_score_evidence_refs"] = _bounded_int(
        policy.get("minimum_score_evidence_refs", 1),
        "participant_policy.minimum_score_evidence_refs",
        minimum=0,
        maximum=20,
    )
    if policy["require_score_evidence"] and policy["minimum_score_evidence_refs"] < 1:
        raise ValidationError(
            "minimum_score_evidence_refs must be at least 1 when require_score_evidence is true."
        )
    coverage = _finite_number(
        policy.get("minimum_automatic_weight_coverage_ratio", 0.0),
        "participant_policy.minimum_automatic_weight_coverage_ratio",
    )
    if not 0.0 <= coverage <= 1.0:
        raise ValidationError("minimum_automatic_weight_coverage_ratio must be in 0..1.")
    policy["minimum_automatic_weight_coverage_ratio"] = coverage

    evaluation_policy = result.setdefault("evaluation_policy", {})
    if not isinstance(evaluation_policy, dict):
        raise ValidationError("evaluation_policy must be an object.")
    method = str(evaluation_policy.get("peer_aggregation", "median")).lower()
    if method not in {"median", "mean", "trimmed_mean"}:
        raise ValidationError(
            "evaluation_policy.peer_aggregation must be median, mean, or trimmed_mean."
        )
    evaluation_policy["peer_aggregation"] = method
    trim_fraction = _finite_number(
        evaluation_policy.get("trim_fraction", 0.1), "evaluation_policy.trim_fraction"
    )
    if not 0.0 <= trim_fraction < 0.5:
        raise ValidationError("evaluation_policy.trim_fraction must be in 0..0.5.")
    evaluation_policy["trim_fraction"] = trim_fraction
    outlier_threshold = _finite_number(
        evaluation_policy.get("outlier_threshold_points", 25.0),
        "evaluation_policy.outlier_threshold_points",
    )
    if not 0.0 <= outlier_threshold <= 100.0:
        raise ValidationError("evaluation_policy.outlier_threshold_points must be in 0..100.")
    evaluation_policy["outlier_threshold_points"] = outlier_threshold
    evaluation_policy.setdefault("exclude_flagged_reviews", False)
    if evaluation_policy["exclude_flagged_reviews"] is not False:
        raise ValidationError(
            "The Arena does not silently exclude flagged reviews; exclude_flagged_reviews must remain false."
        )

    blind_order_policy = result.setdefault("blind_order_policy", {})
    if not isinstance(blind_order_policy, dict):
        raise ValidationError("blind_order_policy must be an object.")
    blind_order_mode = str(
        blind_order_policy.get(
            "mode", "sealed_random" if is_v04 else "deterministic_replay"
        )
    ).lower()
    if blind_order_mode not in {"sealed_random", "deterministic_replay"}:
        raise ValidationError(
            "blind_order_policy.mode must be sealed_random or deterministic_replay."
        )
    blind_order_policy["mode"] = blind_order_mode
    blind_order_policy["note"] = str(
        blind_order_policy.get(
            "note",
            (
                "sealed_random prevents candidates from predicting blind labels; "
                "deterministic_replay is reserved for reproducible fixtures and audits."
            ),
        )
    )

    orchestration = result.setdefault("orchestration_policy", {})
    if not isinstance(orchestration, dict):
        raise ValidationError("orchestration_policy must be an object.")
    for key, default in {
        # Seat orchestration is native to v0.4 and disabled by default for
        # legacy packets so old rounds do not acquire new required state.
        "enabled": is_v04,
        "task_leases_required": False,
        "allow_delegate_workers": False,
        "usage_over_budget_is_automatic_failure": False,
    }.items():
        orchestration.setdefault(key, default)
        if not isinstance(orchestration[key], bool):
            raise ValidationError(f"orchestration_policy.{key} must be true or false.")
    if orchestration["usage_over_budget_is_automatic_failure"] is not False:
        raise ValidationError(
            "Budget evidence may not silently fail or score a candidate; "
            "usage_over_budget_is_automatic_failure must remain false."
        )
    orchestration["lease_seconds"] = _bounded_int(
        orchestration.get("lease_seconds", 900),
        "orchestration_policy.lease_seconds",
        minimum=10,
        maximum=7 * 24 * 3600,
    )
    orchestration["lease_extension_seconds"] = _bounded_int(
        orchestration.get("lease_extension_seconds", orchestration["lease_seconds"]),
        "orchestration_policy.lease_extension_seconds",
        minimum=1,
        maximum=7 * 24 * 3600,
    )
    orchestration["max_total_lease_seconds"] = _bounded_int(
        orchestration.get("max_total_lease_seconds", max(7200, orchestration["lease_seconds"])),
        "orchestration_policy.max_total_lease_seconds",
        minimum=orchestration["lease_seconds"],
        maximum=30 * 24 * 3600,
    )
    orchestration["max_heartbeat_count"] = _bounded_int(
        orchestration.get("max_heartbeat_count", 32),
        "orchestration_policy.max_heartbeat_count",
        minimum=0,
        maximum=100_000,
    )
    orchestration["max_attempts"] = _bounded_int(
        orchestration.get("max_attempts", 3),
        "orchestration_policy.max_attempts",
        minimum=1,
        maximum=1000,
    )
    completion_ratio = _finite_number(
        orchestration.get("minimum_build_task_completion_ratio", 0.0),
        "orchestration_policy.minimum_build_task_completion_ratio",
    )
    if not 0.0 <= completion_ratio <= 1.0:
        raise ValidationError(
            "orchestration_policy.minimum_build_task_completion_ratio must be in 0..1."
        )
    orchestration["minimum_build_task_completion_ratio"] = completion_ratio

    def normalize_budget(name: str, defaults: dict[str, Any]) -> dict[str, Any]:
        budget = orchestration.setdefault(name, {})
        if not isinstance(budget, dict):
            raise ValidationError(f"orchestration_policy.{name} must be an object.")
        budget["max_wall_seconds"] = _bounded_optional_int(
            budget.get("max_wall_seconds", defaults["max_wall_seconds"]),
            f"orchestration_policy.{name}.max_wall_seconds",
            minimum=1,
            maximum=30 * 24 * 3600,
        )
        for field in (
            "max_input_bytes",
            "max_output_bytes",
            "max_token_units",
            "max_tool_calls",
        ):
            budget[field] = _bounded_optional_int(
                budget.get(field, defaults.get(field)),
                f"orchestration_policy.{name}.{field}",
                minimum=0,
                maximum=64 * 1024**4,
            )
        budget["measurement_note"] = str(
            budget.get(
                "measurement_note",
                "Limits are locked fairness evidence. Cross-vendor token/tool usage may be self-reported unless a trusted runner measures it.",
            )
        )
        return budget

    orchestration["build_budget"] = normalize_budget(
        "build_budget",
        {
            "max_wall_seconds": 3600,
            "max_input_bytes": None,
            "max_output_bytes": policy["max_total_artifact_bytes"],
            "max_token_units": None,
            "max_tool_calls": None,
        },
    )
    orchestration["review_budget"] = normalize_budget(
        "review_budget",
        {
            "max_wall_seconds": 1800,
            "max_input_bytes": None,
            "max_output_bytes": 8 * 1024 * 1024,
            "max_token_units": None,
            "max_tool_calls": None,
        },
    )

    inputs = result.setdefault("inputs", [])
    if not isinstance(inputs, list) or not all(isinstance(item, dict) for item in inputs):
        raise ValidationError("inputs must be a list of objects.")
    seen_inputs: set[str] = set()
    for index, input_item in enumerate(inputs, start=1):
        input_id = str(input_item.get("id") or f"input-{index}")
        try:
            input_id = ensure_slug(input_id, "input.id")
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        if input_id in seen_inputs:
            raise ValidationError(f"Duplicate input id: {input_id}")
        seen_inputs.add(input_id)
        input_item["id"] = input_id
        input_item.setdefault("kind", "file")
        input_item.setdefault("required", True)
        if not isinstance(input_item["required"], bool):
            raise ValidationError(f"input {input_id}: required must be true or false.")
    try:
        ensure_unique_portable_names(
            [str(item["id"]) for item in inputs],
            field="input.id",
        )
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc

    integration = result.setdefault(
        "integration", {"source_module": "standalone", "return_mode": "result_and_merge_map"}
    )
    if not isinstance(integration, dict):
        raise ValidationError("integration must be an object.")
    integration.setdefault("source_module", "standalone")
    integration.setdefault("return_mode", "result_and_merge_map")

    result.setdefault("created_at", utc_now())
    result.setdefault("created_by", "human")
    notes = result.setdefault("notes", [])
    if not isinstance(notes, list) or not all(isinstance(item, str) for item in notes):
        raise ValidationError("notes must be a list of strings.")

    return result


def packet_hash(packet: dict[str, Any]) -> str:
    clean = deepcopy(packet)
    clean.pop("packet_hash", None)
    return sha256_json(clean)


def rubric_hash(packet: dict[str, Any]) -> str:
    return sha256_json(packet["rubric"])


def validate_submission_manifest(manifest: dict[str, Any], participant_id: str) -> dict[str, Any]:
    if not isinstance(manifest, dict):
        raise ValidationError("Submission manifest must be an object.")
    result = deepcopy(manifest)
    supplied_schema = result.get("schema_version", "axm.challenge-submission/0.2")
    if supplied_schema not in {
        "axm.challenge-submission/0.1",
        "axm.challenge-submission/0.2",
    }:
        raise ValidationError(
            "Unsupported submission schema_version; expected axm.challenge-submission/0.1 or /0.2."
        )
    # Normalize newly stored submissions to the current contract while still accepting
    # v0.1 intake packets for migration.
    result["schema_version"] = "axm.challenge-submission/0.2"
    result.setdefault("participant_id", participant_id)
    if result["participant_id"] != participant_id:
        raise ValidationError("Manifest participant_id does not match the submitting participant.")
    result.setdefault("summary", "")
    if not isinstance(result["summary"], str):
        raise ValidationError("Submission summary must be a string.")
    artifacts = _need(result, "artifacts", list)
    if not artifacts:
        raise ValidationError("A submission must list at least one artifact.")
    seen: set[str] = set()
    for artifact in artifacts:
        if not isinstance(artifact, dict):
            raise ValidationError("Each artifact entry must be an object.")
        raw_path = _need(artifact, "path", str).replace("\\", "/")
        try:
            path = safe_relative_path(raw_path).as_posix()
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        if path in seen:
            raise ValidationError(f"Duplicate artifact path: {path}")
        seen.add(path)
        artifact["path"] = path
        artifact.setdefault("deliverable_id", None)
        if artifact["deliverable_id"] is not None and not isinstance(artifact["deliverable_id"], str):
            raise ValidationError(f"Artifact {path}: deliverable_id must be a string or null.")
        artifact.setdefault("role", "supporting")
        artifact.setdefault("media_type", "application/octet-stream")
        if not isinstance(artifact["role"], str) or not artifact["role"].strip():
            raise ValidationError(f"Artifact {path}: role must be a non-empty string.")
        if not isinstance(artifact["media_type"], str) or not artifact["media_type"].strip():
            raise ValidationError(f"Artifact {path}: media_type must be a non-empty string.")
        artifact["role"] = artifact["role"].strip()
        artifact["media_type"] = artifact["media_type"].strip().lower()
        artifact.setdefault("provenance", {})
        if not isinstance(artifact["provenance"], dict):
            raise ValidationError(f"Artifact {path}: provenance must be an object.")
    try:
        ensure_unique_portable_paths(
            [str(item["path"]) for item in artifacts],
            field="artifact.path",
        )
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc
    result.setdefault("claims", {})
    if not isinstance(result["claims"], dict):
        raise ValidationError("Submission claims must be an object.")
    result.setdefault("notes", [])
    if not isinstance(result["notes"], list) or not all(isinstance(item, str) for item in result["notes"]):
        raise ValidationError("Submission notes must be a list of strings.")
    return result
