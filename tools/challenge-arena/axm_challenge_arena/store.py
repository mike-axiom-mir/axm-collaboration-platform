from __future__ import annotations

import copy
import json
import shutil
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from .errors import IntegrityError, ValidationError
from .locking import FileLock
from .utils import (
    atomic_write_json,
    atomic_write_text,
    ensure_slug,
    ensure_unique_portable_paths,
    fsync_directory,
    portable_name_key,
    read_json,
    strict_json_loads,
    safe_relative_path,
    semantic_state_hash,
    sha256_bytes,
    sha256_json,
    utc_now,
)


CHECKPOINT_ACTIONS = {
    "CHALLENGE_CREATED",
    "CHALLENGE_LOCKED",
    "SUBMISSIONS_CLOSED",
    "DETERMINISTIC_CHECKS_COMPLETED",
    "BLIND_REVIEW_OPENED",
    "VOTING_CLOSED",
    "RESULT_SYNTHESIZED",
    "HUMAN_DECISION_RECORDED",
    "CHALLENGE_ABORTED",
    "FOLLOWUP_SPAWNED",
}

MAX_TRANSACTION_SIDECARS = 256
MAX_TRANSACTION_SIDECAR_BYTES = 16 * 1024 * 1024
MAX_TRANSACTION_SIDECAR_TOTAL_BYTES = 64 * 1024 * 1024


class ChallengeStore:
    """Local filesystem store with crash-recoverable, hash-chained commits.

    Event files are canonical and written atomically. ``events.jsonl`` remains a
    convenient portable projection and can be rebuilt from those files. A small
    pending-commit journal lets the next run finish an interrupted transition
    without inventing a different state.
    """

    def __init__(self, root: str | Path, *, lock_timeout: float = 30.0) -> None:
        self.root = Path(root).expanduser().resolve()
        self.challenges_root = self.root / "challenges"
        self.challenges_root.mkdir(parents=True, exist_ok=True)
        self._workspace_lock = FileLock(
            self.root / ".arena-workspace.lock", timeout=lock_timeout
        )

    @contextmanager
    def operation_lock(self) -> Iterator[None]:
        with self._workspace_lock:
            yield

    @staticmethod
    def validate_challenge_id(challenge_id: str) -> str:
        try:
            return ensure_slug(str(challenge_id), "challenge_id")
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

    def challenge_dir(self, challenge_id: str) -> Path:
        return self.challenges_root / self.validate_challenge_id(challenge_id)

    def state_path(self, challenge_id: str) -> Path:
        return self.challenge_dir(challenge_id) / "state.json"

    def events_path(self, challenge_id: str) -> Path:
        return self.challenge_dir(challenge_id) / "events.jsonl"

    def event_files_dir(self, challenge_id: str) -> Path:
        return self.challenge_dir(challenge_id) / "events"

    def pending_path(self, challenge_id: str) -> Path:
        return self.challenge_dir(challenge_id) / ".pending-commit.json"

    def checkpoints_dir(self, challenge_id: str) -> Path:
        return self.challenge_dir(challenge_id) / "checkpoints"

    def legacy_migration_path(self, challenge_id: str) -> Path:
        return self.challenge_dir(challenge_id) / ".legacy-event-migration.json"

    def checkpoint_path(self, challenge_id: str, event: dict[str, Any]) -> Path:
        action = str(event["action"]).lower().replace("_", "-")
        return self.checkpoints_dir(challenge_id) / (
            f"{int(event['sequence']):08d}-{action}-{str(event['event_hash'])[:12]}.json"
        )

    def exists(self, challenge_id: str) -> bool:
        return self.state_path(challenge_id).is_file()

    def create(self, challenge_id: str, state: dict[str, Any]) -> None:
        challenge_id = self.validate_challenge_id(challenge_id)
        directory = self.challenge_dir(challenge_id)
        collision_key = portable_name_key(challenge_id)
        existing_collision = next(
            (
                child.name
                for child in self.challenges_root.iterdir()
                if portable_name_key(child.name) == collision_key
            ),
            None,
        )
        if existing_collision is not None:
            raise ValidationError(
                f"Challenge {challenge_id!r} collides with existing portable challenge name {existing_collision!r}."
            )
        try:
            for child in ("submissions", "reviews", "reports", "events", "checkpoints"):
                (directory / child).mkdir(parents=True, exist_ok=True)
            atomic_write_json(self.state_path(challenge_id), state)
            fsync_directory(directory)
        except Exception:
            shutil.rmtree(directory, ignore_errors=True)
            raise

    def load(self, challenge_id: str) -> dict[str, Any]:
        challenge_id = self.validate_challenge_id(challenge_id)
        path = self.state_path(challenge_id)
        if not path.is_file():
            raise ValidationError(f"Unknown challenge: {challenge_id}")
        value = read_json(path)
        if not isinstance(value, dict):
            raise IntegrityError(f"Stored state for {challenge_id} is not an object.")
        if value.get("challenge_id") != challenge_id:
            raise IntegrityError("Stored challenge_id does not match its directory.")
        return value

    def save(self, challenge_id: str, state: dict[str, Any]) -> None:
        atomic_write_json(self.state_path(challenge_id), state)

    def _normalize_sidecars(
        self,
        sidecars: list[dict[str, Any]] | None,
    ) -> list[dict[str, str]]:
        """Validate small UTF-8 evidence files carried by a pending commit.

        Sidecars are intentionally limited to text. Large candidate artifacts stay in
        their dedicated immutable folders; this path is for reviews, receipts, and
        reports that must become crash-consistent with a semantic state transition.
        """

        normalized: list[dict[str, str]] = []
        seen: set[str] = set()
        raw_sidecars = sidecars or []
        try:
            ensure_unique_portable_paths(
                [str(item.get("relative_path", "")) for item in raw_sidecars if isinstance(item, dict)],
                field="commit sidecar path",
            )
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        if len(raw_sidecars) > MAX_TRANSACTION_SIDECARS:
            raise ValidationError(
                f"A commit may carry at most {MAX_TRANSACTION_SIDECARS} sidecars."
            )
        total_bytes = 0
        for raw in raw_sidecars:
            if not isinstance(raw, dict):
                raise ValidationError("Commit sidecar descriptors must be objects.")
            try:
                relative = safe_relative_path(str(raw["relative_path"]))
            except (KeyError, ValueError) as exc:
                raise ValidationError(f"Unsafe commit sidecar path: {raw.get('relative_path')!r}") from exc
            relative_text = relative.as_posix()
            if relative_text in seen:
                raise ValidationError(f"Duplicate commit sidecar path: {relative_text}")
            seen.add(relative_text)
            mode = str(raw.get("mode", "replace"))
            if mode not in {"replace", "immutable"}:
                raise ValidationError(
                    f"Commit sidecar mode must be 'replace' or 'immutable': {relative_text}"
                )
            content = raw.get("content")
            if not isinstance(content, str):
                raise ValidationError(
                    f"Commit sidecar content must be UTF-8 text: {relative_text}"
                )
            encoded = content.encode("utf-8")
            content_bytes = len(encoded)
            if content_bytes > MAX_TRANSACTION_SIDECAR_BYTES:
                raise ValidationError(
                    f"Commit sidecar exceeds {MAX_TRANSACTION_SIDECAR_BYTES} bytes: {relative_text}"
                )
            total_bytes += content_bytes
            if total_bytes > MAX_TRANSACTION_SIDECAR_TOTAL_BYTES:
                raise ValidationError(
                    "Combined commit sidecars exceed the bounded transaction limit."
                )
            digest = sha256_bytes(encoded)
            supplied_digest = raw.get("sha256")
            if supplied_digest not in {None, digest}:
                raise IntegrityError(
                    f"Commit sidecar digest does not match its content: {relative_text}"
                )
            normalized.append(
                {
                    "relative_path": relative_text,
                    "mode": mode,
                    "content": content,
                    "sha256": digest,
                }
            )
        return normalized

    def _apply_sidecars(
        self,
        challenge_id: str,
        sidecars: list[dict[str, Any]] | None,
    ) -> None:
        challenge_dir = self.challenge_dir(challenge_id)
        normalized = self._normalize_sidecars(sidecars)
        for sidecar in normalized:
            relative = safe_relative_path(sidecar["relative_path"])
            current = challenge_dir
            for part in relative.parts[:-1]:
                current = current / part
                if current.is_symlink():
                    raise IntegrityError(
                        f"Commit sidecar parent is a symbolic link: {relative.as_posix()}"
                    )
                if current.exists() and not current.is_dir():
                    raise IntegrityError(
                        f"Commit sidecar parent is not a directory: {relative.as_posix()}"
                    )
                current.mkdir(exist_ok=True)

            destination = challenge_dir / relative
            if destination.is_symlink():
                raise IntegrityError(
                    f"Commit sidecar destination is a symbolic link: {relative.as_posix()}"
                )
            if destination.exists() and not destination.is_file():
                raise IntegrityError(
                    f"Commit sidecar destination is not a file: {relative.as_posix()}"
                )
            if sidecar["mode"] == "immutable" and destination.exists():
                current_digest = sha256_bytes(destination.read_bytes())
                if current_digest != sidecar["sha256"]:
                    raise IntegrityError(
                        f"Immutable commit sidecar already exists with different bytes: {relative.as_posix()}"
                    )
                continue
            atomic_write_text(destination, sidecar["content"])
            if sha256_bytes(destination.read_bytes()) != sidecar["sha256"]:
                raise IntegrityError(
                    f"Commit sidecar verification failed after write: {relative.as_posix()}"
                )

    def _event_file_candidates(self, challenge_id: str, sequence: int) -> list[Path]:
        return sorted(self.event_files_dir(challenge_id).glob(f"{sequence:08d}-*.json"))

    def _event_file_path(self, challenge_id: str, event: dict[str, Any]) -> Path:
        sequence = int(event["sequence"])
        event_hash = str(event["event_hash"])
        return self.event_files_dir(challenge_id) / f"{sequence:08d}-{event_hash}.json"

    def _write_event_file(self, challenge_id: str, event: dict[str, Any]) -> None:
        destination = self._event_file_path(challenge_id, event)
        existing = self._event_file_candidates(challenge_id, int(event["sequence"]))
        if existing:
            if len(existing) != 1 or existing[0] != destination:
                raise IntegrityError(
                    f"Event sequence {event['sequence']} already has a different canonical event file."
                )
            if read_json(destination) != event:
                raise IntegrityError(f"Canonical event file differs for sequence {event['sequence']}.")
            return
        atomic_write_json(destination, event)

    def _legacy_events(self, challenge_id: str) -> list[dict[str, Any]]:
        path = self.events_path(challenge_id)
        if not path.exists():
            return []
        events: list[dict[str, Any]] = []
        with path.open("r", encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, start=1):
                if not line.strip():
                    continue
                try:
                    value = strict_json_loads(line)
                except json.JSONDecodeError as exc:
                    raise IntegrityError(
                        f"Invalid legacy events.jsonl at line {line_number}: {exc}"
                    ) from exc
                if not isinstance(value, dict):
                    raise IntegrityError(f"Legacy event line {line_number} is not an object.")
                events.append(value)
        return events

    def _validate_legacy_events_for_migration(
        self, challenge_id: str, events: list[dict[str, Any]]
    ) -> None:
        previous: str | None = None
        for expected_sequence, event in enumerate(events, start=1):
            core = {key: value for key, value in event.items() if key != "event_hash"}
            if event.get("challenge_id") not in {None, challenge_id}:
                raise IntegrityError(
                    f"Cannot migrate event sequence {expected_sequence}: challenge_id mismatch."
                )
            if event.get("sequence") != expected_sequence:
                raise IntegrityError(
                    f"Cannot migrate legacy events: expected sequence {expected_sequence}, "
                    f"found {event.get('sequence')!r}."
                )
            if event.get("previous_event_hash") != previous:
                raise IntegrityError(
                    f"Cannot migrate event sequence {expected_sequence}: previous hash mismatch."
                )
            if sha256_json(core) != event.get("event_hash"):
                raise IntegrityError(
                    f"Cannot migrate event sequence {expected_sequence}: event hash is invalid."
                )
            previous = str(event.get("event_hash"))

    def migrate_legacy_events(self, challenge_id: str) -> int:
        """Resumably create canonical event files for a JSONL-only challenge.

        A migration marker binds the exact legacy projection before the first event
        file is written. If power is lost midway, the next process verifies the same
        projection and resumes the missing canonical files instead of treating a
        partial directory as complete.
        """

        challenge_id = self.validate_challenge_id(challenge_id)
        event_dir = self.event_files_dir(challenge_id)
        event_dir.mkdir(parents=True, exist_ok=True)
        marker_path = self.legacy_migration_path(challenge_id)
        existing_files = sorted(event_dir.glob("*.json"))

        if marker_path.is_symlink():
            raise IntegrityError("Legacy event migration marker is a symbolic link.")

        marker: dict[str, Any] | None = None
        if marker_path.is_file():
            loaded = read_json(marker_path)
            if not isinstance(loaded, dict):
                raise IntegrityError("Legacy event migration marker is not an object.")
            marker = loaded
        elif existing_files:
            # Canonical evidence already exists and there is no recorded in-flight
            # migration. Never guess that an arbitrary partial set is safe to fill.
            return 0

        events_path = self.events_path(challenge_id)
        projection_bytes = events_path.read_bytes() if events_path.is_file() else b""
        projection_hash = sha256_bytes(projection_bytes)
        events = self._legacy_events(challenge_id)
        self._validate_legacy_events_for_migration(challenge_id, events)

        event_hashes = [str(event.get("event_hash")) for event in events]
        if marker is not None:
            if marker.get("schema_version") != "axm.challenge-legacy-event-migration/0.4":
                raise IntegrityError("Unsupported legacy event migration marker schema.")
            if marker.get("challenge_id") != challenge_id:
                raise IntegrityError("Legacy event migration marker challenge_id mismatch.")
            if marker.get("projection_sha256") != projection_hash:
                raise IntegrityError(
                    "Legacy events projection changed during an interrupted migration."
                )
            if marker.get("event_count") != len(events):
                raise IntegrityError("Legacy migration event count no longer matches projection.")
            if marker.get("event_hashes") != event_hashes:
                raise IntegrityError("Legacy migration event hashes no longer match projection.")
        elif not events:
            return 0
        else:
            marker = {
                "schema_version": "axm.challenge-legacy-event-migration/0.4",
                "challenge_id": challenge_id,
                "projection_sha256": projection_hash,
                "event_count": len(events),
                "event_hashes": event_hashes,
                "created_at": utc_now(),
                "authority_note": (
                    "This marker permits exact resumption only; it is not permission "
                    "to rewrite or invent legacy events."
                ),
            }
            atomic_write_json(marker_path, marker)

        before = {path.name for path in event_dir.glob("*.json")}
        for event in events:
            self._write_event_file(challenge_id, event)
        after = {path.name for path in event_dir.glob("*.json")}
        expected_names = {self._event_file_path(challenge_id, event).name for event in events}
        if after != expected_names:
            raise IntegrityError(
                "Legacy migration produced an unexpected canonical event-file set."
            )
        marker_path.unlink(missing_ok=True)
        fsync_directory(marker_path.parent)
        return len(after - before)

    def read_events(self, challenge_id: str) -> list[dict[str, Any]]:
        self.migrate_legacy_events(challenge_id)
        events: list[dict[str, Any]] = []
        for path in sorted(self.event_files_dir(challenge_id).glob("*.json")):
            value = read_json(path)
            if not isinstance(value, dict):
                raise IntegrityError(f"Canonical event file is not an object: {path.name}")
            events.append(value)
        return events

    def _rebuild_projection(self, challenge_id: str) -> None:
        events = self.read_events(challenge_id)
        payload = "".join(
            json.dumps(event, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
            for event in events
        )
        atomic_write_text(self.events_path(challenge_id), payload)

    def _checkpoint(self, challenge_id: str, event: dict[str, Any], state: dict[str, Any]) -> None:
        if event.get("action") not in CHECKPOINT_ACTIONS:
            return
        destination = self.checkpoint_path(challenge_id, event)
        atomic_write_json(
            destination,
            {
                "schema_version": "axm.challenge-arena-checkpoint/0.4",
                "challenge_id": challenge_id,
                "sequence": event["sequence"],
                "event_hash": event["event_hash"],
                "action": event["action"],
                "semantic_state_hash": semantic_state_hash(state),
                "state": state,
            },
        )

    def _build_event(
        self,
        challenge_id: str,
        state: dict[str, Any],
        *,
        action: str,
        actor: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        core = {
            "sequence": int(state.get("event_sequence", 0)) + 1,
            "timestamp": utc_now(),
            "challenge_id": challenge_id,
            "action": str(action),
            "actor": str(actor),
            "payload": payload,
            "payload_hash": sha256_json(payload),
            "previous_event_hash": state.get("event_head"),
            "state_hash_after": semantic_state_hash(state),
        }
        return {**core, "event_hash": sha256_json(core)}

    def commit(
        self,
        challenge_id: str,
        state: dict[str, Any],
        *,
        action: str,
        actor: str,
        payload: dict[str, Any] | None = None,
        sidecars: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Commit one state transition through a write-ahead recovery journal.

        The caller must hold ``operation_lock`` for the complete load/mutate/commit
        operation. The journal makes the transition idempotently recoverable if a
        process or machine stops between event, state, checkpoint, and projection.
        """
        challenge_id = self.validate_challenge_id(challenge_id)
        if self.pending_path(challenge_id).exists():
            raise IntegrityError(
                f"A pending commit exists for {challenge_id}; recover it before another mutation."
            )
        self.migrate_legacy_events(challenge_id)
        current_events = self.read_events(challenge_id)
        current_head = current_events[-1].get("event_hash") if current_events else None
        if state.get("event_head") != current_head:
            raise IntegrityError(
                "State/event head changed since load; refusing a stale or concurrent commit."
            )

        normalized_sidecars = self._normalize_sidecars(sidecars)
        event_payload = copy.deepcopy(payload or {})
        if normalized_sidecars:
            if "transaction_sidecars" in event_payload:
                raise ValidationError(
                    "transaction_sidecars is reserved for the recoverable commit layer."
                )
            event_payload["transaction_sidecars"] = [
                {
                    "relative_path": item["relative_path"],
                    "mode": item["mode"],
                    "sha256": item["sha256"],
                }
                for item in normalized_sidecars
            ]
        event = self._build_event(
            challenge_id, state, action=action, actor=actor, payload=event_payload
        )
        committed_state = copy.deepcopy(state)
        committed_state["event_sequence"] = event["sequence"]
        committed_state["event_head"] = event["event_hash"]
        committed_state["updated_at"] = event["timestamp"]
        transaction = {
            "schema_version": "axm.challenge-arena-pending-commit/0.2",
            "challenge_id": challenge_id,
            "event": event,
            "state": committed_state,
            "state_hash": sha256_json(committed_state),
            "sidecars": normalized_sidecars,
            "created_at": utc_now(),
        }
        pending = self.pending_path(challenge_id)
        atomic_write_json(pending, transaction)
        self._apply_sidecars(challenge_id, normalized_sidecars)
        self._write_event_file(challenge_id, event)
        self.save(challenge_id, committed_state)
        self._checkpoint(challenge_id, event, committed_state)
        self._rebuild_projection(challenge_id)
        pending.unlink(missing_ok=True)
        fsync_directory(pending.parent)
        state.clear()
        state.update(committed_state)
        return event

    def recover_pending(self, challenge_id: str) -> dict[str, Any] | None:
        """Finish an interrupted semantic transition without changing its contents."""
        challenge_id = self.validate_challenge_id(challenge_id)
        pending = self.pending_path(challenge_id)
        if not pending.is_file():
            self.migrate_legacy_events(challenge_id)
            return None

        transaction = read_json(pending)
        if not isinstance(transaction, dict):
            raise IntegrityError("Pending commit is not an object.")
        event = transaction.get("event")
        target_state = transaction.get("state")
        if not isinstance(event, dict) or not isinstance(target_state, dict):
            raise IntegrityError("Pending commit is missing its event or target state.")
        core = {key: value for key, value in event.items() if key != "event_hash"}
        if sha256_json(core) != event.get("event_hash"):
            raise IntegrityError("Pending commit event hash is invalid.")
        if sha256_json(target_state) != transaction.get("state_hash"):
            raise IntegrityError("Pending commit target-state hash is invalid.")
        if target_state.get("event_head") != event.get("event_hash"):
            raise IntegrityError("Pending target state does not point at its event.")
        if target_state.get("challenge_id") != challenge_id or event.get("challenge_id") != challenge_id:
            raise IntegrityError("Pending commit challenge_id mismatch.")
        if event.get("state_hash_after") != semantic_state_hash(target_state):
            raise IntegrityError("Pending event does not commit the target semantic state.")
        sidecars = self._normalize_sidecars(transaction.get("sidecars", []))
        event_payload = event.get("payload", {})
        event_sidecars = (
            event_payload.get("transaction_sidecars", [])
            if isinstance(event_payload, dict)
            else []
        )
        expected_sidecars = [
            {
                "relative_path": item["relative_path"],
                "mode": item["mode"],
                "sha256": item["sha256"],
            }
            for item in sidecars
        ]
        if event_sidecars != expected_sidecars:
            raise IntegrityError(
                "Pending commit sidecars do not match the sidecar evidence bound into the event."
            )

        self.migrate_legacy_events(challenge_id)
        events = self.read_events(challenge_id)
        head = events[-1].get("event_hash") if events else None
        if head not in {event.get("previous_event_hash"), event.get("event_hash")}:
            raise IntegrityError("Event history moved beyond the pending commit; refusing recovery.")
        self._apply_sidecars(challenge_id, sidecars)
        self._write_event_file(challenge_id, event)

        current = self.load(challenge_id)
        if current.get("event_head") not in {event.get("previous_event_hash"), event.get("event_hash")}:
            raise IntegrityError("Stored state moved beyond the pending commit; refusing recovery.")
        self.save(challenge_id, target_state)
        self._checkpoint(challenge_id, event, target_state)
        self._rebuild_projection(challenge_id)
        pending.unlink(missing_ok=True)
        fsync_directory(pending.parent)
        return {
            "recovered": True,
            "challenge_id": challenge_id,
            "sequence": event.get("sequence"),
            "event_hash": event.get("event_hash"),
            "action": event.get("action"),
        }

    def recover_all(self) -> dict[str, Any]:
        reports: list[dict[str, Any]] = []
        migrated = 0
        for directory in sorted(self.challenges_root.iterdir()):
            if not directory.is_dir() or not (directory / "state.json").is_file():
                continue
            challenge_id = directory.name
            migrated += self.migrate_legacy_events(challenge_id)
            report = self.recover_pending(challenge_id)
            if report:
                reports.append(report)
            self._rebuild_projection(challenge_id)
        return {
            "recovered_count": len(reports),
            "migrated_legacy_event_count": migrated,
            "recoveries": reports,
        }

    def list_summaries(self) -> list[dict[str, Any]]:
        summaries = []
        for state_path in sorted(self.challenges_root.glob("*/state.json")):
            try:
                state = read_json(state_path)
                summaries.append(
                    {
                        "challenge_id": state.get("challenge_id"),
                        "title": state.get("packet", {}).get("title"),
                        "category": state.get("packet", {}).get("category"),
                        "state": state.get("state"),
                        "created_at": state.get("created_at"),
                        "updated_at": state.get("updated_at"),
                        "participant_count": len(state.get("participants", {})),
                        "submission_count": len(
                            [
                                item
                                for item in state.get("submissions", {}).values()
                                if item.get("status") == "ACTIVE"
                            ]
                        ),
                        "provisional_winner": state.get("result", {}).get("provisional_winner"),
                        "parent_challenge_id": state.get("lineage", {}).get("parent_challenge_id"),
                        "followup_count": len(state.get("followups", [])),
                        "pending_commit": (state_path.parent / ".pending-commit.json").is_file(),
                    }
                )
            except Exception:
                continue
        return summaries

    def verify_checkpoints(
        self, challenge_id: str, events: list[dict[str, Any]] | None = None
    ) -> dict[str, Any]:
        """Verify every event-bound checkpoint and reject untracked checkpoint files."""

        challenge_id = self.validate_challenge_id(challenge_id)
        errors: list[str] = []
        warnings: list[str] = []
        events = list(events) if events is not None else self.read_events(challenge_id)
        checkpoint_dir = self.checkpoints_dir(challenge_id)
        if checkpoint_dir.is_symlink():
            return {
                "valid": False,
                "errors": ["checkpoint directory is a symbolic link"],
                "warnings": [],
                "expected_count": 0,
                "verified_count": 0,
                "legacy_unbound_count": 0,
                "unexpected_files": [],
            }
        checkpoint_dir.mkdir(parents=True, exist_ok=True)

        expected_paths: dict[str, dict[str, Any]] = {}
        legacy_unbound = 0
        verified = 0
        for event in events:
            if event.get("action") not in CHECKPOINT_ACTIONS:
                continue
            if event.get("state_hash_after") is None:
                legacy_unbound += 1
                continue
            path = self.checkpoint_path(challenge_id, event)
            expected_paths[path.name] = event
            prefix = f"checkpoint sequence {event.get('sequence')}"
            if path.is_symlink():
                errors.append(f"{prefix}: file is a symbolic link")
                continue
            if not path.is_file():
                errors.append(f"{prefix}: expected checkpoint file is missing")
                continue
            try:
                value = read_json(path)
            except Exception as exc:
                errors.append(
                    f"{prefix}: checkpoint is unreadable: {type(exc).__name__}: {exc}"
                )
                continue
            if not isinstance(value, dict):
                errors.append(f"{prefix}: checkpoint root is not an object")
                continue
            if value.get("schema_version") not in {
                "axm.challenge-arena-checkpoint/0.2",
                "axm.challenge-arena-checkpoint/0.4",
            }:
                errors.append(f"{prefix}: unsupported checkpoint schema")
            for field, expected in (
                ("challenge_id", challenge_id),
                ("sequence", event.get("sequence")),
                ("event_hash", event.get("event_hash")),
                ("action", event.get("action")),
            ):
                if value.get(field) != expected:
                    errors.append(f"{prefix}: {field} does not match its event")
            checkpoint_state = value.get("state")
            if not isinstance(checkpoint_state, dict):
                errors.append(f"{prefix}: embedded state is not an object")
                continue
            computed = semantic_state_hash(checkpoint_state)
            if value.get("semantic_state_hash") != computed:
                errors.append(f"{prefix}: embedded state hash is invalid")
            if computed != event.get("state_hash_after"):
                errors.append(f"{prefix}: embedded state does not match event state_hash_after")
            if checkpoint_state.get("challenge_id") != challenge_id:
                errors.append(f"{prefix}: embedded state challenge_id mismatch")
            if checkpoint_state.get("event_head") != event.get("event_hash"):
                errors.append(f"{prefix}: embedded state event_head mismatch")
            if checkpoint_state.get("event_sequence") != event.get("sequence"):
                errors.append(f"{prefix}: embedded state event_sequence mismatch")
            if checkpoint_state.get("updated_at") != event.get("timestamp"):
                errors.append(f"{prefix}: embedded state updated_at mismatch")
            if not any(item.startswith(prefix) for item in errors):
                verified += 1

        actual_paths = sorted(
            path.name
            for path in checkpoint_dir.iterdir()
            if path.is_file() or path.is_symlink()
        )
        unexpected = sorted(set(actual_paths) - set(expected_paths))
        if unexpected:
            errors.append(f"unexpected checkpoint files: {unexpected}")
        if legacy_unbound:
            warnings.append(
                f"{legacy_unbound} legacy checkpoint action(s) lack state_hash_after and cannot be cryptographically required."
            )
        return {
            "valid": not errors,
            "errors": errors,
            "warnings": warnings,
            "expected_count": len(expected_paths),
            "verified_count": verified,
            "legacy_unbound_count": legacy_unbound,
            "unexpected_files": unexpected,
        }

    def verify_event_chain(self, challenge_id: str) -> dict[str, Any]:
        errors: list[str] = []
        try:
            events = self.read_events(challenge_id)
        except Exception as exc:
            return {
                "valid": False,
                "event_count": 0,
                "errors": [str(exc)],
                "head": None,
                "canonical_event_files": 0,
            }

        previous = None
        for expected_sequence, event in enumerate(events, start=1):
            core = {key: value for key, value in event.items() if key != "event_hash"}
            if event.get("sequence") != expected_sequence:
                errors.append(
                    f"sequence {expected_sequence}: stored sequence is {event.get('sequence')}"
                )
            if event.get("previous_event_hash") != previous:
                errors.append(f"sequence {expected_sequence}: previous hash does not match")
            if event.get("event_hash") != sha256_json(core):
                errors.append(f"sequence {expected_sequence}: event hash does not match")
            if event.get("payload_hash") != sha256_json(event.get("payload", {})):
                errors.append(f"sequence {expected_sequence}: payload hash does not match")
            expected_file = self._event_file_path(challenge_id, event)
            if not expected_file.is_file():
                errors.append(f"sequence {expected_sequence}: canonical event filename mismatch")
            previous = event.get("event_hash")

        state = self.load(challenge_id)
        if state.get("event_head") != previous:
            errors.append("state event_head does not match the final event")
        if int(state.get("event_sequence", 0)) != len(events):
            errors.append("state event_sequence does not match the event count")
        if events and events[-1].get("state_hash_after") is not None:
            if events[-1].get("state_hash_after") != semantic_state_hash(state):
                errors.append("final event state_hash_after does not match current semantic state")

        projection_events = self._legacy_events(challenge_id)
        if projection_events != events:
            errors.append("events.jsonl projection differs from canonical event files")
        if self.pending_path(challenge_id).exists():
            errors.append("pending commit requires recovery")
        if self.legacy_migration_path(challenge_id).exists():
            errors.append("legacy event migration requires recovery")
        checkpoint_report = self.verify_checkpoints(challenge_id, events)
        errors.extend(f"checkpoint: {item}" for item in checkpoint_report["errors"])

        return {
            "valid": not errors,
            "event_count": len(events),
            "errors": errors,
            "head": previous,
            "canonical_event_files": len(events),
            "pending_commit": self.pending_path(challenge_id).exists(),
            "legacy_migration_pending": self.legacy_migration_path(challenge_id).exists(),
            "checkpoints": checkpoint_report,
        }

    def delete_challenge(self, challenge_id: str) -> None:
        directory = self.challenge_dir(challenge_id)
        if directory.exists():
            shutil.rmtree(directory)
