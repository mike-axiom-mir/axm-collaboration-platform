from __future__ import annotations

import copy
import shutil
import threading
from contextlib import contextmanager
from functools import wraps
from pathlib import Path
from typing import Any, Callable, Iterator

from .bundle import build_challenge_bundle
from .blindness import (
    BLIND_ORDER_ALGORITHM_V1,
    BLIND_ORDER_ALGORITHM_V2,
    blind_seed_commitment,
    build_blind_map,
    new_blind_seed,
)
from .contracts import (
    normalize_packet,
    packet_hash,
    rubric_hash,
    validate_submission_manifest,
)
from .deterministic import DeterministicEngine
from .diagnostics import (
    analyze_candidates,
    artifact_set_hash,
    blind_diagnostics,
    diagnostics_semantic_core,
)
from .errors import IntegrityError, StateError, ValidationError
from .merge import build_merge_map
from .models import ChallengeState
from .orchestration import (
    cancel_task as cancel_seat_task,
    claim_task as claim_seat_task,
    complete_task as complete_seat_task,
    ensure_phase_tasks,
    fail_task as fail_seat_task,
    heartbeat_task as heartbeat_seat_task,
    new_lease_id,
    new_lease_token,
    orchestration_report,
    public_orchestration_report,
    public_task,
    reap_expired_tasks,
    task_for,
    task_core,
    task_receipt,
    verify_orchestration_state,
)
from .reports import render_result_markdown
from .review_assignment import build_review_assignments
from .review_evidence import (
    ALLOWED_EVIDENCE_REFERENCE_KINDS,
    normalize_abstentions,
    normalize_evidence_refs,
    normalize_ranking_tiers,
)
from .review_safety import REVIEW_PROTOCOL, REVIEW_PROTOCOL_HASH, scan_review_content
from .receipts import normalize_receipt_results, validate_receipt
from .store import ChallengeStore
from .utils import (
    atomic_write_json,
    ensure_slug,
    portable_name_key,
    pretty_json_text,
    read_json,
    safe_relative_path,
    sha256_bytes,
    sha256_file,
    sha256_json,
    utc_now,
)
from .validators import ValidatorRegistry
from .version import __version__
from .voting import aggregate_votes


def _serialized_read(*, recover: bool = True) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Keep a public read coherent with concurrent Arena writers.

    Reads normally finish an already-recorded pending commit first. Integrity
    verification is the exception: it locks the workspace but deliberately observes
    a pending commit instead of repairing it.
    """

    def decorate(method: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(method)
        def wrapped(
            self: "ChallengeArena",
            challenge_id: str,
            *args: Any,
            **kwargs: Any,
        ) -> Any:
            with self._access(challenge_id, recover=recover):
                return method(self, challenge_id, *args, **kwargs)

        return wrapped

    return decorate


class ChallengeArena:
    """Local-first orchestration module for multi-AI challenge rounds."""

    def __init__(
        self,
        root: str | Path,
        *,
        allow_execution: bool = False,
        validator_registry: ValidatorRegistry | None = None,
        trusted_runner_keys: dict[str, str | bytes] | None = None,
        allow_unsigned_receipts: bool = False,
    ) -> None:
        self.store = ChallengeStore(root)
        self.root = self.store.root
        self.engine = DeterministicEngine(validator_registry, allow_execution=allow_execution)
        self.trusted_runner_keys = dict(trusted_runner_keys or {})
        self.allow_unsigned_receipts = bool(allow_unsigned_receipts)
        self._lock = threading.RLock()
        with self.store.operation_lock():
            self.store.recover_all()

    @contextmanager
    def _access(self, challenge_id: str | None = None, *, recover: bool = True) -> Iterator[None]:
        """Serialize reads/mutations and finish only already-recorded pending commits."""
        with self._lock:
            with self.store.operation_lock():
                if recover and challenge_id and self.store.exists(challenge_id):
                    self.store.recover_pending(challenge_id)
                yield

    def _require_state(self, state: dict[str, Any], *allowed: ChallengeState) -> None:
        allowed_values = {item.value for item in allowed}
        if state.get("state") not in allowed_values:
            raise StateError(
                f"Action requires state in {sorted(allowed_values)}, but challenge is {state.get('state')}."
            )

    def _commit(
        self,
        state: dict[str, Any],
        *,
        action: str,
        actor: str,
        payload: dict[str, Any] | None = None,
        sidecars: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        self.store.commit(
            state["challenge_id"],
            state,
            action=action,
            actor=actor,
            payload=payload or {},
            sidecars=sidecars,
        )
        return state

    @staticmethod
    def _json_sidecar(
        relative_path: str,
        value: Any,
        *,
        mode: str = "replace",
    ) -> dict[str, str]:
        content = pretty_json_text(value)
        return {
            "relative_path": relative_path,
            "mode": mode,
            "content": content,
            "sha256": sha256_bytes(content.encode("utf-8")),
        }

    @staticmethod
    def _text_sidecar(
        relative_path: str,
        content: str,
        *,
        mode: str = "replace",
    ) -> dict[str, str]:
        return {
            "relative_path": relative_path,
            "mode": mode,
            "content": content,
            "sha256": sha256_bytes(content.encode("utf-8")),
        }

    @staticmethod
    def _active_submission(state: dict[str, Any], submission_id: str) -> dict[str, Any]:
        submission = state.get("submissions", {}).get(submission_id)
        if not submission:
            raise ValidationError(f"Unknown submission: {submission_id}")
        if submission.get("status") != "ACTIVE":
            raise ValidationError(f"Submission {submission_id} is not active.")
        return submission

    def _verified_submission_manifest(
        self, state: dict[str, Any], submission_id: str
    ) -> dict[str, Any]:
        """Load a stored submission only after rechecking its immutable evidence.

        This preflight is intentionally used immediately before deterministic execution,
        blind review, external-runner export, and downstream result export. Integrity
        reporting after the fact is not enough when altered bytes could otherwise be used.
        """

        submission = state.get("submissions", {}).get(submission_id)
        if not isinstance(submission, dict):
            raise IntegrityError(f"Unknown stored submission: {submission_id}")
        challenge_id = str(state.get("challenge_id", ""))
        challenge_dir = self.store.challenge_dir(challenge_id).resolve()
        try:
            relative_directory = safe_relative_path(str(submission["relative_directory"]))
        except (KeyError, ValueError) as exc:
            raise IntegrityError(
                f"Submission {submission_id} has an unsafe stored directory."
            ) from exc
        raw_directory = challenge_dir / relative_directory
        current = raw_directory
        while current != challenge_dir:
            if current.is_symlink():
                raise IntegrityError(
                    f"Submission {submission_id} uses a symbolic-link directory."
                )
            parent = current.parent
            if parent == current:
                raise IntegrityError(
                    f"Submission {submission_id} directory is outside the challenge boundary."
                )
            current = parent
        directory = raw_directory.resolve()
        if not directory.is_relative_to(challenge_dir) or not directory.is_dir():
            raise IntegrityError(
                f"Submission {submission_id} directory is missing or escaped the challenge."
            )

        manifest_path = directory / "submission.json"
        if manifest_path.is_symlink() or not manifest_path.is_file():
            raise IntegrityError(f"Submission {submission_id} manifest is missing or symbolic.")
        try:
            manifest = read_json(manifest_path)
        except Exception as exc:
            raise IntegrityError(
                f"Submission {submission_id} manifest is unreadable: {type(exc).__name__}: {exc}"
            ) from exc
        if not isinstance(manifest, dict):
            raise IntegrityError(f"Submission {submission_id} manifest is not an object.")
        if sha256_json(manifest) != submission.get("manifest_hash"):
            raise IntegrityError(f"Submission {submission_id} manifest hash does not match state.")
        if manifest.get("submission_id") != submission_id:
            raise IntegrityError(f"Submission {submission_id} manifest id does not match state.")
        if manifest.get("participant_id") != submission.get("participant_id"):
            raise IntegrityError(
                f"Submission {submission_id} participant identity does not match state."
            )
        if manifest.get("challenge_id") not in {None, challenge_id}:
            raise IntegrityError(f"Submission {submission_id} challenge id does not match state.")
        if manifest.get("content_hash") != submission.get("content_hash"):
            raise IntegrityError(f"Submission {submission_id} content hash does not match state.")
        if state.get("packet", {}).get("participant_policy", {}).get(
            "require_submission_packet_ack", False
        ):
            if manifest.get("packet_hash") != state.get("packet_hash"):
                raise IntegrityError(
                    f"Submission {submission_id} no longer acknowledges the locked packet."
                )
            if manifest.get("rubric_hash") != state.get("rubric_hash"):
                raise IntegrityError(
                    f"Submission {submission_id} no longer acknowledges the locked rubric."
                )

        artifacts_root = directory / "artifacts"
        if artifacts_root.is_symlink() or not artifacts_root.is_dir():
            raise IntegrityError(
                f"Submission {submission_id} artifact root is missing or symbolic."
            )
        artifacts = manifest.get("artifacts")
        if not isinstance(artifacts, list) or not artifacts:
            raise IntegrityError(f"Submission {submission_id} has no declared artifact list.")

        declared_paths: set[str] = set()
        file_evidence: list[dict[str, Any]] = []
        total_bytes = 0
        for artifact in artifacts:
            if not isinstance(artifact, dict):
                raise IntegrityError(f"Submission {submission_id} has a malformed artifact entry.")
            try:
                rel = safe_relative_path(str(artifact["path"]))
            except (KeyError, ValueError) as exc:
                raise IntegrityError(
                    f"Submission {submission_id} contains an unsafe artifact path."
                ) from exc
            rel_text = rel.as_posix()
            if rel_text in declared_paths:
                raise IntegrityError(
                    f"Submission {submission_id} repeats artifact path {rel_text!r}."
                )
            declared_paths.add(rel_text)
            raw_path = artifacts_root / rel
            current = raw_path
            while current != artifacts_root:
                if current.is_symlink():
                    raise IntegrityError(
                        f"Submission {submission_id} contains a symbolic-link artifact: {rel_text}"
                    )
                parent = current.parent
                if parent == current:
                    raise IntegrityError(
                        f"Submission {submission_id} artifact escaped its root: {rel_text}"
                    )
                current = parent
            path = raw_path.resolve()
            if not path.is_relative_to(artifacts_root.resolve()) or not path.is_file():
                raise IntegrityError(
                    f"Submission {submission_id} artifact is missing or escaped its root: {rel_text}"
                )
            size = path.stat().st_size
            digest = sha256_file(path)
            if size != artifact.get("bytes") or digest != artifact.get("sha256"):
                raise IntegrityError(
                    f"Submission {submission_id} artifact evidence changed: {rel_text}"
                )
            total_bytes += size
            file_evidence.append({"path": rel_text, "bytes": size, "sha256": digest})

        actual_paths: set[str] = set()
        for path in sorted(artifacts_root.rglob("*")):
            if path.is_symlink():
                raise IntegrityError(
                    f"Submission {submission_id} contains an undeclared symbolic link: "
                    f"{path.relative_to(artifacts_root).as_posix()}"
                )
            if path.is_file():
                actual_paths.add(path.relative_to(artifacts_root).as_posix())
        if actual_paths != declared_paths:
            added = sorted(actual_paths - declared_paths)
            missing = sorted(declared_paths - actual_paths)
            raise IntegrityError(
                f"Submission {submission_id} artifact tree differs from its manifest; "
                f"undeclared={added}, missing={missing}."
            )

        calculated_set_hash = artifact_set_hash(file_evidence)
        if calculated_set_hash != submission.get("artifact_set_hash"):
            raise IntegrityError(f"Submission {submission_id} artifact-set hash does not match state.")
        if manifest.get("artifact_set_hash") not in {None, calculated_set_hash}:
            raise IntegrityError(
                f"Submission {submission_id} manifest artifact-set hash does not match bytes."
            )
        if len(file_evidence) != int(submission.get("artifact_count", len(file_evidence))):
            raise IntegrityError(f"Submission {submission_id} artifact count does not match state.")
        if total_bytes != int(submission.get("artifact_bytes", total_bytes)):
            raise IntegrityError(f"Submission {submission_id} artifact byte total does not match state.")
        return manifest

    def _verified_sealed_input_root(
        self,
        state: dict[str, Any],
        input_item: dict[str, Any],
    ) -> Path:
        """Return one sealed packet input only after rechecking its exact evidence."""

        challenge_id = str(state.get("challenge_id", ""))
        try:
            input_id = ensure_slug(str(input_item.get("id", "")), "input_id")
        except ValueError as exc:
            raise IntegrityError("Sealed packet input has an unsafe input id.") from exc
        if not input_item.get("seal_receipt_hash"):
            raise IntegrityError(f"Packet input {input_id!r} is not sealed.")
        if input_item.get("artifact_root_scope") != "relative_to_challenge_directory":
            raise IntegrityError(f"Sealed packet input {input_id!r} is not challenge-local.")
        expected_root = (Path("inputs") / input_id / "artifacts").as_posix()
        if input_item.get("artifact_root") != expected_root:
            raise IntegrityError(
                f"Sealed packet input {input_id!r} has an unexpected artifact root."
            )
        try:
            relative_root = safe_relative_path(expected_root)
        except ValueError as exc:
            raise IntegrityError(f"Sealed packet input {input_id!r} has an unsafe root.") from exc
        challenge_dir = self.store.challenge_dir(challenge_id).resolve()
        raw_root = self.store.challenge_dir(challenge_id) / relative_root
        current = raw_root
        while current != self.store.challenge_dir(challenge_id):
            if current.is_symlink():
                raise IntegrityError(
                    f"Sealed packet input {input_id!r} uses a symbolic-link directory."
                )
            parent = current.parent
            if parent == current:
                raise IntegrityError(
                    f"Sealed packet input {input_id!r} escaped its challenge boundary."
                )
            current = parent
        root = raw_root.resolve()
        if not root.is_relative_to(challenge_dir) or not root.is_dir():
            raise IntegrityError(
                f"Sealed packet input {input_id!r} root is missing or escaped the challenge."
            )

        declared = input_item.get("artifact_files")
        if not isinstance(declared, list) or not declared:
            raise IntegrityError(
                f"Sealed packet input {input_id!r} has no declared file evidence."
            )
        declared_paths: set[str] = set()
        file_evidence: list[dict[str, Any]] = []
        for evidence in declared:
            if not isinstance(evidence, dict):
                raise IntegrityError(
                    f"Sealed packet input {input_id!r} has malformed file evidence."
                )
            try:
                relative = safe_relative_path(str(evidence["path"]))
            except (KeyError, ValueError) as exc:
                raise IntegrityError(
                    f"Sealed packet input {input_id!r} has an unsafe artifact path."
                ) from exc
            relative_text = relative.as_posix()
            if relative_text in declared_paths:
                raise IntegrityError(
                    f"Sealed packet input {input_id!r} repeats {relative_text!r}."
                )
            declared_paths.add(relative_text)
            raw_path = root / relative
            current = raw_path
            while current != root:
                if current.is_symlink():
                    raise IntegrityError(
                        f"Sealed packet input {input_id!r} contains a symbolic link: {relative_text}"
                    )
                parent = current.parent
                if parent == current:
                    raise IntegrityError(
                        f"Sealed packet input {input_id!r} artifact escaped its root."
                    )
                current = parent
            path = raw_path.resolve()
            if not path.is_relative_to(root) or not path.is_file():
                raise IntegrityError(
                    f"Sealed packet input {input_id!r} artifact is missing: {relative_text}"
                )
            size = path.stat().st_size
            digest = sha256_file(path)
            if size != evidence.get("bytes") or digest != evidence.get("sha256"):
                raise IntegrityError(
                    f"Sealed packet input {input_id!r} artifact evidence changed: {relative_text}"
                )
            file_evidence.append(
                {"path": relative_text, "bytes": size, "sha256": digest}
            )

        actual_paths: set[str] = set()
        for path in sorted(root.rglob("*")):
            if path.is_symlink():
                raise IntegrityError(
                    f"Sealed packet input {input_id!r} contains an undeclared symbolic link."
                )
            if path.is_file():
                actual_paths.add(path.relative_to(root).as_posix())
        if actual_paths != declared_paths:
            raise IntegrityError(
                f"Sealed packet input {input_id!r} file tree differs from its evidence."
            )
        calculated_set_hash = artifact_set_hash(file_evidence)
        if calculated_set_hash != input_item.get("artifact_set_hash"):
            raise IntegrityError(
                f"Sealed packet input {input_id!r} artifact-set hash changed."
            )

        receipt_path = root.parent / "input-receipt.json"
        if receipt_path.is_symlink() or not receipt_path.is_file():
            raise IntegrityError(
                f"Sealed packet input {input_id!r} receipt is missing or symbolic."
            )
        try:
            receipt = read_json(receipt_path)
        except Exception as exc:
            raise IntegrityError(
                f"Sealed packet input {input_id!r} receipt is unreadable."
            ) from exc
        if not isinstance(receipt, dict):
            raise IntegrityError(
                f"Sealed packet input {input_id!r} receipt is not an object."
            )
        receipt_core = {
            key: value for key, value in receipt.items() if key != "receipt_hash"
        }
        receipt_hash = sha256_json(receipt_core)
        if receipt_hash != receipt.get("receipt_hash") or receipt_hash != input_item.get(
            "seal_receipt_hash"
        ):
            raise IntegrityError(
                f"Sealed packet input {input_id!r} receipt hash changed."
            )
        expected_fields = {
            "challenge_id": challenge_id,
            "input_id": input_id,
            "artifact_root": expected_root,
            "artifact_root_scope": "relative_to_challenge_directory",
            "artifact_files": input_item.get("artifact_files"),
            "artifact_set_hash": calculated_set_hash,
            "sealed_at": input_item.get("sealed_at"),
            "authority": input_item.get("authority"),
        }
        for key, expected in expected_fields.items():
            if receipt.get(key) != expected:
                raise IntegrityError(
                    f"Sealed packet input {input_id!r} receipt differs on {key}."
                )
        return root

    @staticmethod
    def _blind_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
        """Remove direct author/revision metadata before peer review.

        Filenames, prose, style, and artifact contents can still self-identify. This
        helper therefore promises only that the Arena itself does not expose direct
        participant ids, submission ids, timestamps, internal hashes, or detailed
        provenance/source identity in the review manifest.
        """

        public: dict[str, Any] = {
            "schema_version": manifest.get(
                "schema_version", "axm.challenge-submission/0.2"
            ),
            "submission_statement": {
                "hidden_for_blind_review": True,
                "summary_present": bool(str(manifest.get("summary", "")).strip()),
                "claims_declared": bool(manifest.get("claims", {})),
                "note_count": len(manifest.get("notes", []))
                if isinstance(manifest.get("notes", []), list)
                else 0,
                "reason": (
                    "Free-form manifest prose can directly name or strongly identify its author. "
                    "Reviewers receive the artifact set and structural metadata instead."
                ),
            },
            "artifacts": [],
        }
        for artifact in manifest.get("artifacts", []):
            if not isinstance(artifact, dict):
                continue
            provenance = artifact.get("provenance", {})
            if not isinstance(provenance, dict):
                provenance = {}
            public_artifact = {
                key: copy.deepcopy(artifact[key])
                for key in (
                    "path",
                    "deliverable_id",
                    "role",
                    "media_type",
                    "bytes",
                )
                if key in artifact
            }
            source_refs = provenance.get("source_refs", [])
            public_artifact["provenance_summary"] = {
                "declared": bool(provenance),
                "rights_declared": bool(provenance.get("rights")),
                "source_reference_count": len(source_refs)
                if isinstance(source_refs, list)
                else 0,
            }
            public["artifacts"].append(public_artifact)
        return public

    def _receipt_expected(
        self, state: dict[str, Any], submission_id: str, submission: dict[str, Any]
    ) -> dict[str, str]:
        return {
            "challenge_id": state["challenge_id"],
            "submission_id": submission_id,
            "packet_hash": state["packet_hash"],
            "rubric_hash": state["rubric_hash"],
            "submission_content_hash": submission["content_hash"],
            "artifact_set_hash": submission["artifact_set_hash"],
        }

    def _external_receipts_for_submission(
        self, state: dict[str, Any], submission_id: str
    ) -> list[dict[str, Any]]:
        """Reload and bind-check immutable receipts before deterministic scoring.

        HMAC secrets are never written into the workspace. Current states keep only
        a compact receipt index; the immutable receipt and ingest verification live in
        the submission evidence folder. Legacy v0.1-style full-state entries are still
        accepted so old workspaces remain inspectable.
        """

        submission = self._active_submission(state, submission_id)
        expected = self._receipt_expected(state, submission_id, submission)
        loaded: list[dict[str, Any]] = []
        stored_receipts = state.get("external_receipts", {}).get(submission_id, {})
        if not isinstance(stored_receipts, dict):
            raise IntegrityError(f"External receipt index for {submission_id} is malformed.")

        challenge_dir = self.store.challenge_dir(state["challenge_id"])
        for receipt_hash, index in sorted(stored_receipts.items()):
            if not isinstance(index, dict):
                raise IntegrityError(f"External receipt {receipt_hash} is malformed.")
            default_rel = (
                Path(submission["relative_directory"])
                / "external-receipts"
                / f"{receipt_hash}.json"
            ).as_posix()
            relative_path = str(index.get("relative_path") or default_rel)
            try:
                safe = safe_relative_path(relative_path)
            except ValueError as exc:
                raise IntegrityError(
                    f"External receipt index has an unsafe path: {receipt_hash}"
                ) from exc
            path = challenge_dir / safe
            if path.is_symlink() or not path.is_file():
                raise IntegrityError(f"External receipt file is missing: {path.name}")
            if index.get("file_sha256") and sha256_file(path) != index.get("file_sha256"):
                raise IntegrityError(f"External receipt file hash mismatch: {receipt_hash}")

            disk = read_json(path)
            # Legacy entries stored the whole receipt+verification object in state.
            if "relative_path" not in index and sha256_json(disk) != sha256_json(index):
                raise IntegrityError(f"External receipt file differs from legacy state: {receipt_hash}")
            if disk.get("receipt_hash") != receipt_hash:
                raise IntegrityError(f"External receipt index/hash mismatch: {receipt_hash}")

            receipt = {
                key: copy.deepcopy(value)
                for key, value in disk.items()
                if key != "verification"
            }
            signature = receipt.get("signature")
            key_id = signature.get("key_id") if isinstance(signature, dict) else None
            if key_id and key_id in self.trusted_runner_keys:
                validate_receipt(
                    receipt,
                    expected=expected,
                    trusted_keys=self.trusted_runner_keys,
                    allow_unsigned=self.allow_unsigned_receipts,
                )
            elif signature is None:
                validate_receipt(
                    receipt, expected=expected, trusted_keys={}, allow_unsigned=True
                )
                if not self.allow_unsigned_receipts and not disk.get("verification", {}).get(
                    "binding_valid"
                ):
                    raise IntegrityError(
                        f"Unsigned receipt {receipt_hash} lacks recorded ingest validation."
                    )
            else:
                core = {
                    key: copy.deepcopy(value)
                    for key, value in receipt.items()
                    if key not in {"receipt_hash", "signature"}
                }
                if sha256_json(core) != receipt_hash:
                    raise IntegrityError(f"External receipt core hash mismatch: {receipt_hash}")
                for field, wanted in expected.items():
                    if receipt.get(field) != wanted:
                        raise IntegrityError(
                            f"External receipt {receipt_hash} no longer matches {field}."
                        )
                verification = disk.get("verification", {})
                if not (
                    verification.get("signature_present")
                    and verification.get("signature_valid")
                    and verification.get("binding_valid")
                ):
                    raise IntegrityError(
                        f"External receipt {receipt_hash} lacks trusted ingest evidence."
                    )

            if index.get("runner_id") and index.get("runner_id") != receipt.get("runner_id"):
                raise IntegrityError(f"External receipt runner index mismatch: {receipt_hash}")
            result_ids = sorted(
                str(item.get("result_id")) for item in receipt.get("results", [])
            )
            if index.get("result_ids") is not None and sorted(index["result_ids"]) != result_ids:
                raise IntegrityError(f"External receipt result index mismatch: {receipt_hash}")
            runtime_receipt = copy.deepcopy(receipt)
            runtime_receipt["results"] = normalize_receipt_results(
                runtime_receipt.get("results")
            )
            loaded.append(runtime_receipt)
        return loaded

    def create_challenge(self, packet: dict[str, Any], *, actor: str = "human") -> dict[str, Any]:
        normalized = normalize_packet(packet)
        challenge_id = normalized["challenge_id"]
        with self._access(recover=False):
            now = utc_now()
            state = {
                "schema_version": "axm.challenge-arena-state/0.5",
                "challenge_id": challenge_id,
                "state": ChallengeState.DRAFT.value,
                "packet": normalized,
                "packet_hash": packet_hash(normalized),
                "rubric_hash": rubric_hash(normalized),
                "participants": {},
                "submissions": {},
                "participant_active_submission": {},
                "external_receipts": {},
                "test_results": {},
                "candidate_diagnostics": {},
                "blind_candidate_diagnostics": {},
                "blind_map": {},
                "blind_order_algorithm": (
                    BLIND_ORDER_ALGORITHM_V2
                    if normalized.get("schema_version") == "axm.challenge-arena/0.5"
                    else BLIND_ORDER_ALGORITHM_V1
                ),
                "blind_seed_mode": None,
                "blind_seed": None,
                "blind_seed_commitment": None,
                "blind_seed_revealed_at": None,
                "blind_seed_reveal_hash": None,
                "review_assignments": {},
                "review_assignment_report": {},
                "review_content_safety": {},
                "reviews": {},
                "participant_active_review": {},
                "seat_tasks": {},
                "seat_task_index": {},
                "seat_task_plans": {},
                "orchestration_reports": {},
                "result": {},
                "merge_map": {},
                "final_decision": None,
                "lineage": copy.deepcopy(normalized.get("lineage", {})),
                "followups": [],
                "created_at": now,
                "updated_at": now,
                "locked_at": None,
                "locked_participant_roster_hash": None,
                "participant_roster_hash": None,
                "event_sequence": 0,
                "event_head": None,
            }
            self.store.create(challenge_id, state)
            self._commit(
                state,
                action="CHALLENGE_CREATED",
                actor=actor,
                payload={
                    "packet_hash": state["packet_hash"],
                    "rubric_hash": state["rubric_hash"],
                    "title": normalized["title"],
                },
            )
            return copy.deepcopy(state)

    @_serialized_read()
    def submission_contract(self, challenge_id: str, participant_id: str) -> dict[str, Any]:
        """Return the immutable identifiers a submission must acknowledge.

        Keeping this tiny helper in the public API prevents adapters from guessing or
        reconstructing the locked packet/rubric hashes.
        """

        state = self.store.load(challenge_id)
        self._require_state(state, ChallengeState.BUILDING)
        participant = state.get("participants", {}).get(participant_id)
        if not participant or not participant.get("can_submit", True):
            raise ValidationError(f"Participant {participant_id!r} is not an eligible submitter.")
        task = task_for(state, "BUILD", participant_id)
        return {
            "schema_version": "axm.challenge-submission-contract/0.4",
            "challenge_id": challenge_id,
            "participant_id": participant_id,
            "packet_hash": state["packet_hash"],
            "rubric_hash": state["rubric_hash"],
            "participant_roster_hash": state.get("participant_roster_hash", ""),
            "seat_task": task_core(task) if task is not None else None,
        }

    def update_draft_packet(
        self, challenge_id: str, packet: dict[str, Any], *, actor: str = "human"
    ) -> dict[str, Any]:
        """Replace an unlocked draft while preserving both old and new hashes in the event log."""
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            self._require_state(state, ChallengeState.DRAFT)
            normalized = normalize_packet(packet)
            if normalized["challenge_id"] != challenge_id:
                raise ValidationError("A draft update may not change challenge_id.")
            old_packet_hash = state["packet_hash"]
            old_rubric_hash = state["rubric_hash"]
            state["packet"] = normalized
            state["packet_hash"] = packet_hash(normalized)
            state["rubric_hash"] = rubric_hash(normalized)
            self._commit(
                state,
                action="DRAFT_PACKET_REPLACED",
                actor=actor,
                payload={
                    "old_packet_hash": old_packet_hash,
                    "new_packet_hash": state["packet_hash"],
                    "old_rubric_hash": old_rubric_hash,
                    "new_rubric_hash": state["rubric_hash"],
                },
            )
            return copy.deepcopy(state)

    def seal_draft_input(
        self,
        challenge_id: str,
        input_id: str,
        source_path: str | Path,
        *,
        actor: str = "human",
    ) -> dict[str, Any]:
        """Copy one declared draft input into challenge-owned, hash-bound evidence.

        Sealing changes the draft packet hash, so it is intentionally forbidden after
        the challenge is locked. A sealed input cannot be overwritten in place; create
        a new input id to preserve the prior evidence branch.
        """

        try:
            clean_input_id = ensure_slug(input_id, "input_id")
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        raw_source = Path(source_path).expanduser()
        if raw_source.is_symlink():
            raise ValidationError("Input source may not itself be a symbolic link.")
        source = raw_source.resolve()
        if not source.exists() or not (source.is_file() or source.is_dir()):
            raise ValidationError(f"Input source does not exist or is unsupported: {source}")

        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            self._require_state(state, ChallengeState.DRAFT)
            inputs = state.get("packet", {}).get("inputs", [])
            input_item = next(
                (
                    item
                    for item in inputs
                    if isinstance(item, dict) and str(item.get("id")) == clean_input_id
                ),
                None,
            )
            if input_item is None:
                raise ValidationError(
                    f"Draft packet has no declared input with id {clean_input_id!r}."
                )
            if input_item.get("seal_receipt_hash"):
                raise ValidationError(
                    f"Input {clean_input_id!r} is already sealed. Add a new input id for a revision."
                )

            challenge_dir = self.store.challenge_dir(challenge_id).resolve()
            if source == challenge_dir or source.is_relative_to(challenge_dir):
                raise ValidationError("Input source may not be inside the challenge it is sealing into.")

            policy = state["packet"].get("participant_policy", {})
            max_files = int(policy.get("max_artifacts_per_submission", 10_000))
            max_single = int(policy.get("max_single_artifact_bytes", 2 * 1024**3))
            max_total = int(policy.get("max_total_artifact_bytes", 8 * 1024**3))
            source_files: list[tuple[Path, Path]] = []
            if source.is_file():
                source_files.append((source, Path(source.name)))
            else:
                for candidate in sorted(source.rglob("*")):
                    if candidate.is_symlink():
                        raise ValidationError(
                            f"Input source contains a symbolic link: {candidate.relative_to(source).as_posix()}"
                        )
                    if candidate.is_file():
                        source_files.append((candidate, candidate.relative_to(source)))
            if not source_files:
                raise ValidationError("Input source contains no files to seal.")
            if len(source_files) > max_files:
                raise ValidationError(
                    f"Input contains {len(source_files)} files; challenge limit is {max_files}."
                )

            final_base = challenge_dir / "inputs" / clean_input_id
            staging = challenge_dir / f".input-seal-{clean_input_id}.staging"
            if final_base.exists() or staging.exists():
                raise IntegrityError(
                    f"Sealed input destination unexpectedly exists for {clean_input_id!r}."
                )
            artifact_root = staging / "artifacts"
            file_evidence: list[dict[str, Any]] = []
            total_bytes = 0
            moved_to_final = False
            try:
                for source_file, rel in source_files:
                    try:
                        safe_rel = safe_relative_path(rel.as_posix())
                    except ValueError as exc:
                        raise ValidationError(
                            f"Input source contains an unsafe relative path: {rel.as_posix()}"
                        ) from exc
                    size = source_file.stat().st_size
                    if size > max_single:
                        raise ValidationError(
                            f"Input file {safe_rel.as_posix()!r} is {size} bytes; limit is {max_single}."
                        )
                    total_bytes += size
                    if total_bytes > max_total:
                        raise ValidationError(
                            f"Input files total more than the challenge limit of {max_total} bytes."
                        )
                    digest = sha256_file(source_file)
                    target = artifact_root / safe_rel
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(source_file, target)
                    if target.stat().st_size != size or sha256_file(target) != digest:
                        raise IntegrityError(
                            f"Input changed while being sealed: {safe_rel.as_posix()}"
                        )
                    file_evidence.append(
                        {"path": safe_rel.as_posix(), "bytes": size, "sha256": digest}
                    )

                set_hash = artifact_set_hash(file_evidence)
                sealed_at = utc_now()
                relative_artifact_root = (
                    Path("inputs") / clean_input_id / "artifacts"
                ).as_posix()
                receipt_core = {
                    "schema_version": "axm.challenge-input-receipt/0.2",
                    "challenge_id": challenge_id,
                    "input_id": clean_input_id,
                    "artifact_root": relative_artifact_root,
                    "artifact_root_scope": "relative_to_challenge_directory",
                    "artifact_files": copy.deepcopy(file_evidence),
                    "artifact_set_hash": set_hash,
                    "sealed_at": sealed_at,
                    "authority": "locked-source-evidence-not-output-approval",
                }
                receipt = {**receipt_core, "receipt_hash": sha256_json(receipt_core)}
                atomic_write_json(staging / "input-receipt.json", receipt)
                final_base.parent.mkdir(parents=True, exist_ok=True)
                staging.replace(final_base)
                moved_to_final = True

                old_packet_hash = state["packet_hash"]
                input_item.pop("path", None)
                input_item.pop("source_path", None)
                input_item.update(
                    {
                        "source_name": source.name,
                        "artifact_root": relative_artifact_root,
                        "artifact_root_scope": "relative_to_challenge_directory",
                        "artifact_files": copy.deepcopy(file_evidence),
                        "artifact_set_hash": set_hash,
                        "sealed_at": sealed_at,
                        "seal_receipt_hash": receipt["receipt_hash"],
                        "portable": True,
                        "authority": "locked-source-evidence-not-output-approval",
                    }
                )
                state["packet_hash"] = packet_hash(state["packet"])
                try:
                    self._commit(
                        state,
                        action="DRAFT_INPUT_SEALED",
                        actor=actor,
                        payload={
                            "input_id": clean_input_id,
                            "old_packet_hash": old_packet_hash,
                            "new_packet_hash": state["packet_hash"],
                            "artifact_count": len(file_evidence),
                            "artifact_bytes": total_bytes,
                            "artifact_set_hash": set_hash,
                            "receipt_hash": receipt["receipt_hash"],
                            "receipt_file_sha256": sha256_file(
                                final_base / "input-receipt.json"
                            ),
                        },
                    )
                except Exception:
                    if not self.store.pending_path(challenge_id).exists():
                        shutil.rmtree(final_base, ignore_errors=True)
                    raise
            except Exception:
                shutil.rmtree(staging, ignore_errors=True)
                if moved_to_final and not self.store.pending_path(challenge_id).exists():
                    shutil.rmtree(final_base, ignore_errors=True)
                raise

            return {
                "challenge_id": challenge_id,
                "input": copy.deepcopy(input_item),
                "packet_hash": state["packet_hash"],
                "receipt": receipt,
            }

    def register_participant(
        self,
        challenge_id: str,
        participant_id: str,
        *,
        display_name: str | None = None,
        adapter: str = "filesystem",
        capabilities: list[str] | None = None,
        can_submit: bool = True,
        can_review: bool = True,
        review_required: bool | None = None,
        independence_group: str | None = None,
        metadata: dict[str, Any] | None = None,
        actor: str = "human",
    ) -> dict[str, Any]:
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            self._require_state(state, ChallengeState.DRAFT, ChallengeState.BUILDING)
            is_late = state.get("state") == ChallengeState.BUILDING.value
            if is_late and not state["packet"]["participant_policy"].get("allow_late_registration", False):
                raise ValidationError(
                    "Participant registration is sealed after challenge lock. Enable allow_late_registration explicitly before locking to override this fairness boundary."
                )
            try:
                participant_id = ensure_slug(participant_id, "participant_id")
            except ValueError as exc:
                raise ValidationError(str(exc)) from exc
            collision_key = portable_name_key(participant_id)
            existing_collision = next(
                (
                    existing_id
                    for existing_id in state["participants"]
                    if portable_name_key(existing_id) == collision_key
                ),
                None,
            )
            if existing_collision is not None:
                raise ValidationError(
                    f"Participant {participant_id!r} collides with existing portable participant id {existing_collision!r}."
                )
            if review_required is None:
                review_required = can_review
            if review_required and not can_review:
                raise ValidationError("A participant cannot have review_required=true while can_review=false.")
            if metadata is not None and not isinstance(metadata, dict):
                raise ValidationError("participant metadata must be an object.")
            if independence_group is not None:
                try:
                    independence_group = ensure_slug(
                        independence_group, "independence_group"
                    )
                except ValueError as exc:
                    raise ValidationError(str(exc)) from exc
            clean_capabilities = []
            for capability in capabilities or []:
                if not isinstance(capability, str) or not capability.strip():
                    raise ValidationError("participant capabilities must be non-empty strings.")
                clean_capabilities.append(capability.strip())
            participant = {
                "participant_id": participant_id,
                "display_name": str(display_name or participant_id).strip() or participant_id,
                "adapter": str(adapter).strip() or "filesystem",
                "capabilities": sorted(set(clean_capabilities)),
                "can_submit": bool(can_submit),
                "can_review": bool(can_review),
                "review_required": bool(review_required),
                "independence_group": independence_group,
                "metadata": metadata or {},
                "registered_at": utc_now(),
            }
            old_roster_hash = state.get("participant_roster_hash")
            state["participants"][participant_id] = participant
            sidecars: list[dict[str, Any]] = []
            task_plan: dict[str, Any] | None = None
            if is_late:
                state["participant_roster_hash"] = sha256_json(state["participants"])
                if state["packet"].get("orchestration_policy", {}).get(
                    "enabled", True
                ):
                    task_plan = ensure_phase_tasks(state, "BUILD")
                    sidecars.append(
                        self._json_sidecar(
                            "orchestration/build-task-plan.json", task_plan
                        )
                    )
            self._commit(
                state,
                action="LATE_PARTICIPANT_REGISTERED" if is_late else "PARTICIPANT_REGISTERED",
                actor=actor,
                payload={
                    "participant_id": participant_id,
                    "adapter": adapter,
                    "can_submit": can_submit,
                    "can_review": can_review,
                    "independence_group": independence_group,
                    "late_registration": is_late,
                    "old_roster_hash": old_roster_hash if is_late else None,
                    "new_roster_hash": state.get("participant_roster_hash") if is_late else None,
                    "build_task_plan_hash": (
                        task_plan.get("task_plan_hash") if task_plan else None
                    ),
                },
                sidecars=sidecars,
            )
            return copy.deepcopy(participant)

    def lock_challenge(self, challenge_id: str, *, actor: str = "human") -> dict[str, Any]:
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            self._require_state(state, ChallengeState.DRAFT)
            state["packet"] = normalize_packet(state["packet"])
            minimum = int(state["packet"]["participant_policy"].get("minimum_participants", 2))
            eligible_submitters = sorted(
                participant_id
                for participant_id, participant in state["participants"].items()
                if participant.get("can_submit", True)
            )
            if len(eligible_submitters) < minimum:
                raise ValidationError(
                    f"Need at least {minimum} registered submitting participants before lock; found {len(eligible_submitters)}."
                )
            state["packet_hash"] = packet_hash(state["packet"])
            state["rubric_hash"] = rubric_hash(state["packet"])
            state["participant_roster_hash"] = sha256_json(state["participants"])
            state["locked_participant_roster_hash"] = state["participant_roster_hash"]
            state["blind_order_algorithm"] = (
                BLIND_ORDER_ALGORITHM_V2
                if state["packet"].get("schema_version") == "axm.challenge-arena/0.5"
                else BLIND_ORDER_ALGORITHM_V1
            )
            state["blind_seed_mode"] = state["packet"].get(
                "blind_order_policy", {}
            ).get("mode", "sealed_random")
            if state["blind_seed_mode"] == "sealed_random":
                state["blind_seed"] = new_blind_seed()
            else:
                # Deterministic mode is explicit evidence for reproducible fixtures
                # and audits.  Production v0.4 packets default to sealed randomness.
                state["blind_seed"] = sha256_json(
                    {
                        "deterministic_blind_seed": True,
                        "challenge_id": challenge_id,
                        "packet_hash": state["packet_hash"],
                        "participant_roster_hash": state[
                            "locked_participant_roster_hash"
                        ],
                    }
                )
            state["blind_seed_commitment"] = blind_seed_commitment(
                challenge_id,
                state["blind_seed"],
                algorithm=state["blind_order_algorithm"],
            )
            state["locked_at"] = utc_now()
            state["state"] = ChallengeState.BUILDING.value
            build_task_plan: dict[str, Any] | None = None
            orchestration_sidecars: list[dict[str, Any]] = []
            if state["packet"].get("orchestration_policy", {}).get("enabled", False):
                build_task_plan = ensure_phase_tasks(
                    state, "BUILD", now=state["locked_at"]
                )
                orchestration_sidecars.append(
                    self._json_sidecar(
                        "orchestration/build-task-plan.json", build_task_plan
                    )
                )
            locked_path = self.store.challenge_dir(challenge_id) / "packet.locked.json"
            locked_packet = {
                "packet": state["packet"],
                "packet_hash": state["packet_hash"],
                "rubric_hash": state["rubric_hash"],
                "participant_roster_hash": state["locked_participant_roster_hash"],
                "registered_participants": sorted(state["participants"]),
                "blind_order_algorithm": state["blind_order_algorithm"],
                "blind_seed_mode": state["blind_seed_mode"],
                "blind_seed_commitment": state["blind_seed_commitment"],
                "locked_at": state["locked_at"],
                "build_task_plan_hash": (
                    build_task_plan.get("task_plan_hash")
                    if build_task_plan
                    else None
                ),
            }
            # Write the immutable sidecar before the recoverable semantic commit. If
            # power is lost after the journal appears, recovery has every required byte.
            atomic_write_json(locked_path, locked_packet)
            try:
                self._commit(
                    state,
                    action="CHALLENGE_LOCKED",
                    actor=actor,
                    payload={
                        "packet_hash": state["packet_hash"],
                        "rubric_hash": state["rubric_hash"],
                        "participant_roster_hash": state["locked_participant_roster_hash"],
                        "registered_participants": sorted(state["participants"]),
                        "eligible_submitters": eligible_submitters,
                        "blind_order_algorithm": state["blind_order_algorithm"],
                        "blind_seed_mode": state["blind_seed_mode"],
                        "blind_seed_commitment": state["blind_seed_commitment"],
                        "build_task_plan_hash": (
                            build_task_plan.get("task_plan_hash")
                            if build_task_plan
                            else None
                        ),
                        "build_task_count": (
                            build_task_plan.get("task_count")
                            if build_task_plan
                            else 0
                        ),
                        "locked_packet_file_sha256": sha256_file(locked_path),
                    },
                    sidecars=orchestration_sidecars,
                )
            except Exception:
                if not self.store.pending_path(challenge_id).exists():
                    locked_path.unlink(missing_ok=True)
                raise
            return copy.deepcopy(state)

    def submit(
        self,
        challenge_id: str,
        participant_id: str,
        source_dir: str | Path,
        manifest: dict[str, Any],
        *,
        replace: bool = False,
        expected_previous_submission_id: str | None = None,
        task_token: str | None = None,
        task_usage: dict[str, Any] | None = None,
        actor: str | None = None,
    ) -> dict[str, Any]:
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            self._require_state(state, ChallengeState.BUILDING)
            policy = state["packet"]["participant_policy"]
            participant = state["participants"].get(participant_id)
            if not participant:
                raise ValidationError(f"Unknown participant: {participant_id}")
            if not participant.get("can_submit", True):
                raise ValidationError(f"Participant {participant_id} is not allowed to submit.")
            active_old = state["participant_active_submission"].get(participant_id)
            if active_old and not replace:
                raise ValidationError(
                    f"Participant {participant_id} already has an active submission. Use replace=True to create an explicit revision."
                )
            if policy.get("require_revision_precondition", False):
                if active_old:
                    if expected_previous_submission_id != active_old:
                        raise ValidationError(
                            "Submission revision precondition failed: expected_previous_submission_id "
                            f"must equal the current active submission {active_old!r}. Reload state before replacing."
                        )
                elif expected_previous_submission_id is not None:
                    raise ValidationError(
                        "Submission revision precondition failed: no active submission exists, "
                        "so expected_previous_submission_id must be omitted."
                    )

            source_root = Path(source_dir).expanduser().resolve()
            if not source_root.is_dir():
                raise ValidationError(f"Submission source directory does not exist: {source_root}")
            normalized_manifest = validate_submission_manifest(manifest, participant_id)
            if policy.get("require_submission_packet_ack", False):
                if normalized_manifest.get("challenge_id") != challenge_id:
                    raise ValidationError(
                        "Submission must acknowledge the locked challenge_id in its manifest."
                    )
                if normalized_manifest.get("packet_hash") != state["packet_hash"]:
                    raise ValidationError(
                        "Submission packet_hash does not acknowledge the locked challenge packet."
                    )
                if normalized_manifest.get("rubric_hash") != state["rubric_hash"]:
                    raise ValidationError(
                        "Submission rubric_hash does not acknowledge the locked rubric."
                    )
            artifact_limit = int(policy.get("max_artifacts_per_submission", 10_000))
            if len(normalized_manifest["artifacts"]) > artifact_limit:
                raise ValidationError(
                    f"Submission declares {len(normalized_manifest['artifacts'])} artifacts; limit is {artifact_limit}."
                )
            deliverables = {item["id"]: item for item in state["packet"]["deliverables"]}
            for artifact in normalized_manifest["artifacts"]:
                deliverable_id = artifact.get("deliverable_id")
                if deliverable_id is not None and deliverable_id not in deliverables:
                    raise ValidationError(
                        f"Artifact {artifact.get('path')!r} references unknown deliverable_id {deliverable_id!r}."
                    )
                if deliverable_id is not None:
                    allowed_types = set(deliverables[deliverable_id].get("accepted_media_types", []))
                    media_type = artifact.get("media_type", "application/octet-stream")
                    if allowed_types and "application/octet-stream" not in allowed_types and media_type not in allowed_types:
                        raise ValidationError(
                            f"Artifact {artifact.get('path')!r} declares media_type {media_type!r}; "
                            f"deliverable {deliverable_id!r} accepts {sorted(allowed_types)}."
                        )

            deliverable_counts: dict[str, int] = {deliverable_id: 0 for deliverable_id in deliverables}
            for artifact in normalized_manifest["artifacts"]:
                deliverable_id = artifact.get("deliverable_id")
                if deliverable_id in deliverable_counts:
                    deliverable_counts[deliverable_id] += 1
            for deliverable_id, deliverable in deliverables.items():
                count = deliverable_counts[deliverable_id]
                minimum = int(deliverable.get("minimum_artifacts", 1 if deliverable.get("required", True) else 0))
                maximum = deliverable.get("maximum_artifacts")
                if count < minimum:
                    raise ValidationError(
                        f"Deliverable {deliverable_id!r} requires at least {minimum} artifact(s); found {count}."
                    )
                if maximum is not None and count > int(maximum):
                    raise ValidationError(
                        f"Deliverable {deliverable_id!r} allows at most {maximum} artifact(s); found {count}."
                    )

            file_evidence = []
            resolved_sources: list[Path] = []
            total_bytes = 0
            max_single_bytes = int(policy.get("max_single_artifact_bytes", 2 * 1024**3))
            max_total_bytes = int(policy.get("max_total_artifact_bytes", 8 * 1024**3))
            reject_symlinks = bool(policy.get("reject_symlinks", True))
            for artifact in normalized_manifest["artifacts"]:
                try:
                    rel = safe_relative_path(artifact["path"])
                except ValueError as exc:
                    raise ValidationError(str(exc)) from exc
                unresolved_source = source_root / rel
                if reject_symlinks:
                    current = unresolved_source
                    while current != source_root:
                        if current.is_symlink():
                            raise ValidationError(
                                f"Declared artifact uses a symbolic link, which this challenge rejects: {rel.as_posix()}"
                            )
                        current = current.parent
                source = unresolved_source.resolve()
                if not source.is_relative_to(source_root) or not source.is_file():
                    raise ValidationError(f"Declared artifact is missing or escapes source_dir: {rel.as_posix()}")
                size = source.stat().st_size
                if size > max_single_bytes:
                    raise ValidationError(
                        f"Artifact {rel.as_posix()!r} is {size} bytes; per-artifact limit is {max_single_bytes}."
                    )
                total_bytes += size
                if total_bytes > max_total_bytes:
                    raise ValidationError(
                        f"Submission artifacts total more than {max_total_bytes} bytes."
                    )
                file_evidence.append(
                    {
                        "path": rel.as_posix(),
                        "bytes": size,
                        "sha256": sha256_file(source),
                    }
                )
                resolved_sources.append(source)

            content_hash = sha256_json(
                {
                    "participant_id": participant_id,
                    "manifest": normalized_manifest,
                    "files": file_evidence,
                }
            )
            artifact_digest = artifact_set_hash(file_evidence)
            sequence_hint = int(state.get("event_sequence", 0)) + 1
            submission_id = f"sub-{content_hash[:12]}-{sequence_hint:04d}"
            build_task: dict[str, Any] | None = None
            orchestration_enabled = state["packet"].get(
                "orchestration_policy", {}
            ).get("enabled", False)
            if orchestration_enabled:
                build_task = task_for(state, "BUILD", participant_id)
                if build_task is None:
                    raise IntegrityError(
                        f"Missing locked BUILD task for participant {participant_id!r}."
                    )
                # Validate the lease/usage transition on a detached copy before
                # copying any artifact bytes.  The real task is changed only in
                # the same recoverable commit as the submission record.
                complete_seat_task(
                    copy.deepcopy(build_task),
                    output_kind="submission",
                    output_id=submission_id,
                    output_hash=content_hash,
                    actor=actor or participant_id,
                    token=task_token,
                    usage=task_usage,
                    direct_authority=bool(active_old),
                )
            destination = self.store.challenge_dir(challenge_id) / "submissions" / submission_id
            if destination.exists():
                raise IntegrityError(f"Submission destination unexpectedly exists: {submission_id}")
            artifacts_root = destination / "artifacts"
            artifacts_root.mkdir(parents=True)
            try:
                for artifact, evidence, source in zip(
                    normalized_manifest["artifacts"], file_evidence, resolved_sources
                ):
                    rel = safe_relative_path(artifact["path"])
                    target = artifacts_root / rel
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(source, target)
                    copied_size = target.stat().st_size
                    copied_hash = sha256_file(target)
                    if copied_size != evidence["bytes"] or copied_hash != evidence["sha256"]:
                        raise IntegrityError(
                            f"Artifact changed while being copied: {rel.as_posix()}"
                        )
                    artifact["bytes"] = evidence["bytes"]
                    artifact["sha256"] = copied_hash
                normalized_manifest["submission_id"] = submission_id
                normalized_manifest["submitted_at"] = utc_now()
                normalized_manifest["content_hash"] = content_hash
                normalized_manifest["artifact_set_hash"] = artifact_digest
                atomic_write_json(destination / "submission.json", normalized_manifest)
            except Exception:
                shutil.rmtree(destination, ignore_errors=True)
                raise

            try:
                if active_old:
                    state["submissions"][active_old]["status"] = "SUPERSEDED"
                    state["submissions"][active_old]["superseded_by"] = submission_id
                submission_record = {
                    "submission_id": submission_id,
                    "participant_id": participant_id,
                    "status": "ACTIVE",
                    "supersedes": active_old,
                    "superseded_by": None,
                    "submitted_at": normalized_manifest["submitted_at"],
                    "content_hash": content_hash,
                    "artifact_set_hash": artifact_digest,
                    "manifest_hash": sha256_json(normalized_manifest),
                    "artifact_count": len(file_evidence),
                    "artifact_bytes": total_bytes,
                    "relative_directory": f"submissions/{submission_id}",
                }
                state["submissions"][submission_id] = submission_record
                state["participant_active_submission"][participant_id] = submission_id
                task_sidecars: list[dict[str, Any]] = []
                task_receipt_value: dict[str, Any] | None = None
                if build_task is not None:
                    complete_seat_task(
                        build_task,
                        output_kind="submission",
                        output_id=submission_id,
                        output_hash=content_hash,
                        actor=actor or participant_id,
                        token=task_token,
                        usage=task_usage,
                        direct_authority=bool(active_old),
                    )
                    task_receipt_value = task_receipt(build_task)
                    task_sidecars.append(
                        self._json_sidecar(
                            (
                                "orchestration/receipts/"
                                f"{build_task['task_id']}-{submission_id}.json"
                            ),
                            task_receipt_value,
                            mode="immutable",
                        )
                    )
                self._commit(
                    state,
                    action="SUBMISSION_RECORDED" if not active_old else "SUBMISSION_REVISED",
                    actor=actor or participant_id,
                    payload={
                        "participant_id": participant_id,
                        "submission_id": submission_id,
                        "content_hash": content_hash,
                        "artifact_set_hash": submission_record["artifact_set_hash"],
                        "manifest_hash": submission_record["manifest_hash"],
                        "supersedes": active_old,
                        "artifact_count": len(file_evidence),
                        "artifact_bytes": total_bytes,
                        "seat_task_id": (
                            build_task.get("task_id") if build_task else None
                        ),
                        "seat_task_receipt_hash": (
                            task_receipt_value.get("receipt_hash")
                            if task_receipt_value
                            else None
                        ),
                        "seat_task_budget_signals": (
                            build_task.get("completed_output", {})
                            .get("budget_evaluation", {})
                            .get("signals", [])
                            if build_task
                            else []
                        ),
                    },
                    sidecars=task_sidecars,
                )
            except Exception:
                # If no recovery journal exists, the semantic transition never
                # became recoverable and the copied submission is only an orphan.
                # Preserve it when a pending commit exists because recovery needs
                # the exact bytes already bound into the target state.
                if not self.store.pending_path(challenge_id).exists():
                    shutil.rmtree(destination, ignore_errors=True)
                raise
            return copy.deepcopy(submission_record)

    def attach_external_receipt(
        self,
        challenge_id: str,
        submission_id: str,
        receipt: dict[str, Any],
        *,
        actor: str = "external-runner-import",
    ) -> dict[str, Any]:
        """Attach a cryptographically bound result from a trusted external test runner.

        The receipt can add deterministic evidence for tools the Arena cannot run locally,
        but it cannot change the locked packet or the submitted artifact bytes.
        """
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            self._require_state(
                state, ChallengeState.BUILDING, ChallengeState.SUBMISSIONS_CLOSED
            )
            submission = state.get("submissions", {}).get(submission_id)
            if not submission or submission.get("status") != "ACTIVE":
                raise ValidationError(
                    f"External receipts may only target an active submission: {submission_id!r}."
                )
            verified = validate_receipt(
                receipt,
                expected={
                    "challenge_id": challenge_id,
                    "submission_id": submission_id,
                    "packet_hash": state["packet_hash"],
                    "rubric_hash": state["rubric_hash"],
                    "submission_content_hash": submission["content_hash"],
                    "artifact_set_hash": submission["artifact_set_hash"],
                },
                trusted_keys=self.trusted_runner_keys,
                allow_unsigned=self.allow_unsigned_receipts,
            )
            normalized = copy.deepcopy(verified["receipt"])
            receipt_hash = normalized["receipt_hash"]
            bucket = state.setdefault("external_receipts", {}).setdefault(submission_id, {})
            existing = bucket.get(receipt_hash)
            receipt_dir = (
                self.store.challenge_dir(challenge_id)
                / submission["relative_directory"]
                / "external-receipts"
            )
            receipt_path = receipt_dir / f"{receipt_hash}.json"
            if existing is not None:
                disk = (
                    read_json(receipt_path)
                    if receipt_path.is_file()
                    else None
                )
                return {
                    "receipt": copy.deepcopy(disk or normalized),
                    "index": copy.deepcopy(existing),
                    "status": "UNCHANGED",
                }

            stored = {
                **normalized,
                "verification": {
                    "verified_at": utc_now(),
                    "signature_present": verified["signature_present"],
                    "signature_valid": verified["signature_valid"],
                    "signature_key_id": verified["signature_key_id"],
                    "binding_valid": True,
                },
            }
            relative_path = receipt_path.relative_to(
                self.store.challenge_dir(challenge_id)
            ).as_posix()
            receipt_sidecar = self._json_sidecar(
                relative_path, stored, mode="immutable"
            )
            index = {
                "receipt_hash": receipt_hash,
                "runner_id": normalized.get("runner_id"),
                "relative_path": relative_path,
                "file_sha256": receipt_sidecar["sha256"],
                "attached_at": utc_now(),
                "signature_present": verified["signature_present"],
                "signature_valid_at_ingest": verified["signature_valid"],
                "signature_key_id": verified["signature_key_id"],
                "binding_valid_at_ingest": True,
                "result_ids": sorted(
                    str(item.get("result_id")) for item in normalized.get("results", [])
                ),
            }
            bucket[receipt_hash] = index
            self._commit(
                state,
                action="EXTERNAL_RECEIPT_ATTACHED",
                actor=actor,
                payload={
                    "submission_id": submission_id,
                    "receipt_hash": receipt_hash,
                    "runner_id": normalized.get("runner_id"),
                    "signature_present": verified["signature_present"],
                    "signature_valid": verified["signature_valid"],
                    "result_ids": sorted(
                        item.get("result_id") for item in normalized.get("results", [])
                    ),
                    "receipt_file_sha256": index["file_sha256"],
                },
                sidecars=[receipt_sidecar],
            )
            return {
                "receipt": copy.deepcopy(stored),
                "index": copy.deepcopy(index),
                "status": "ATTACHED",
            }

    @_serialized_read()
    def external_runner_job(self, challenge_id: str, submission_id: str) -> dict[str, Any]:
        """Return a portable, hash-bound job packet for an external deterministic runner."""

        state = self.store.load(challenge_id)
        self._require_state(
            state, ChallengeState.BUILDING, ChallengeState.SUBMISSIONS_CLOSED
        )
        submission = self._active_submission(state, submission_id)
        manifest = self._verified_submission_manifest(state, submission_id)
        external_checks = [
            copy.deepcopy(check)
            for check in state["packet"].get("deterministic_checks", [])
            if check.get("kind") == "external_receipt"
        ]
        return {
            "schema_version": "axm.external-runner-job/0.2",
            "challenge_id": challenge_id,
            "submission_id": submission_id,
            "packet_hash": state["packet_hash"],
            "rubric_hash": state["rubric_hash"],
            "submission_content_hash": submission["content_hash"],
            "artifact_set_hash": submission["artifact_set_hash"],
            "artifact_root": f"{submission['relative_directory']}/artifacts",
            "artifact_root_scope": "relative_to_challenge_directory",
            "manifest": manifest,
            "requested_results": external_checks,
            "receipt_schema_version": "axm.deterministic-receipt/0.2",
            "authority_boundary": (
                "The runner reports measurements only. The Arena verifies binding and "
                "signature; neither the runner nor the Arena may silently approve a merge."
            ),
        }

    def close_submissions(self, challenge_id: str, *, actor: str = "human") -> dict[str, Any]:
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            self._require_state(state, ChallengeState.BUILDING)
            active = [
                item for item in state["submissions"].values() if item.get("status") == "ACTIVE"
            ]
            minimum = int(state["packet"]["participant_policy"].get("minimum_participants", 2))
            unique_submitters = {item["participant_id"] for item in active}
            if len(unique_submitters) < minimum:
                raise ValidationError(
                    f"Need at least {minimum} active submitting participants; found {len(unique_submitters)}."
                )
            verified_manifests: dict[str, dict[str, Any]] = {}
            for submission in active:
                submission_id = submission["submission_id"]
                verified_manifests[submission_id] = self._verified_submission_manifest(
                    state, submission_id
                )
            state["candidate_diagnostics"] = analyze_candidates(
                state,
                self.store.challenge_dir(challenge_id),
                manifests=verified_manifests,
            )
            diagnostics_sidecar = self._json_sidecar(
                "reports/candidate-diagnostics.private.json",
                state["candidate_diagnostics"],
            )
            orchestration_sidecars: list[dict[str, Any]] = []
            build_orchestration: dict[str, Any] | None = None
            reaped_tasks: list[dict[str, Any]] = []
            if state["packet"].get("orchestration_policy", {}).get(
                "enabled", True
            ):
                reaped_tasks = reap_expired_tasks(state)
                build_orchestration = orchestration_report(state, phase="BUILD")
                state.setdefault("orchestration_reports", {})[
                    "BUILD"
                ] = build_orchestration
                orchestration_sidecars.append(
                    self._json_sidecar(
                        "reports/orchestration-build.json",
                        build_orchestration,
                    )
                )
            state["state"] = ChallengeState.SUBMISSIONS_CLOSED.value
            self._commit(
                state,
                action="SUBMISSIONS_CLOSED",
                actor=actor,
                payload={
                    "active_submission_ids": sorted(item["submission_id"] for item in active),
                    "submitter_count": len(unique_submitters),
                    "candidate_diagnostics_hash": state["candidate_diagnostics"].get("diagnostics_hash"),
                    "exact_duplicate_group_count": len(
                        state["candidate_diagnostics"].get("exact_duplicate_groups", [])
                    ),
                    "candidate_diagnostics_file_sha256": diagnostics_sidecar[
                        "sha256"
                    ],
                    "build_orchestration_report_hash": (
                        build_orchestration.get("report_hash")
                        if build_orchestration
                        else None
                    ),
                    "build_required_incomplete_task_ids": (
                        build_orchestration.get(
                            "required_incomplete_task_ids", []
                        )
                        if build_orchestration
                        else []
                    ),
                    "expired_build_leases_reaped": reaped_tasks,
                },
                sidecars=[diagnostics_sidecar, *orchestration_sidecars],
            )
            return copy.deepcopy(state)

    def run_deterministic_checks(
        self, challenge_id: str, *, actor: str = "deterministic-engine"
    ) -> dict[str, Any]:
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            self._require_state(state, ChallengeState.SUBMISSIONS_CLOSED)
            results: dict[str, Any] = {}
            result_sidecars: list[dict[str, Any]] = []
            for submission_id, submission in sorted(state["submissions"].items()):
                if submission.get("status") != "ACTIVE":
                    continue
                directory = self.store.challenge_dir(challenge_id) / "submissions" / submission_id
                manifest = self._verified_submission_manifest(state, submission_id)
                verified_receipts = self._external_receipts_for_submission(
                    state, submission_id
                )
                results[submission_id] = self.engine.run_submission(
                    state["packet"],
                    directory,
                    manifest,
                    runtime={
                        "challenge_id": challenge_id,
                        "submission_id": submission_id,
                        "packet_hash": state["packet_hash"],
                        "rubric_hash": state["rubric_hash"],
                        "external_receipts": verified_receipts,
                    },
                )
                result_sidecars.append(
                    self._json_sidecar(
                        f"submissions/{submission_id}/deterministic-results.json",
                        results[submission_id],
                    )
                )
            state["test_results"] = results
            state["state"] = ChallengeState.TESTED.value
            result_file_hashes = {
                item["relative_path"]: item["sha256"] for item in result_sidecars
            }
            self._commit(
                state,
                action="DETERMINISTIC_CHECKS_COMPLETED",
                actor=actor,
                payload={
                    "submission_count": len(results),
                    "eligible": sorted(
                        submission_id for submission_id, result in results.items() if result.get("eligible")
                    ),
                    "ineligible": sorted(
                        submission_id for submission_id, result in results.items() if not result.get("eligible")
                    ),
                    "execution_enabled": self.engine.allow_execution,
                    "test_results_hash": sha256_json(results),
                    "deterministic_result_file_hashes": result_file_hashes,
                },
                sidecars=result_sidecars,
            )
            return copy.deepcopy(results)

    def open_review(self, challenge_id: str, *, actor: str = "human") -> dict[str, Any]:
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            self._require_state(state, ChallengeState.TESTED)
            active = [
                submission
                for submission in state["submissions"].values()
                if submission.get("status") == "ACTIVE"
            ]
            verified_manifests: dict[str, dict[str, Any]] = {}
            for submission in active:
                submission_id = submission["submission_id"]
                verified_manifests[submission_id] = self._verified_submission_manifest(
                    state, submission_id
                )
            seed = state.get("blind_seed")
            if not isinstance(seed, str):
                raise IntegrityError("Locked challenge is missing its sealed blind-order seed.")
            expected_commitment = blind_seed_commitment(
                challenge_id,
                seed,
                algorithm=str(state.get("blind_order_algorithm", BLIND_ORDER_ALGORITHM_V1)),
            )
            if expected_commitment != state.get("blind_seed_commitment"):
                raise IntegrityError("Blind-order seed no longer matches its locked commitment.")
            blind_map = build_blind_map(
                active,
                challenge_id=challenge_id,
                packet_hash=state["packet_hash"],
                seed=seed,
                algorithm=str(state.get("blind_order_algorithm", BLIND_ORDER_ALGORITHM_V1)),
            )
            state["blind_map"] = blind_map
            state["blind_candidate_diagnostics"] = blind_diagnostics(
                state.get("candidate_diagnostics", {}), blind_map
            )
            assignment_report = build_review_assignments(state)
            state["review_assignments"] = copy.deepcopy(
                assignment_report.get("assignments", {})
            )
            state["review_assignment_report"] = assignment_report
            review_task_plan: dict[str, Any] | None = None
            if state["packet"].get("orchestration_policy", {}).get(
                "enabled", True
            ):
                review_task_plan = ensure_phase_tasks(state, "REVIEW")
            content_safety = scan_review_content(
                state,
                self.store.challenge_dir(challenge_id),
                verified_manifests,
            )
            state["review_content_safety"] = content_safety
            state["state"] = ChallengeState.REVIEW_OPEN.value

            sidecars = [
                self._json_sidecar(
                    "reports/candidate-diagnostics.blind.json",
                    state["blind_candidate_diagnostics"],
                ),
                self._json_sidecar(
                    "reports/review-assignments.json", assignment_report
                ),
                self._json_sidecar(
                    "reports/review-content-safety.blind.json", content_safety
                ),
                self._json_sidecar(
                    "reports/review-protocol.json",
                    {**REVIEW_PROTOCOL, "protocol_hash": REVIEW_PROTOCOL_HASH},
                ),
            ]
            if review_task_plan is not None:
                sidecars.append(
                    self._json_sidecar(
                        "orchestration/review-task-plan.json",
                        review_task_plan,
                    )
                )
            sidecar_hashes = {
                item["relative_path"]: item["sha256"] for item in sidecars
            }
            self._commit(
                state,
                action="BLIND_REVIEW_OPENED",
                actor=actor,
                payload={
                    "blind_labels": sorted(blind_map),
                    "candidate_count": len(blind_map),
                    "rubric_hash": state["rubric_hash"],
                    "blind_map_hash": sha256_json(blind_map),
                    "blind_order_algorithm": state.get("blind_order_algorithm"),
                    "blind_seed_commitment": state.get("blind_seed_commitment"),
                    "blind_candidate_diagnostics_hash": sha256_json(
                        state["blind_candidate_diagnostics"]
                    ),
                    "review_assignment_hash": assignment_report["assignment_hash"],
                    "review_assignment_mode": assignment_report["mode"],
                    "review_targets_met": assignment_report[
                        "all_candidate_targets_met"
                    ],
                    "review_content_safety_hash": content_safety["report_hash"],
                    "review_protocol_hash": REVIEW_PROTOCOL_HASH,
                    "review_task_plan_hash": (
                        review_task_plan.get("task_plan_hash")
                        if review_task_plan
                        else None
                    ),
                    "review_task_count": (
                        review_task_plan.get("task_count")
                        if review_task_plan
                        else 0
                    ),
                    "report_file_hashes": sidecar_hashes,
                },
                sidecars=sidecars,
            )
            return copy.deepcopy(self.review_overview(challenge_id))

    def _review_packet_from_state(
        self, state: dict[str, Any], reviewer_id: str
    ) -> dict[str, Any]:
        participant = state["participants"].get(reviewer_id)
        if not participant or not participant.get("can_review", True):
            raise ValidationError(f"Participant {reviewer_id!r} is not an eligible reviewer.")
        own_submission = state["participant_active_submission"].get(reviewer_id)
        own_label = next(
            (
                label
                for label, submission_id in state["blind_map"].items()
                if submission_id == own_submission
            ),
            None,
        )
        assignment_report = state.get("review_assignment_report", {})
        assigned_labels = state.get("review_assignments", {}).get(reviewer_id)
        if assigned_labels is None:
            # Backward-compatible read of a pre-v0.3 workspace.
            assigned_labels = sorted(state.get("blind_map", {}))
            if (
                own_label
                and not state["packet"]["participant_policy"].get(
                    "allow_self_vote", False
                )
            ):
                assigned_labels = [
                    label for label in assigned_labels if label != own_label
                ]
        assigned_set = set(assigned_labels)
        candidates = []
        for label, submission_id in sorted(state["blind_map"].items()):
            if label not in assigned_set:
                continue
            submission = state["submissions"][submission_id]
            manifest = self._verified_submission_manifest(state, submission_id)
            public_manifest = self._blind_manifest(manifest)
            candidates.append(
                {
                    "blind_label": label,
                    "manifest": public_manifest,
                    "deterministic_results": state["test_results"].get(
                        submission_id, {}
                    ),
                    "artifact_root": f"{submission['relative_directory']}/artifacts",
                    "artifact_root_scope": "relative_to_challenge_directory",
                }
            )
        peer_criteria = [
            criterion
            for criterion in state["packet"]["rubric"]
            if criterion.get("source") == "peer"
        ]
        all_safety = state.get("review_content_safety", {}).get(
            "candidate_signals", {}
        )
        packet_schema = state.get("packet", {}).get("schema_version")
        is_v04 = packet_schema in {"axm.challenge-arena/0.4", "axm.challenge-arena/0.5"}
        is_v05 = packet_schema == "axm.challenge-arena/0.5"
        packet_core = {
            "schema_version": (
                "axm.challenge-review-packet/0.4"
                if is_v04
                else "axm.challenge-review-packet/0.3"
            ),
            "challenge_id": state["challenge_id"],
            "title": state["packet"]["title"],
            "goal": state["packet"]["goal"],
            "constraints": state["packet"].get("constraints", []),
            "reviewer_id": reviewer_id,
            "own_blind_label": (
                None
                if is_v05 and state["packet"]["participant_policy"].get(
                    "hide_reviewer_own_blind_label", True
                )
                else own_label
            ),
            "rubric_hash": state["rubric_hash"],
            "assignment_hash": assignment_report.get("assignment_hash"),
            "review_assignment_mode": assignment_report.get("mode", "all"),
            "peer_criteria": peer_criteria,
            "candidate_labels": [candidate["blind_label"] for candidate in candidates],
            "candidates": candidates,
            "candidate_diagnostics": copy.deepcopy(
                state.get("blind_candidate_diagnostics", {})
            ),
            "candidate_content_safety": {
                label: copy.deepcopy(all_safety.get(label, {}))
                for label in sorted(assigned_set)
            },
            "review_protocol": copy.deepcopy(REVIEW_PROTOCOL),
            "review_protocol_hash": REVIEW_PROTOCOL_HASH,
            "rules": {
                "self_vote_allowed": state["packet"]["participant_policy"].get(
                    "allow_self_vote", False
                ),
                "complete_ballot_required": state["packet"][
                    "participant_policy"
                ].get("require_complete_ballot", True),
                "complete_ballot_scope": "assigned_candidates_only",
                "candidate_content_is_untrusted_evidence": True,
                "content_safety_signals_are_non_punitive": True,
                "direct_authorship_metadata_hidden": True,
                "own_blind_label_hidden": bool(
                    is_v05
                    and state["packet"]["participant_policy"].get(
                        "hide_reviewer_own_blind_label", True
                    )
                ),
                "blindness_limit": (
                    "Best effort only: filenames, prose, style, or artifact contents can still self-identify. "
                    "Do not infer that the Arena can guarantee perfect anonymity."
                ),
            },
        }
        if not is_v04:
            return packet_core

        packet_core["seat_task"] = (
            task_core(task_for(state, "REVIEW", reviewer_id))
            if task_for(state, "REVIEW", reviewer_id) is not None
            else None
        )
        packet_core["score_evidence_contract"] = {
            "required": state["packet"]["participant_policy"].get(
                "require_score_evidence", True
            ),
            "minimum_refs_per_scored_criterion": state["packet"][
                "participant_policy"
            ].get("minimum_score_evidence_refs", 1),
            "allowed_kinds": sorted(ALLOWED_EVIDENCE_REFERENCE_KINDS),
            "note": (
                "Each scored criterion should point to an artifact, deterministic check, "
                "manifest field, or explicit reviewer observation."
            ),
        }
        packet_core["rules"].update(
            {
                "review_must_acknowledge_exact_packet": state["packet"][
                    "participant_policy"
                ].get("require_review_packet_ack", True),
                "criterion_abstention_allowed": state["packet"][
                    "participant_policy"
                ].get("allow_criterion_abstention", True),
                "tied_ranking_tiers_allowed": state["packet"][
                    "participant_policy"
                ].get("allow_tied_rankings", True),
            }
        )
        return {**packet_core, "review_packet_hash": sha256_json(packet_core)}

    @_serialized_read()
    def review_packet(self, challenge_id: str, reviewer_id: str) -> dict[str, Any]:
        state = self.store.load(challenge_id)
        self._require_state(state, ChallengeState.REVIEW_OPEN)
        return self._review_packet_from_state(state, reviewer_id)

    @_serialized_read()
    def review_overview(self, challenge_id: str) -> dict[str, Any]:
        state = self.store.load(challenge_id)
        report = state.get("review_assignment_report", {})
        return {
            "schema_version": (
                "axm.challenge-review-overview/0.4"
                if state.get("packet", {}).get("schema_version")
                in {"axm.challenge-arena/0.4", "axm.challenge-arena/0.5"}
                else "axm.challenge-review-overview/0.3"
            ),
            "challenge_id": challenge_id,
            "state": state["state"],
            "blind_labels": (
                []
                if state.get("packet", {}).get("schema_version") == "axm.challenge-arena/0.5"
                and state.get("state") == ChallengeState.REVIEW_OPEN.value
                and state.get("packet", {}).get("participant_policy", {}).get(
                    "hide_reviewer_own_blind_label", True
                )
                else sorted(state.get("blind_map", {}))
            ),
            "blind_label_count": len(state.get("blind_map", {})),
            "eligible_reviewers": sorted(
                participant_id
                for participant_id, participant in state["participants"].items()
                if participant.get("can_review", True)
            ),
            "active_reviews": sorted(state.get("participant_active_review", {})),
            "rubric_hash": state["rubric_hash"],
            "assignment_hash": report.get("assignment_hash"),
            "assignment_mode": report.get("mode", "all"),
            "candidate_target": report.get("candidate_target"),
            "candidate_coverage": copy.deepcopy(
                report.get("candidate_coverage", {})
            ),
            "reviewer_loads": copy.deepcopy(report.get("reviewer_loads", {})),
            "all_candidate_targets_met": report.get(
                "all_candidate_targets_met", True
            ),
            "unmet_candidate_targets": copy.deepcopy(
                report.get("unmet_candidate_targets", {})
            ),
        }

    def submit_review(
        self,
        challenge_id: str,
        reviewer_id: str,
        review: dict[str, Any],
        *,
        replace: bool = False,
        expected_previous_review_id: str | None = None,
        task_token: str | None = None,
        task_usage: dict[str, Any] | None = None,
        actor: str | None = None,
    ) -> dict[str, Any]:
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            self._require_state(state, ChallengeState.REVIEW_OPEN)
            policy = state["packet"]["participant_policy"]
            participant = state["participants"].get(reviewer_id)
            if not participant or not participant.get("can_review", True):
                raise ValidationError(f"Participant {reviewer_id!r} is not an eligible reviewer.")
            old_review_id = state["participant_active_review"].get(reviewer_id)
            if old_review_id and not replace:
                raise ValidationError(
                    f"Reviewer {reviewer_id} already submitted a review. Use replace=True for an explicit revision."
                )
            if policy.get("require_revision_precondition", False):
                if old_review_id:
                    if expected_previous_review_id != old_review_id:
                        raise ValidationError(
                            "Review revision precondition failed: expected_previous_review_id "
                            f"must equal the current active review {old_review_id!r}. Reload state before replacing."
                        )
                elif expected_previous_review_id is not None:
                    raise ValidationError(
                        "Review revision precondition failed: no active review exists, "
                        "so expected_previous_review_id must be omitted."
                    )
            if not isinstance(review, dict):
                raise ValidationError("Review must be a JSON object.")

            supplied_review_schema = review.get(
                "schema_version", "axm.challenge-review/0.3"
            )
            supported_review_schemas = {
                "axm.challenge-review/0.1",
                "axm.challenge-review/0.2",
                "axm.challenge-review/0.3",
                "axm.challenge-review/0.4",
            }
            if supplied_review_schema not in supported_review_schemas:
                raise ValidationError(
                    "Unsupported review schema_version; expected axm.challenge-review/0.1 through /0.4."
                )

            packet_schema = state["packet"].get("schema_version")
            is_v04_packet = packet_schema in {
                "axm.challenge-arena/0.4",
                "axm.challenge-arena/0.5",
            }
            is_v05_packet = packet_schema == "axm.challenge-arena/0.5"
            expected_review_packet = self._review_packet_from_state(state, reviewer_id)
            expected_review_packet_hash = expected_review_packet.get(
                "review_packet_hash"
            )
            supplied_review_packet_hash = review.get("review_packet_hash")
            require_review_packet_ack = bool(
                is_v04_packet and policy.get("require_review_packet_ack", True)
            )
            if is_v04_packet:
                if supplied_review_packet_hash not in {
                    None,
                    expected_review_packet_hash,
                }:
                    raise ValidationError(
                        "Review review_packet_hash does not match the exact packet issued to this reviewer."
                    )
                if require_review_packet_ack:
                    if supplied_review_schema != "axm.challenge-review/0.4":
                        raise ValidationError(
                            "This challenge requires a v0.4 review so stale review packets cannot be silently accepted."
                        )
                    if supplied_review_packet_hash != expected_review_packet_hash:
                        raise ValidationError(
                            "v0.4 reviews must acknowledge the exact locked review_packet_hash."
                        )
            elif supplied_review_schema == "axm.challenge-review/0.4":
                raise ValidationError(
                    "A v0.4 review may only be submitted against a v0.4 challenge packet."
                )

            assignment_hash = state.get("review_assignment_report", {}).get(
                "assignment_hash"
            )
            supplied_assignment_hash = review.get("assignment_hash")
            if supplied_assignment_hash not in {None, assignment_hash}:
                raise ValidationError(
                    "Review assignment_hash does not match the locked review assignment."
                )
            if supplied_review_schema in {
                "axm.challenge-review/0.3",
                "axm.challenge-review/0.4",
            } and (not assignment_hash or supplied_assignment_hash != assignment_hash):
                raise ValidationError(
                    "v0.3+ reviews must acknowledge the locked assignment_hash."
                )
            if review.get("rubric_hash") != state["rubric_hash"]:
                raise ValidationError("Review rubric_hash does not match the locked rubric.")

            own_submission = state["participant_active_submission"].get(reviewer_id)
            own_label = next(
                (label for label, sid in state["blind_map"].items() if sid == own_submission),
                None,
            )
            all_labels = set(state["blind_map"])
            allow_self = bool(policy.get("allow_self_vote", False))
            assigned = state.get("review_assignments", {}).get(reviewer_id)
            if assigned is None:
                expected_labels = (
                    all_labels
                    if allow_self or own_label is None
                    else all_labels - {own_label}
                )
            else:
                expected_labels = set(assigned)
            if own_label and not allow_self and own_label in expected_labels:
                raise IntegrityError(
                    "Stored review assignment includes the reviewer's prohibited own candidate."
                )

            evaluations = review.get("evaluations")
            if not isinstance(evaluations, dict):
                raise ValidationError("Review requires an evaluations object.")
            if own_label and not allow_self and own_label in evaluations:
                raise ValidationError("Self-review/self-voting is prohibited by this challenge policy.")
            supplied_labels = set(evaluations)
            require_complete = bool(policy.get("require_complete_ballot", True))
            if require_complete and supplied_labels != expected_labels:
                raise ValidationError(
                    f"Complete ballot required. Expected exactly {sorted(expected_labels)} in evaluations."
                )
            if not supplied_labels.issubset(expected_labels):
                raise ValidationError("Review references an unknown or prohibited candidate label.")

            ranking_tiers, ranking = normalize_ranking_tiers(
                ranking=review.get("ranking"),
                ranking_tiers=review.get("ranking_tiers"),
                expected_labels=expected_labels,
                require_complete=require_complete,
                allow_ties=bool(
                    is_v04_packet and policy.get("allow_tied_rankings", True)
                ),
            )
            if own_label and not allow_self and own_label in ranking:
                raise ValidationError("Self-review/self-voting is prohibited by this challenge policy.")

            peer_criteria = {
                criterion["id"]: criterion
                for criterion in state["packet"]["rubric"]
                if criterion.get("source") == "peer"
            }
            peer_criterion_ids = set(peer_criteria)

            def normalize_text_list(value: Any, field: str) -> list[str]:
                if value is None:
                    return []
                if not isinstance(value, list):
                    raise ValidationError(f"{field} must be a list of strings.")
                if len(value) > 100:
                    raise ValidationError(f"{field} exceeds 100 entries.")
                result: list[str] = []
                for index, item in enumerate(value, start=1):
                    text = str(item).strip()
                    if len(text) > 4_000:
                        raise ValidationError(
                            f"{field}[{index}] exceeds the 4000-character limit."
                        )
                    if text:
                        result.append(text)
                return result

            normalized_evaluations: dict[str, Any] = {}
            for label, evaluation in evaluations.items():
                if not isinstance(evaluation, dict):
                    raise ValidationError(f"Evaluation for {label} must be an object.")
                scores = evaluation.get("scores", {})
                if not isinstance(scores, dict):
                    raise ValidationError(f"Evaluation scores for {label} must be an object.")
                unknown_scores = sorted(set(scores) - peer_criterion_ids)
                if unknown_scores:
                    raise ValidationError(
                        f"Evaluation for {label} scores unknown criteria: {unknown_scores}"
                    )
                normalized_abstentions = normalize_abstentions(
                    evaluation.get("abstentions", {}),
                    label=label,
                    peer_criterion_ids=peer_criterion_ids,
                    allow_abstention=bool(
                        is_v04_packet
                        and policy.get("allow_criterion_abstention", True)
                    ),
                )
                overlap = sorted(set(scores) & set(normalized_abstentions))
                if overlap:
                    raise ValidationError(
                        f"Evaluation for {label} both scores and abstains from: {overlap}"
                    )
                covered_criteria = set(scores) | set(normalized_abstentions)
                if covered_criteria != peer_criterion_ids:
                    missing = sorted(peer_criterion_ids - covered_criteria)
                    raise ValidationError(
                        f"Evaluation for {label} must score or explicitly abstain from every peer criterion; missing {missing}."
                    )

                normalized_scores: dict[str, float] = {}
                for criterion_id, raw_score in scores.items():
                    if isinstance(raw_score, bool):
                        raise ValidationError(
                            f"Score {criterion_id} for {label} must be numeric, not true/false."
                        )
                    criterion = peer_criteria[criterion_id]
                    try:
                        score = float(raw_score)
                    except (TypeError, ValueError) as exc:
                        raise ValidationError(
                            f"Score {criterion_id} for {label} must be numeric."
                        ) from exc
                    if score != score or score in {float("inf"), float("-inf")}:
                        raise ValidationError(
                            f"Score {criterion_id} for {label} must be finite."
                        )
                    minimum = float(criterion.get("score_min", 0))
                    maximum = float(criterion.get("score_max", 100))
                    if not minimum <= score <= maximum:
                        raise ValidationError(
                            f"Score {criterion_id} for {label} must be in {minimum}..{maximum}."
                        )
                    normalized_scores[criterion_id] = score

                submission_id = state["blind_map"][label]
                manifest = self._verified_submission_manifest(state, submission_id)
                normalized_evidence = normalize_evidence_refs(
                    evaluation.get("evidence_refs", {}),
                    label=label,
                    scored_criterion_ids=set(normalized_scores),
                    manifest=self._blind_manifest(manifest),
                    deterministic_results=state.get("test_results", {}).get(
                        submission_id, {}
                    ),
                    require_score_evidence=bool(
                        is_v04_packet
                        and policy.get("require_score_evidence", True)
                    ),
                    minimum_refs=int(
                        policy.get("minimum_score_evidence_refs", 1)
                    ),
                )
                normalized_evaluations[label] = {
                    "scores": normalized_scores,
                    "abstentions": normalized_abstentions,
                    "evidence_refs": normalized_evidence,
                    "strengths": normalize_text_list(
                        evaluation.get("strengths", []),
                        f"Evaluation strengths for {label}",
                    ),
                    "weaknesses": normalize_text_list(
                        evaluation.get("weaknesses", []),
                        f"Evaluation weaknesses for {label}",
                    ),
                    "risks": normalize_text_list(
                        evaluation.get("risks", []),
                        f"Evaluation risks for {label}",
                    ),
                    "merge_worthy": normalize_text_list(
                        evaluation.get("merge_worthy", []),
                        f"Evaluation merge_worthy for {label}",
                    ),
                }

            overall_reason = str(review.get("overall_reason", "")).strip()
            if len(overall_reason) > 8_000:
                raise ValidationError("overall_reason exceeds the 8000-character limit.")
            if is_v04_packet:
                review_core = {
                    "schema_version": "axm.challenge-review/0.4",
                    "intake_schema_version": supplied_review_schema,
                    "reviewer_id": reviewer_id,
                    "rubric_hash": state["rubric_hash"],
                    "assignment_hash": assignment_hash,
                    "review_packet_hash": expected_review_packet_hash,
                    "review_packet_acknowledged": (
                        supplied_review_packet_hash == expected_review_packet_hash
                    ),
                    "evaluations": normalized_evaluations,
                    "ranking_tiers": ranking_tiers,
                    "ranking": ranking,
                    "overall_reason": overall_reason,
                    "submitted_at": utc_now(),
                }
            else:
                # Preserve the exact mature v0.3 review shape for legacy rounds.
                legacy_evaluations = {
                    label: {
                        "scores": copy.deepcopy(item.get("scores", {})),
                        "strengths": copy.deepcopy(item.get("strengths", [])),
                        "weaknesses": copy.deepcopy(item.get("weaknesses", [])),
                        "risks": copy.deepcopy(item.get("risks", [])),
                        "merge_worthy": copy.deepcopy(
                            item.get("merge_worthy", [])
                        ),
                    }
                    for label, item in normalized_evaluations.items()
                }
                review_core = {
                    "schema_version": "axm.challenge-review/0.3",
                    "reviewer_id": reviewer_id,
                    "rubric_hash": state["rubric_hash"],
                    "assignment_hash": assignment_hash,
                    "evaluations": legacy_evaluations,
                    "ranking": ranking,
                    "overall_reason": overall_reason,
                    "submitted_at": utc_now(),
                }
            review_hash = sha256_json(review_core)
            review_id = (
                f"review-{reviewer_id}-{review_hash[:10]}-"
                f"{int(state.get('event_sequence', 0)) + 1:04d}"
            )
            normalized = {
                **review_core,
                "status": "ACTIVE",
                "supersedes": old_review_id,
                "superseded_by": None,
                "review_id": review_id,
                "review_hash": review_hash,
            }
            review_task: dict[str, Any] | None = None
            if state["packet"].get("orchestration_policy", {}).get(
                "enabled", True
            ):
                review_task = task_for(state, "REVIEW", reviewer_id)
                if review_task is None:
                    raise IntegrityError(
                        f"Missing locked REVIEW task for reviewer {reviewer_id!r}."
                    )
                complete_seat_task(
                    copy.deepcopy(review_task),
                    output_kind="review",
                    output_id=review_id,
                    output_hash=review_hash,
                    actor=actor or reviewer_id,
                    token=task_token,
                    usage=task_usage,
                    direct_authority=bool(old_review_id),
                )
            review_dir = self.store.challenge_dir(challenge_id) / "reviews"
            review_dir.mkdir(exist_ok=True)
            if old_review_id:
                state["reviews"][old_review_id]["status"] = "SUPERSEDED"
                state["reviews"][old_review_id]["superseded_by"] = review_id
            state["reviews"][review_id] = normalized
            state["participant_active_review"][reviewer_id] = review_id
            review_sidecar = self._json_sidecar(
                f"reviews/{review_id}.json",
                normalized,
                mode="immutable",
            )
            sidecars = [review_sidecar]
            task_receipt_value: dict[str, Any] | None = None
            if review_task is not None:
                complete_seat_task(
                    review_task,
                    output_kind="review",
                    output_id=review_id,
                    output_hash=review_hash,
                    actor=actor or reviewer_id,
                    token=task_token,
                    usage=task_usage,
                    direct_authority=bool(old_review_id),
                )
                task_receipt_value = task_receipt(review_task)
                sidecars.append(
                    self._json_sidecar(
                        (
                            "orchestration/receipts/"
                            f"{review_task['task_id']}-{review_id}.json"
                        ),
                        task_receipt_value,
                        mode="immutable",
                    )
                )
            self._commit(
                state,
                action="REVIEW_RECORDED" if not old_review_id else "REVIEW_REVISED",
                actor=actor or reviewer_id,
                payload={
                    "reviewer_id": reviewer_id,
                    "review_id": review_id,
                    "review_hash": review_hash,
                    "review_packet_hash": expected_review_packet_hash,
                    "candidate_labels": sorted(normalized_evaluations),
                    "criterion_abstention_count": sum(
                        len(item.get("abstentions", {}))
                        for item in normalized_evaluations.values()
                    ),
                    "supersedes": old_review_id,
                    "review_file_sha256": review_sidecar["sha256"],
                    "seat_task_id": (
                        review_task.get("task_id") if review_task else None
                    ),
                    "seat_task_receipt_hash": (
                        task_receipt_value.get("receipt_hash")
                        if task_receipt_value
                        else None
                    ),
                    "seat_task_budget_signals": (
                        review_task.get("completed_output", {})
                        .get("budget_evaluation", {})
                        .get("signals", [])
                        if review_task
                        else []
                    ),
                },
                sidecars=sidecars,
            )
            return copy.deepcopy(normalized)

    def close_voting(
        self, challenge_id: str, *, force: bool = False, actor: str = "human"
    ) -> dict[str, Any]:
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            self._require_state(state, ChallengeState.REVIEW_OPEN)
            assignment_map = state.get("review_assignments", {})
            required_reviewers = {
                participant_id
                for participant_id, participant in state["participants"].items()
                if participant.get("can_review", True)
                and participant.get("review_required", True)
                and (not assignment_map or bool(assignment_map.get(participant_id)))
            }
            completed = set(state["participant_active_review"])
            missing = sorted(required_reviewers - completed)
            if missing and not force:
                raise ValidationError(
                    f"Required reviews are still missing from: {missing}. Use force=True only for an explicit incomplete close."
                )
            review_orchestration: dict[str, Any] | None = None
            reaped_tasks: list[dict[str, Any]] = []
            sidecars: list[dict[str, Any]] = []
            if state["packet"].get("orchestration_policy", {}).get(
                "enabled", True
            ):
                reaped_tasks = reap_expired_tasks(state)
                review_orchestration = orchestration_report(
                    state, phase="REVIEW"
                )
                state.setdefault("orchestration_reports", {})[
                    "REVIEW"
                ] = review_orchestration
                sidecars.append(
                    self._json_sidecar(
                        "reports/orchestration-review.json",
                        review_orchestration,
                    )
                )
            seed = state.get("blind_seed")
            if not isinstance(seed, str):
                raise IntegrityError("Locked challenge is missing its sealed blind-order seed.")
            revealed_at = utc_now()
            reveal_core = {
                "schema_version": (
                    "axm.challenge-blind-seed-reveal/0.5"
                    if state.get("packet", {}).get("schema_version") == "axm.challenge-arena/0.5"
                    else "axm.challenge-blind-seed-reveal/0.4"
                ),
                "challenge_id": challenge_id,
                "algorithm": state.get("blind_order_algorithm"),
                "seed": seed,
                "commitment": state.get("blind_seed_commitment"),
                "blind_map_hash": sha256_json(state.get("blind_map", {})),
                "revealed_at": revealed_at,
            }
            reveal = {**reveal_core, "reveal_hash": sha256_json(reveal_core)}
            reveal_sidecar = self._json_sidecar(
                "reports/blind-seed-reveal.json", reveal
            )
            sidecars.append(reveal_sidecar)
            state["blind_seed_revealed_at"] = revealed_at
            state["blind_seed_reveal_hash"] = reveal["reveal_hash"]
            state["state"] = ChallengeState.VOTING_CLOSED.value
            self._commit(
                state,
                action="VOTING_CLOSED",
                actor=actor,
                payload={
                    "completed_reviewers": sorted(completed),
                    "missing_required_reviewers": missing,
                    "forced": force,
                    "blind_order_algorithm": state.get("blind_order_algorithm"),
                    "blind_seed_commitment": state.get("blind_seed_commitment"),
                    "blind_seed_reveal_hash": reveal["reveal_hash"],
                    "blind_seed_reveal_file_sha256": reveal_sidecar["sha256"],
                    "review_orchestration_report_hash": (
                        review_orchestration.get("report_hash")
                        if review_orchestration
                        else None
                    ),
                    "review_required_incomplete_task_ids": (
                        review_orchestration.get(
                            "required_incomplete_task_ids", []
                        )
                        if review_orchestration
                        else []
                    ),
                    "expired_review_leases_reaped": reaped_tasks,
                },
                sidecars=sidecars,
            )
            return copy.deepcopy(state)

    def synthesize(self, challenge_id: str, *, actor: str = "arena-synthesizer") -> dict[str, Any]:
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            self._require_state(state, ChallengeState.VOTING_CLOSED)
            result = aggregate_votes(state["packet"], state)
            merge_map = build_merge_map(state["packet"], state, result)
            state["result"] = result
            state["merge_map"] = merge_map
            state["state"] = ChallengeState.SYNTHESIZED.value
            integration_return = self._integration_return_from_state(state)
            result_markdown = render_result_markdown(state)
            sidecars = [
                self._json_sidecar("reports/result.json", result),
                self._json_sidecar("reports/merge-map.json", merge_map),
                self._text_sidecar("reports/result.md", result_markdown),
                self._json_sidecar(
                    "reports/integration-return.json", integration_return
                ),
            ]
            sidecar_hashes = {
                item["relative_path"]: item["sha256"] for item in sidecars
            }
            self._commit(
                state,
                action="RESULT_SYNTHESIZED",
                actor=actor,
                payload={
                    "provisional_winner": result.get("provisional_winner"),
                    "runner_up": result.get("runner_up"),
                    "confidence": result.get("confidence"),
                    "dissent_count": len(result.get("dissent", [])),
                    "human_decision_required": True,
                    "result_hash": sha256_json(result),
                    "merge_map_hash": sha256_json(merge_map),
                    "report_file_sha256": sidecar_hashes,
                },
                sidecars=sidecars,
            )
            return {"result": copy.deepcopy(result), "merge_map": copy.deepcopy(merge_map)}

    def finalize(
        self,
        challenge_id: str,
        decision: dict[str, Any],
        *,
        actor: str = "human",
    ) -> dict[str, Any]:
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            self._require_state(state, ChallengeState.SYNTHESIZED)
            if not isinstance(decision, dict):
                raise ValidationError("Final decision must be an object.")
            action = str(decision.get("action", "HOLD")).upper()
            allowed = {"ACCEPT", "MERGE", "BRANCH", "RERUN", "REJECT", "HOLD"}
            if action not in allowed:
                raise ValidationError(f"Unknown final action {action!r}. Allowed: {sorted(allowed)}")
            labels = [str(item) for item in decision.get("selected_blind_labels", [])]
            unknown = sorted(set(labels) - set(state["blind_map"]))
            if unknown:
                raise ValidationError(f"Final decision references unknown candidate labels: {unknown}")
            normalized = {
                "action": action,
                "selected_blind_labels": labels,
                "approved_merge_components": [str(item) for item in decision.get("approved_merge_components", [])],
                "notes": str(decision.get("notes", "")),
                "decided_by": actor,
                "decided_at": utc_now(),
                "automatic_winner_was": state.get("result", {}).get("provisional_winner"),
            }
            state["final_decision"] = normalized
            state["state"] = ChallengeState.FINALIZED.value
            integration_return = self._integration_return_from_state(state)
            result_markdown = render_result_markdown(state)
            sidecars = [
                self._json_sidecar("reports/final-decision.json", normalized),
                self._json_sidecar(
                    "reports/integration-return.json", integration_return
                ),
                self._text_sidecar("reports/result.md", result_markdown),
            ]
            sidecar_hashes = {
                item["relative_path"]: item["sha256"] for item in sidecars
            }
            self._commit(
                state,
                action="HUMAN_DECISION_RECORDED",
                actor=actor,
                payload={
                    **normalized,
                    "report_file_sha256": sidecar_hashes,
                },
                sidecars=sidecars,
            )
            return copy.deepcopy(normalized)

    def abort(self, challenge_id: str, reason: str, *, actor: str = "human") -> dict[str, Any]:
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            if state.get("state") in {ChallengeState.FINALIZED.value, ChallengeState.ABORTED.value}:
                raise StateError("A finalized or already aborted challenge cannot be aborted again.")
            state["state"] = ChallengeState.ABORTED.value
            state["abort_reason"] = reason
            self._commit(
                state,
                action="CHALLENGE_ABORTED",
                actor=actor,
                payload={"reason": reason},
            )
            return copy.deepcopy(state)

    def recover(self, challenge_id: str | None = None) -> dict[str, Any]:
        """Finish only transitions already captured by a write-ahead journal."""

        with self._lock:
            with self.store.operation_lock():
                if challenge_id is None:
                    return self.store.recover_all()
                if not self.store.exists(challenge_id):
                    raise ValidationError(f"Unknown challenge: {challenge_id}")
                report = self.store.recover_pending(challenge_id)
                return report or {
                    "recovered": False,
                    "challenge_id": challenge_id,
                    "message": "No pending commit was present.",
                }

    @staticmethod
    def _seat_task_from_state(
        state: dict[str, Any], task_id: str
    ) -> dict[str, Any]:
        task = state.get("seat_tasks", {}).get(task_id)
        if not isinstance(task, dict):
            raise ValidationError(f"Unknown seat task: {task_id!r}")
        return task

    @staticmethod
    def _require_task_phase_open(
        state: dict[str, Any], task: dict[str, Any]
    ) -> None:
        expected_state = {
            "BUILD": ChallengeState.BUILDING.value,
            "REVIEW": ChallengeState.REVIEW_OPEN.value,
        }.get(str(task.get("phase")))
        if expected_state is None:
            raise IntegrityError(
                f"Seat task {task.get('task_id')} has an unknown phase."
            )
        if state.get("state") != expected_state:
            raise StateError(
                f"Seat task {task.get('task_id')} belongs to {task.get('phase')}; "
                f"the challenge is currently {state.get('state')}."
            )

    @_serialized_read()
    def list_tasks(
        self,
        challenge_id: str,
        *,
        phase: str | None = None,
        include_private: bool = False,
    ) -> dict[str, Any]:
        state = self.store.load(challenge_id)
        normalized_phase = str(phase).upper() if phase is not None else None
        if normalized_phase is not None and normalized_phase not in {"BUILD", "REVIEW"}:
            raise ValidationError("phase must be BUILD or REVIEW.")
        selected = {
            task_id: copy.deepcopy(task) if include_private else public_task(task)
            for task_id, task in sorted(state.get("seat_tasks", {}).items())
            if isinstance(task, dict)
            and (normalized_phase is None or task.get("phase") == normalized_phase)
        }
        return {
            "schema_version": "axm.challenge-seat-task-list/0.4",
            "challenge_id": challenge_id,
            "challenge_state": state.get("state"),
            "phase": normalized_phase,
            "tasks": selected,
            "report": orchestration_report(state, phase=normalized_phase),
            "private_lease_hashes_included": bool(include_private),
        }

    def claim_task(
        self,
        challenge_id: str,
        task_id: str,
        *,
        worker_id: str,
        lease_seconds: int | None = None,
        actor: str | None = None,
    ) -> dict[str, Any]:
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            task = self._seat_task_from_state(state, task_id)
            self._require_task_phase_open(state, task)
            token = new_lease_token()
            lease = claim_seat_task(
                task,
                worker_id=worker_id,
                token=token,
                lease_id=new_lease_id(task_id),
                lease_seconds=lease_seconds,
            )
            self._commit(
                state,
                action="SEAT_TASK_LEASE_CLAIMED",
                actor=actor or worker_id,
                payload={
                    "task_id": task_id,
                    "phase": task.get("phase"),
                    "participant_id": task.get("participant_id"),
                    "worker_id": worker_id,
                    "lease_id": lease.get("lease_id"),
                    "attempt_number": lease.get("attempt_number"),
                    "expires_at": lease.get("expires_at"),
                },
            )
            visible_lease = copy.deepcopy(lease)
            visible_lease.pop("lease_token_hash", None)
            return {
                "schema_version": "axm.challenge-seat-lease/0.4",
                "task": public_task(task),
                "lease": visible_lease,
                "lease_token": token,
                "token_notice": (
                    "This bearer token is returned once and is never stored in plaintext. "
                    "Keep it with the assigned worker until completion or failure."
                ),
            }

    def heartbeat_task(
        self,
        challenge_id: str,
        task_id: str,
        token: str,
        *,
        extension_seconds: int | None = None,
        actor: str = "seat-worker",
    ) -> dict[str, Any]:
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            task = self._seat_task_from_state(state, task_id)
            self._require_task_phase_open(state, task)
            lease = heartbeat_seat_task(
                task,
                token=token,
                extension_seconds=extension_seconds,
            )
            self._commit(
                state,
                action="SEAT_TASK_HEARTBEAT_RECORDED",
                actor=actor,
                payload={
                    "task_id": task_id,
                    "lease_id": lease.get("lease_id"),
                    "heartbeat_count": lease.get("heartbeat_count"),
                    "expires_at": lease.get("expires_at"),
                },
            )
            visible = copy.deepcopy(lease)
            visible.pop("lease_token_hash", None)
            return visible

    def fail_task(
        self,
        challenge_id: str,
        task_id: str,
        token: str,
        *,
        failure_class: str,
        detail: str,
        retryable: bool = True,
        actor: str = "seat-worker",
    ) -> dict[str, Any]:
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            task = self._seat_task_from_state(state, task_id)
            self._require_task_phase_open(state, task)
            result = fail_seat_task(
                task,
                token=token,
                failure_class=failure_class,
                detail=detail,
                retryable=retryable,
            )
            receipt = task_receipt(task)
            sidecar = self._json_sidecar(
                f"orchestration/receipts/{task_id}-{receipt['receipt_hash']}.json",
                receipt,
                mode="immutable",
            )
            self._commit(
                state,
                action="SEAT_TASK_FAILURE_RECORDED",
                actor=actor,
                payload={
                    **copy.deepcopy(result),
                    "receipt_hash": receipt["receipt_hash"],
                    "receipt_file_sha256": sidecar["sha256"],
                    "automatic_score_effect": False,
                },
                sidecars=[sidecar],
            )
            return {**result, "receipt": receipt}

    def reap_tasks(
        self,
        challenge_id: str,
        *,
        actor: str = "arena-reaper",
    ) -> dict[str, Any]:
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            reaped = reap_expired_tasks(state)
            report = orchestration_report(state)
            if not reaped:
                return {
                    "schema_version": "axm.challenge-seat-reap/0.4",
                    "challenge_id": challenge_id,
                    "reaped": [],
                    "report": report,
                    "changed": False,
                }
            sequence = int(state.get("event_sequence", 0)) + 1
            sidecar = self._json_sidecar(
                f"orchestration/reap/{sequence:08d}.json",
                {"reaped": reaped, "report": report},
                mode="immutable",
            )
            self._commit(
                state,
                action="EXPIRED_SEAT_TASKS_REAPED",
                actor=actor,
                payload={
                    "reaped": reaped,
                    "orchestration_report_hash": report["report_hash"],
                    "reap_file_sha256": sidecar["sha256"],
                },
                sidecars=[sidecar],
            )
            return {
                "schema_version": "axm.challenge-seat-reap/0.4",
                "challenge_id": challenge_id,
                "reaped": reaped,
                "report": report,
                "changed": True,
            }

    def cancel_task(
        self,
        challenge_id: str,
        task_id: str,
        *,
        reason: str,
        actor: str = "human",
    ) -> dict[str, Any]:
        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            task = self._seat_task_from_state(state, task_id)
            self._require_task_phase_open(state, task)
            cancellation = cancel_seat_task(task, reason=reason, actor=actor)
            receipt = task_receipt(task)
            sidecar = self._json_sidecar(
                f"orchestration/receipts/{task_id}-{receipt['receipt_hash']}.json",
                receipt,
                mode="immutable",
            )
            self._commit(
                state,
                action="SEAT_TASK_CANCELLED",
                actor=actor,
                payload={
                    "task_id": task_id,
                    "cancellation": cancellation,
                    "receipt_hash": receipt["receipt_hash"],
                    "receipt_file_sha256": sidecar["sha256"],
                    "automatic_score_effect": False,
                },
                sidecars=[sidecar],
            )
            return {"task": public_task(task), "receipt": receipt}

    @_serialized_read()
    def progress(self, challenge_id: str) -> dict[str, Any]:
        """Return a small deterministic progress/readiness view for adapters and humans."""

        state = self.store.load(challenge_id)
        submitters = {
            participant_id
            for participant_id, participant in state.get("participants", {}).items()
            if participant.get("can_submit", True)
        }
        submitted = {
            participant_id
            for participant_id, submission_id in state.get(
                "participant_active_submission", {}
            ).items()
            if state.get("submissions", {}).get(submission_id, {}).get("status")
            == "ACTIVE"
        }
        assignment_map = state.get("review_assignments", {})
        reviewers = {
            participant_id
            for participant_id, participant in state.get("participants", {}).items()
            if participant.get("can_review", True)
            and participant.get("review_required", True)
            and (not assignment_map or bool(assignment_map.get(participant_id)))
        }
        reviewed = set(state.get("participant_active_review", {}))
        next_actions: list[str] = []
        phase = state.get("state")
        if phase == ChallengeState.DRAFT.value:
            next_actions = ["register participants", "lock challenge"]
        elif phase == ChallengeState.BUILDING.value:
            next_actions = ["collect missing submissions", "close submissions"]
        elif phase == ChallengeState.SUBMISSIONS_CLOSED.value:
            next_actions = ["run deterministic checks"]
        elif phase == ChallengeState.TESTED.value:
            next_actions = ["open blind review"]
        elif phase == ChallengeState.REVIEW_OPEN.value:
            next_actions = ["collect missing reviews", "close voting"]
        elif phase == ChallengeState.VOTING_CLOSED.value:
            next_actions = ["synthesize result and merge map"]
        elif phase == ChallengeState.SYNTHESIZED.value:
            next_actions = ["human decision", "spawn explicit follow-up round"]
        elif phase == ChallengeState.FINALIZED.value:
            next_actions = ["export result/evidence bundle", "spawn optional follow-up round"]
        orchestration = orchestration_report(state)
        return {
            "schema_version": "axm.challenge-progress/0.4",
            "challenge_id": challenge_id,
            "state": phase,
            "packet_hash": state.get("packet_hash"),
            "rubric_hash": state.get("rubric_hash"),
            "submitters": {
                "registered": sorted(submitters),
                "completed": sorted(submitted),
                "missing": sorted(submitters - submitted),
                "all_completed": bool(submitters) and submitters <= submitted,
            },
            "reviewers": {
                "required": sorted(reviewers),
                "completed": sorted(reviewed),
                "missing": sorted(reviewers - reviewed),
                "all_required_completed": reviewers <= reviewed,
            },
            "review_assignment": {
                "mode": state.get("review_assignment_report", {}).get("mode"),
                "assignment_hash": state.get("review_assignment_report", {}).get(
                    "assignment_hash"
                ),
                "candidate_coverage": copy.deepcopy(
                    state.get("review_assignment_report", {}).get(
                        "candidate_coverage", {}
                    )
                ),
                "all_candidate_targets_met": state.get(
                    "review_assignment_report", {}
                ).get("all_candidate_targets_met"),
            },
            "active_submission_count": len(submitted),
            "deterministic_result_count": len(state.get("test_results", {})),
            "recommendation_status": state.get("result", {}).get(
                "recommendation_status"
            ),
            "provisional_winner": state.get("result", {}).get(
                "provisional_winner"
            ),
            "orchestration": {
                "enabled": state.get("packet", {})
                .get("orchestration_policy", {})
                .get("enabled", False),
                "report": orchestration,
                "operational_gap_count": len(
                    orchestration.get("required_incomplete_task_ids", [])
                ),
                "automatic_score_effect": False,
            },
            "next_actions": next_actions,
        }

    def spawn_followup(
        self,
        parent_challenge_id: str,
        challenge_id: str,
        *,
        mode: str = "BEAT_WINNER",
        selected_blind_labels: list[str] | None = None,
        title: str | None = None,
        goal: str | None = None,
        copy_participants: bool = True,
        copy_inputs: bool = True,
        actor: str = "human",
    ) -> dict[str, Any]:
        """Create an explicit next round without rewriting the completed parent.

        A follow-up is always a new DRAFT challenge. Candidate references are evidence
        inputs only; no proposed winner or merge component becomes canon automatically.
        """

        try:
            child_id = ensure_slug(challenge_id, "challenge_id")
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        mode = str(mode).upper()
        allowed_modes = {
            "BEAT_WINNER",
            "REPAIR_WINNER",
            "MERGE_CHALLENGE",
            "FINAL_SHOWDOWN",
            "RERUN",
        }
        if mode not in allowed_modes:
            raise ValidationError(
                f"Unknown follow-up mode {mode!r}. Allowed: {sorted(allowed_modes)}"
            )

        with self._access(parent_challenge_id):
            parent = copy.deepcopy(self.store.load(parent_challenge_id))
            self._require_state(
                parent, ChallengeState.SYNTHESIZED, ChallengeState.FINALIZED
            )
        if child_id == parent_challenge_id:
            raise ValidationError("A follow-up challenge_id must differ from its parent.")

        ranked = [
            row.get("blind_label")
            for row in parent.get("result", {}).get("candidates", [])
            if row.get("blind_label") in parent.get("blind_map", {})
        ]
        winner = parent.get("result", {}).get("provisional_winner")
        if selected_blind_labels is None:
            if mode in {"BEAT_WINNER", "REPAIR_WINNER"}:
                labels = [winner] if winner else []
            elif mode == "FINAL_SHOWDOWN":
                labels = ranked[:2]
            elif mode == "MERGE_CHALLENGE":
                labels = []
                base = parent.get("merge_map", {}).get("base_candidate")
                if base:
                    labels.append(base)
                for component in parent.get("merge_map", {}).get(
                    "proposed_components", []
                ):
                    candidate = component.get("candidate_source")
                    if candidate and candidate not in labels:
                        labels.append(candidate)
                if not labels:
                    labels = ranked[:2]
            else:
                labels = []
        else:
            labels = list(dict.fromkeys(str(item) for item in selected_blind_labels))
        unknown = sorted(set(labels) - set(parent.get("blind_map", {})))
        if unknown:
            raise ValidationError(
                f"Follow-up references unknown blind candidate labels: {unknown}"
            )

        default_goal = {
            "BEAT_WINNER": "Build a clearly stronger candidate than the parent round's provisional winner while preserving any verified strengths.",
            "REPAIR_WINNER": "Repair the parent round's provisional winner using the recorded weaknesses, risks, dissent, and deterministic evidence.",
            "MERGE_CHALLENGE": "Build one coherent new candidate from explicitly referenced strengths and merge-worthy components; do not paste candidates together blindly.",
            "FINAL_SHOWDOWN": "Run a final independent showdown using the strongest referenced candidates as evidence to beat, not as automatic answers.",
            "RERUN": "Run the same locked production brief again as a fresh independent round and compare the new evidence with the parent.",
        }[mode]
        child_packet = copy.deepcopy(parent["packet"])
        child_packet["schema_version"] = "axm.challenge-arena/0.5"
        child_packet["challenge_id"] = child_id
        child_packet["title"] = title or f"{parent['packet']['title']} — {mode.replace('_', ' ').title()}"
        child_packet["goal"] = goal or default_goal
        child_packet["created_at"] = utc_now()
        child_packet["created_by"] = actor
        child_packet["lineage"] = {
            "parent_challenge_id": parent_challenge_id,
            "parent_event_head": parent.get("event_head"),
            "parent_state": parent.get("state"),
            "mode": mode,
            "selected_blind_labels": labels,
            "authority": "evidence-only-until-explicit-human-decision",
        }
        child_packet["integration"] = {
            **copy.deepcopy(child_packet.get("integration", {})),
            "source_module": "challenge_arena",
            "source_job_id": parent_challenge_id,
            "return_mode": "result_and_merge_map",
        }
        inherited_sealed_inputs: list[dict[str, Any]] = []
        inputs: list[dict[str, Any]] = []
        for raw_input in copy.deepcopy(child_packet.get("inputs", [])):
            if not isinstance(raw_input, dict):
                inputs.append(raw_input)
                continue
            if raw_input.get("seal_receipt_hash"):
                # Follow-up packets cannot reuse parent-local paths. Re-verify the
                # parent evidence now, strip its parent-bound receipt fields from the
                # child draft, then reseal the exact bytes into the child after it is
                # created. The child receives a new challenge-bound receipt/hash.
                source_root = self._verified_sealed_input_root(parent, raw_input)
                inherited_sealed_inputs.append(
                    {
                        "input_id": str(raw_input.get("id", "")),
                        "source_root": source_root,
                        "parent_receipt_hash": raw_input.get("seal_receipt_hash"),
                        "artifact_set_hash": raw_input.get("artifact_set_hash"),
                        "artifact_files": copy.deepcopy(raw_input.get("artifact_files", [])),
                    }
                )
                clean_input = copy.deepcopy(raw_input)
                for generated_key in (
                    "source_name",
                    "artifact_root",
                    "artifact_root_scope",
                    "artifact_files",
                    "artifact_set_hash",
                    "sealed_at",
                    "seal_receipt_hash",
                    "portable",
                    "authority",
                ):
                    clean_input.pop(generated_key, None)
                inputs.append(clean_input)
            else:
                inputs.append(raw_input)
        existing_input_ids = {str(item.get("id")) for item in inputs if isinstance(item, dict)}
        source_references = []
        source_bundles: list[dict[str, Any]] = []
        for label in labels:
            submission_id = parent["blind_map"][label]
            submission = parent["submissions"][submission_id]
            input_id = f"parent-{label.lower()}"
            suffix = 2
            while input_id in existing_input_ids:
                input_id = f"parent-{label.lower()}-{suffix}"
                suffix += 1
            existing_input_ids.add(input_id)
            parent_submission_dir = (
                self.store.challenge_dir(parent_challenge_id)
                / submission["relative_directory"]
            )
            parent_manifest_path = parent_submission_dir / "submission.json"
            if not parent_manifest_path.is_file():
                raise IntegrityError(
                    f"Parent submission manifest is missing: {submission_id}"
                )
            parent_manifest = read_json(parent_manifest_path)
            source_files: list[dict[str, Any]] = []
            for artifact in parent_manifest.get("artifacts", []):
                try:
                    artifact_rel = safe_relative_path(artifact["path"])
                except (KeyError, ValueError) as exc:
                    raise IntegrityError(
                        f"Parent submission {submission_id} has an unsafe artifact path."
                    ) from exc
                source_path = parent_submission_dir / "artifacts" / artifact_rel
                if not source_path.is_file():
                    raise IntegrityError(
                        f"Parent artifact is missing: {submission_id}/{artifact_rel.as_posix()}"
                    )
                source_hash = sha256_file(source_path)
                source_size = source_path.stat().st_size
                if source_hash != artifact.get("sha256") or source_size != artifact.get(
                    "bytes"
                ):
                    raise IntegrityError(
                        f"Parent artifact no longer matches its evidence: "
                        f"{submission_id}/{artifact_rel.as_posix()}"
                    )
                source_files.append(
                    {
                        "path": artifact_rel.as_posix(),
                        "bytes": source_size,
                        "sha256": source_hash,
                    }
                )

            if copy_inputs:
                bundle_name = f"{input_id}-{submission_id[:16]}"
                relative_root = (
                    Path("lineage-inputs") / bundle_name / "artifacts"
                ).as_posix()
                root_scope = "relative_to_challenge_directory"
            else:
                relative_root = (
                    Path("challenges")
                    / parent_challenge_id
                    / submission["relative_directory"]
                    / "artifacts"
                ).as_posix()
                root_scope = "relative_to_arena_workspace"
            reference = {
                "id": input_id,
                "kind": "arena_candidate",
                "required": True,
                "source_challenge_id": parent_challenge_id,
                "blind_label": label,
                "submission_id": submission_id,
                "content_hash": submission.get("content_hash"),
                "artifact_set_hash": submission.get("artifact_set_hash"),
                "artifact_root": relative_root,
                "artifact_root_scope": root_scope,
                "artifact_files": source_files,
                "source_manifest_hash": sha256_json(parent_manifest),
                "copied_into_child": bool(copy_inputs),
                "authority": "proposed-evidence-only",
            }
            inputs.append(reference)
            source_references.append(reference)
            source_bundles.append(
                {
                    "reference": reference,
                    "source_root": parent_submission_dir / "artifacts",
                    "source_files": source_files,
                }
            )
        child_packet["inputs"] = inputs
        child_packet.setdefault("notes", []).append(
            f"Follow-up of {parent_challenge_id} in {mode} mode. Parent outputs remain immutable; references are not automatic approval."
        )

        child_state = self.create_challenge(child_packet, actor=actor)
        if inherited_sealed_inputs:
            try:
                for inherited in inherited_sealed_inputs:
                    sealed = self.seal_draft_input(
                        child_id,
                        inherited["input_id"],
                        inherited["source_root"],
                        actor=actor,
                    )
                    sealed_input = sealed["input"]
                    if (
                        sealed_input.get("artifact_set_hash")
                        != inherited.get("artifact_set_hash")
                        or sealed_input.get("artifact_files")
                        != inherited.get("artifact_files")
                    ):
                        raise IntegrityError(
                            f"Inherited source input {inherited['input_id']!r} changed "
                            "between parent verification and child sealing."
                        )
                child_state = self.get(child_id)
            except Exception as exc:
                try:
                    self.abort(
                        child_id,
                        f"Follow-up base input sealing failed: {type(exc).__name__}",
                        actor=actor,
                    )
                except Exception:
                    pass
                raise

        lineage_input_receipt: dict[str, Any] | None = None
        if copy_inputs and source_bundles:
            child_dir = self.store.challenge_dir(child_id)
            staging = child_dir / ".lineage-inputs.staging"
            final_root = child_dir / "lineage-inputs"
            if staging.exists() or final_root.exists():
                raise IntegrityError(
                    f"Follow-up lineage input destination unexpectedly exists for {child_id}."
                )
            try:
                for bundle in source_bundles:
                    reference = bundle["reference"]
                    relative_artifact_root = safe_relative_path(
                        reference["artifact_root"]
                    )
                    relative_inside_lineage = relative_artifact_root.relative_to(
                        "lineage-inputs"
                    )
                    destination_root = staging / relative_inside_lineage
                    for evidence in bundle["source_files"]:
                        rel = safe_relative_path(evidence["path"])
                        source = bundle["source_root"] / rel
                        target = destination_root / rel
                        target.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(source, target)
                        if (
                            target.stat().st_size != evidence["bytes"]
                            or sha256_file(target) != evidence["sha256"]
                        ):
                            raise IntegrityError(
                                f"Follow-up input changed while being copied: "
                                f"{reference['id']}/{rel.as_posix()}"
                            )
                staging.replace(final_root)
            except Exception as exc:
                shutil.rmtree(staging, ignore_errors=True)
                try:
                    self.abort(
                        child_id,
                        f"Follow-up input sealing failed: {type(exc).__name__}",
                        actor=actor,
                    )
                except Exception:
                    pass
                raise

            receipt_core = {
                "schema_version": "axm.challenge-lineage-input-receipt/0.2",
                "child_challenge_id": child_id,
                "parent_challenge_id": parent_challenge_id,
                "parent_event_head": parent.get("event_head"),
                "mode": mode,
                "copied": True,
                "inputs": copy.deepcopy(source_references),
                "created_at": utc_now(),
                "authority": "evidence-copy-only-not-approval",
            }
            lineage_input_receipt = {
                **receipt_core,
                "receipt_hash": sha256_json(receipt_core),
            }
            receipt_path = child_dir / "lineage-inputs.json"
            atomic_write_json(receipt_path, lineage_input_receipt)
            with self._access(child_id):
                current_child = self.store.load(child_id)
                current_child["lineage_inputs"] = copy.deepcopy(
                    lineage_input_receipt
                )
                self._commit(
                    current_child,
                    action="FOLLOWUP_INPUTS_SEALED",
                    actor=actor,
                    payload={
                        "parent_challenge_id": parent_challenge_id,
                        "input_count": len(source_references),
                        "receipt_hash": lineage_input_receipt["receipt_hash"],
                        "receipt_file_sha256": sha256_file(receipt_path),
                    },
                )
                child_state = copy.deepcopy(current_child)
        copied_participants = []
        if copy_participants:
            for participant_id, participant in sorted(parent.get("participants", {}).items()):
                self.register_participant(
                    child_id,
                    participant_id,
                    display_name=participant.get("display_name"),
                    adapter=participant.get("adapter", "filesystem"),
                    capabilities=participant.get("capabilities", []),
                    can_submit=participant.get("can_submit", True),
                    can_review=participant.get("can_review", True),
                    review_required=participant.get("review_required", True),
                    independence_group=participant.get("independence_group"),
                    metadata=copy.deepcopy(participant.get("metadata", {})),
                    actor=actor,
                )
                copied_participants.append(participant_id)
            child_state = self.get(child_id)

        followup_record = {
            "challenge_id": child_id,
            "mode": mode,
            "selected_blind_labels": labels,
            "child_packet_hash": child_state.get("packet_hash"),
            "copied_participants": copied_participants,
            "inputs_copied_into_child": bool(copy_inputs and source_references),
            "lineage_input_receipt_hash": (
                lineage_input_receipt.get("receipt_hash")
                if lineage_input_receipt
                else None
            ),
            "created_at": utc_now(),
            "created_by": actor,
        }
        with self._access(parent_challenge_id):
            current_parent = self.store.load(parent_challenge_id)
            current_parent.setdefault("followups", []).append(followup_record)
            integration_sidecar = self._json_sidecar(
                "reports/integration-return.json",
                self._integration_return_from_state(current_parent),
            )
            self._commit(
                current_parent,
                action="FOLLOWUP_SPAWNED",
                actor=actor,
                payload={
                    **followup_record,
                    "report_file_sha256": {
                        integration_sidecar["relative_path"]: integration_sidecar[
                            "sha256"
                        ]
                    },
                },
                sidecars=[integration_sidecar],
            )
        return {
            "schema_version": "axm.challenge-followup-return/0.2",
            "parent_challenge_id": parent_challenge_id,
            "followup": followup_record,
            "source_references": source_references,
            "lineage_input_receipt": lineage_input_receipt,
            "child": copy.deepcopy(child_state),
            "authority_note": "The child starts in DRAFT. Nothing from the parent was silently merged or approved.",
        }

    @_serialized_read()
    def lineage_view(self, challenge_id: str) -> dict[str, Any]:
        state = self.store.load(challenge_id)
        ancestry = []
        seen = {challenge_id}
        parent_id = state.get("lineage", {}).get("parent_challenge_id")
        while parent_id and parent_id not in seen and self.store.exists(parent_id):
            seen.add(parent_id)
            parent = self.store.load(parent_id)
            ancestry.append(
                {
                    "challenge_id": parent_id,
                    "state": parent.get("state"),
                    "title": parent.get("packet", {}).get("title"),
                    "event_head": parent.get("event_head"),
                }
            )
            parent_id = parent.get("lineage", {}).get("parent_challenge_id")
        children = [
            summary
            for summary in self.store.list_summaries()
            if summary.get("parent_challenge_id") == challenge_id
        ]
        return {
            "schema_version": "axm.challenge-lineage/0.2",
            "challenge_id": challenge_id,
            "lineage": copy.deepcopy(state.get("lineage", {})),
            "ancestry_nearest_first": ancestry,
            "children": children,
            "recorded_followups": copy.deepcopy(state.get("followups", [])),
            "sealed_lineage_inputs": copy.deepcopy(state.get("lineage_inputs")),
        }

    def export_evidence_bundle(
        self,
        challenge_id: str,
        destination: str | Path | None = None,
        *,
        allow_invalid: bool = False,
    ) -> dict[str, Any]:
        """Export a timestamp-stable ZIP of the complete challenge evidence snapshot."""

        with self._access(challenge_id):
            state = self.store.load(challenge_id)
            integrity = self.verify_integrity(challenge_id)
            if not integrity.get("valid") and not allow_invalid:
                raise IntegrityError(
                    "Challenge integrity is invalid; repair or pass allow_invalid=True for a diagnostic bundle."
                )
            if destination is None:
                head = str(state.get("event_head") or "no-events")[:12]
                destination = self.root / "exports" / f"{challenge_id}-{head}.zip"
            destination_path = Path(destination).expanduser().resolve(strict=False)
            challenges_root = self.store.challenges_root.resolve(strict=True)
            try:
                destination_path.relative_to(challenges_root)
            except ValueError:
                pass
            else:
                raise ValidationError(
                    "Evidence bundle destination may not be inside Arena-managed challenge storage."
                )
            if destination_path.exists() and destination_path.is_symlink():
                raise ValidationError(
                    "Evidence bundle destination may not be a symbolic link."
                )
            if destination_path.exists() and not destination_path.is_file():
                raise ValidationError(
                    "Evidence bundle destination exists but is not a regular file."
                )

            snapshot_binding = {
                key: state.get(key)
                for key in (
                    "challenge_id",
                    "packet_hash",
                    "rubric_hash",
                    "event_head",
                    "event_sequence",
                    "updated_at",
                )
            }
            result = build_challenge_bundle(
                challenge_dir=self.store.challenge_dir(challenge_id),
                state=state,
                integrity_report=integrity,
                destination=destination_path,
            )
            current = self.store.load(challenge_id)
            current_binding = {key: current.get(key) for key in snapshot_binding}
            post_integrity = self.verify_integrity(challenge_id)
            if current_binding != snapshot_binding:
                destination_path.unlink(missing_ok=True)
                raise IntegrityError(
                    "Challenge snapshot changed during evidence export; discarded the mixed bundle."
                )
            if not allow_invalid and not post_integrity.get("valid"):
                destination_path.unlink(missing_ok=True)
                raise IntegrityError(
                    "Challenge integrity changed during evidence export; discarded the bundle."
                )
            result["snapshot_stable_after_export"] = True
            result["post_export_integrity_valid"] = bool(post_integrity.get("valid"))
            return result

    @_serialized_read()
    def get(self, challenge_id: str) -> dict[str, Any]:
        return self.store.load(challenge_id)

    def list(self) -> list[dict[str, Any]]:
        with self._access(recover=False):
            self.store.recover_all()
            return self.store.list_summaries()

    def capabilities(self) -> dict[str, Any]:
        """Describe the installed module surface without opening a challenge."""

        from .presets import PRESETS

        return {
            "schema_version": "axm.challenge-arena-capabilities/0.5",
            "arena_version": __version__,
            "artifact_presets": sorted(PRESETS),
            "deterministic_validators": self.engine.registry.kinds(),
            "challenge_states": [state.value for state in ChallengeState],
            "features": [
                "locked packet and rubric acknowledgements",
                "cross-process local file locking and write-ahead recovery",
                "event-bound crash-recoverable review and report sidecars",
                "immutable candidate and review revisions with preserved evidence files",
                "signed external deterministic-runner receipts",
                "non-punitive duplicate and convergence diagnostics",
                "commit-reveal opaque blind aliases, reviewer-specific packet binding, and self-vote blocking",
                "optimistic revision preconditions that reject stale submission and review replacements",
                "deterministic all-to-all or balanced review assignment with coverage evidence",
                "non-punitive candidate instruction-injection diagnostics and a hash-bound review protocol",
                "strict JSON intake and portable cross-platform path collision rejection",
                "bounded pipe-based command output, timeout, replay-file budgets, and best-effort process-tree cleanup",
                "robust locked-rubric vote aggregation, declared reviewer-independence coverage, convergence diagnostics, and dissent preservation",
                "proposed-only merge maps and explicit human decisions",
                "portable filesystem bridge bundles and idempotent safe-phase sync",
                "challenge-owned hash-bound draft input sealing and portable build input copies",
                "follow-up rounds that reverify and reseal inherited source inputs into child-owned evidence",
                "portable follow-up rounds with sealed parent-candidate evidence copies",
                "reproducible full evidence ZIP export",
                "fairness-oriented AI seat tasks with equal locked phase budgets",
                "lease, heartbeat, retry, dead-letter, and non-punitive availability evidence",
                "bearer lease tokens stored only as contextual hashes",
                "standalone evidence-bundle verification without workspace trust",
                "ZIP-order-independent canonical event verification for portable evidence repacks",
                "observer-safe progress, integrity, and lineage side routes with count-only identity sealing",
                "read-only local observer",
            ],
            "authority_boundaries": {
                "automatic_merge": False,
                "automatic_human_decision": False,
                "candidate_execution_default": False,
                "execution_flag_is_a_security_sandbox": False,
                "blind_review_guarantees_perfect_anonymity": False,
                "hmac_receipt_proves_measurement_truth": False,
                "sealed_input_proves_semantic_correctness": False,
                "candidate_content_is_reviewer_instruction": False,
                "review_safety_signal_is_automatic_penalty": False,
                "bounded_execution_is_a_security_sandbox": False,
                "seat_failure_is_automatic_candidate_penalty": False,
                "budget_overrun_is_automatic_candidate_penalty": False,
            },
            "runtime": {
                "candidate_execution_enabled": self.engine.allow_execution,
                "trusted_external_runner_key_ids": sorted(
                    self.trusted_runner_keys
                ),
                "unsigned_external_receipts_enabled": self.allow_unsigned_receipts,
            },
        }

    @_serialized_read()
    def public_view(self, challenge_id: str) -> dict[str, Any]:
        """Return observer-safe state without authorship, ballot, or receipt leakage."""

        state = copy.deepcopy(self.store.load(challenge_id))
        state.pop("blind_seed", None)
        reveal_policy = bool(
            state["packet"]["participant_policy"].get("reveal_authors_after_close", True)
        )
        voting_closed = state["state"] in {
            ChallengeState.VOTING_CLOSED.value,
            ChallengeState.SYNTHESIZED.value,
            ChallengeState.FINALIZED.value,
        }
        can_reveal_authors = reveal_policy and voting_closed
        hide_live_blind_label_set = bool(
            not voting_closed
            and state.get("packet", {}).get("schema_version") == "axm.challenge-arena/0.5"
            and state.get("packet", {}).get("participant_policy", {}).get(
                "hide_reviewer_own_blind_label", True
            )
        )

        private_diagnostics = state.pop("candidate_diagnostics", {})
        raw_receipts = state.pop("external_receipts", {})
        receipt_count = sum(
            len(bucket)
            for bucket in raw_receipts.values()
            if isinstance(bucket, dict)
        )
        state["candidate_diagnostics_private_hash"] = private_diagnostics.get(
            "diagnostics_hash"
        )
        state["external_receipts"] = (
            {"verified_receipt_count": receipt_count, "details_hidden": True}
            if voting_closed
            else {"sealed_receipt_count": receipt_count, "details_hidden": True}
        )
        raw_tasks = state.pop("seat_tasks", {})
        if can_reveal_authors:
            state["seat_tasks"] = {
                task_id: public_task(task)
                for task_id, task in sorted(raw_tasks.items())
                if isinstance(task, dict)
            }
        else:
            state["seat_tasks"] = {
                "details_hidden": True,
                "report": public_orchestration_report(
                    orchestration_report({**state, "seat_tasks": raw_tasks})
                ),
            }
            state["seat_task_index"] = {}
            state["seat_task_plans"] = {
                phase: {
                    "task_plan_hash": plan.get("task_plan_hash"),
                    "task_count": plan.get("task_count"),
                    "required_task_count": plan.get("required_task_count"),
                    "details_hidden": True,
                }
                for phase, plan in state.get("seat_task_plans", {}).items()
                if isinstance(plan, dict)
            }
            state["orchestration_reports"] = {
                phase: public_orchestration_report(report)
                for phase, report in state.get("orchestration_reports", {}).items()
                if isinstance(report, dict)
            }

        if not can_reveal_authors:
            state["participants"] = {
                participant_id: {
                    "participant_id": participant_id,
                    "capabilities": participant.get("capabilities", []),
                    "can_submit": participant.get("can_submit"),
                    "can_review": participant.get("can_review"),
                    "review_required": participant.get("review_required"),
                }
                for participant_id, participant in state.get("participants", {}).items()
            }
            for submission in state.get("submissions", {}).values():
                submission.pop("participant_id", None)
            state["participant_active_submission"] = {}
            state["participant_active_review"] = {}

        if not can_reveal_authors:
            # Per-reviewer assignment omissions can reveal which blind candidate is
            # their own. Keep only aggregate load/coverage evidence until the locked
            # authorship reveal policy permits the map itself.
            assignment_report = state.get("review_assignment_report", {})
            state["review_assignments"] = {}
            state["review_assignment_report"] = {
                key: copy.deepcopy(assignment_report.get(key))
                for key in (
                    "schema_version",
                    "mode",
                    "assignment_algorithm",
                    "assignment_hash",
                    "candidate_target",
                    "requested_candidate_target_assignments",
                    "achieved_candidate_target_assignments",
                    "target_coverage_feasible_under_cap",
                    "supplemental_participation_assignments",
                    "candidate_coverage",
                    "reviewer_loads",
                    "all_candidate_targets_met",
                    "unmet_candidate_targets",
                )
                if key in assignment_report
            }
            if hide_live_blind_label_set:
                candidate_coverage = assignment_report.get("candidate_coverage", {})
                coverage_values = [
                    int(value)
                    for value in candidate_coverage.values()
                    if isinstance(value, int) and not isinstance(value, bool)
                ] if isinstance(candidate_coverage, dict) else []
                unmet = assignment_report.get("unmet_candidate_targets", {})
                state["review_assignment_report"].pop("candidate_coverage", None)
                state["review_assignment_report"].pop("unmet_candidate_targets", None)
                state["review_assignment_report"]["candidate_count"] = len(
                    state.get("blind_map", {})
                )
                state["review_assignment_report"]["candidate_coverage_summary"] = {
                    "minimum": min(coverage_values) if coverage_values else None,
                    "maximum": max(coverage_values) if coverage_values else None,
                    "values_hidden": True,
                }
                state["review_assignment_report"]["unmet_candidate_target_count"] = (
                    len(unmet) if isinstance(unmet, dict) else 0
                )
                state["review_assignment_report"]["blind_label_set_hidden"] = True
            state["review_assignment_report"]["assignment_details_hidden"] = True

        if not voting_closed:
            # Live ballots can reveal preferences and reconstruct own-candidate omissions.
            active_reviews = [
                review
                for review in state.get("reviews", {}).values()
                if review.get("status") == "ACTIVE"
            ]
            state["reviews"] = {
                f"sealed-review-{index:02d}": {
                    "status": "ACTIVE",
                    "submitted_at": review.get("submitted_at"),
                }
                for index, review in enumerate(active_reviews, start=1)
            }
            if hide_live_blind_label_set:
                blind_count = len(state.get("blind_map", {}))
                state["blind_candidate_count"] = blind_count
                state["blind_label_set_hidden"] = True
                state["blind_map"] = {}
                blind_diagnostics = state.get("blind_candidate_diagnostics", {})
                if isinstance(blind_diagnostics, dict):
                    state["blind_candidate_diagnostics"] = {
                        "schema_version": blind_diagnostics.get("schema_version"),
                        "scan_complete": blind_diagnostics.get("scan_complete"),
                        "scan_error_count": blind_diagnostics.get("scan_error_count"),
                        "artifact_binding_hash": blind_diagnostics.get("artifact_binding_hash"),
                        "source_diagnostics_hash": blind_diagnostics.get("source_diagnostics_hash"),
                        "candidate_count": blind_count,
                        "details_hidden": True,
                    }
                content_safety = state.get("review_content_safety", {})
                if isinstance(content_safety, dict):
                    state["review_content_safety"] = {
                        "schema_version": content_safety.get("schema_version"),
                        "protocol_hash": content_safety.get("protocol_hash"),
                        "report_hash": content_safety.get("report_hash"),
                        "candidate_count": blind_count,
                        "category_totals": copy.deepcopy(content_safety.get("category_totals", {})),
                        "non_punitive": content_safety.get("non_punitive", True),
                        "details_hidden": True,
                    }
            else:
                state["blind_map"] = {label: None for label in state.get("blind_map", {})}
        elif not can_reveal_authors:
            # Voting evidence may be public while reviewer identities remain sealed.
            anonymized_reviews: dict[str, Any] = {}
            for index, review in enumerate(
                [
                    item
                    for item in state.get("reviews", {}).values()
                    if item.get("status") == "ACTIVE"
                ],
                start=1,
            ):
                clean = copy.deepcopy(review)
                clean["reviewer_id"] = f"sealed-reviewer-{index:02d}"
                clean["review_id"] = f"sealed-review-{index:02d}"
                clean.pop("review_hash", None)
                clean.pop("supersedes", None)
                clean.pop("superseded_by", None)
                anonymized_reviews[clean["review_id"]] = clean
            state["reviews"] = anonymized_reviews

            # A locked no-reveal policy also protects reviewer/ballot identity in
            # synthesized audit structures.  The raw result remains unchanged in
            # evidence; only this observer copy receives stable sealed aliases.
            result = state.get("result")
            if isinstance(result, dict):
                reviewer_ids = sorted(
                    participant_id
                    for participant_id, participant in state.get("participants", {}).items()
                    if isinstance(participant, dict) and participant.get("can_review", True)
                )
                reviewer_alias = {
                    reviewer_id: f"sealed-reviewer-{index:02d}"
                    for index, reviewer_id in enumerate(reviewer_ids, start=1)
                }

                def _reviewer_name(value: Any) -> Any:
                    return reviewer_alias.get(str(value), "sealed-reviewer-unknown")

                for row in result.get("reviewer_audit", []):
                    if isinstance(row, dict) and "reviewer_id" in row:
                        row["reviewer_id"] = _reviewer_name(row.get("reviewer_id"))
                for row in result.get("dissent", []):
                    if isinstance(row, dict) and "reviewer_id" in row:
                        row["reviewer_id"] = _reviewer_name(row.get("reviewer_id"))
                ranking = result.get("ranking_comparability", {})
                if isinstance(ranking, dict):
                    for shape in ranking.get("ballot_shapes", []):
                        if isinstance(shape, dict) and "reviewer_id" in shape:
                            shape["reviewer_id"] = _reviewer_name(shape.get("reviewer_id"))

                independence = result.get("review_independence_audit", {})
                raw_groups = independence.get("groups", {}) if isinstance(independence, dict) else {}
                group_names = sorted(
                    group for group in raw_groups if str(group) != "UNDECLARED"
                ) if isinstance(raw_groups, dict) else []
                group_alias = {
                    group: f"sealed-group-{index:02d}"
                    for index, group in enumerate(group_names, start=1)
                }

                def _group_name(value: Any) -> str:
                    text = str(value)
                    if text == "UNDECLARED":
                        return "UNDECLARED"
                    return group_alias.get(text, "sealed-group-unknown")

                similarity = result.get("reviewer_similarity_audit", {})
                if isinstance(similarity, dict):
                    for pair in similarity.get("pairs", []):
                        if not isinstance(pair, dict):
                            continue
                        if "reviewer_a" in pair:
                            pair["reviewer_a"] = _reviewer_name(pair.get("reviewer_a"))
                        if "reviewer_b" in pair:
                            pair["reviewer_b"] = _reviewer_name(pair.get("reviewer_b"))
                        if "independence_group_a" in pair:
                            pair["independence_group_a"] = _group_name(
                                pair.get("independence_group_a")
                            )
                        if "independence_group_b" in pair:
                            pair["independence_group_b"] = _group_name(
                                pair.get("independence_group_b")
                            )
                if isinstance(independence, dict):
                    independence["groups"] = {
                        _group_name(group): sorted(
                            _reviewer_name(member) for member in members
                        )
                        for group, members in raw_groups.items()
                        if isinstance(members, list)
                    } if isinstance(raw_groups, dict) else {}
                    independence["undeclared_reviewers"] = sorted(
                        _reviewer_name(member)
                        for member in independence.get("undeclared_reviewers", [])
                    )
                    independence["identity_details_hidden"] = True

                orchestration_evidence = result.get("orchestration_evidence")
                if isinstance(orchestration_evidence, dict):
                    result["orchestration_evidence"] = public_orchestration_report(
                        orchestration_evidence
                    )
                for gap in result.get("evidence_gaps", []):
                    if not isinstance(gap, dict):
                        continue
                    if gap.get("code") == "MISSING_REQUIRED_REVIEWS":
                        gap["detail"] = "One or more required reviews are missing; reviewer identities are sealed."
                        gap["identity_details_hidden"] = True
                    if "required_incomplete_task_ids" in gap:
                        ids = gap.pop("required_incomplete_task_ids")
                        gap["required_incomplete_task_count"] = (
                            len(ids) if isinstance(ids, list) else None
                        )
                        gap["task_identity_details_hidden"] = True

        return state

    def _integration_return_from_state(self, state: dict[str, Any]) -> dict[str, Any]:
        challenge_id = str(state["challenge_id"])
        winner_label = state.get("result", {}).get("provisional_winner")
        selected_labels = (
            state.get("final_decision", {}).get("selected_blind_labels", [])
            if state.get("final_decision")
            else ([winner_label] if winner_label else [])
        )
        selected = []
        for label in selected_labels:
            submission_id = state.get("blind_map", {}).get(label)
            submission = state.get("submissions", {}).get(submission_id, {})
            if not submission:
                continue
            manifest = self._verified_submission_manifest(state, submission_id)
            selected.append(
                {
                    "blind_label": label,
                    "submission_id": submission_id,
                    "participant_id": submission.get("participant_id"),
                    "content_hash": submission.get("content_hash"),
                    "artifact_set_hash": submission.get("artifact_set_hash"),
                    "artifact_root": (
                        Path("challenges")
                        / challenge_id
                        / submission["relative_directory"]
                        / "artifacts"
                    ).as_posix(),
                    "artifact_root_scope": "relative_to_arena_workspace",
                    "artifacts": manifest.get("artifacts", []),
                }
            )
        return {
            "schema_version": "axm.challenge-arena-return/0.4",
            "arena_version": __version__,
            "challenge_id": challenge_id,
            "source_module": state["packet"].get("integration", {}).get("source_module", "standalone"),
            "source_job_id": state["packet"].get("integration", {}).get("source_job_id"),
            "state": state["state"],
            "packet_hash": state["packet_hash"],
            "rubric_hash": state["rubric_hash"],
            "blind_order_audit": {
                "algorithm": state.get("blind_order_algorithm"),
                "seed_commitment": state.get("blind_seed_commitment"),
                "seed_reveal_hash": state.get("blind_seed_reveal_hash"),
                "seed_revealed_at": state.get("blind_seed_revealed_at"),
                "blind_map_hash": sha256_json(state.get("blind_map", {})),
            },
            "provisional_winner": winner_label,
            "recommendation_status": state.get("result", {}).get("recommendation_status"),
            "selected_candidates": selected,
            "result": state.get("result", {}),
            "merge_map": state.get("merge_map", {}),
            "candidate_diagnostics": state.get("blind_candidate_diagnostics", {}),
            "review_assignment": {
                key: copy.deepcopy(
                    state.get("review_assignment_report", {}).get(key)
                )
                for key in (
                    "schema_version",
                    "mode",
                    "assignment_hash",
                    "candidate_target",
                    "candidate_coverage",
                    "all_candidate_targets_met",
                    "unmet_candidate_targets",
                )
                if key in state.get("review_assignment_report", {})
            },
            "review_content_safety": {
                "report_hash": state.get("review_content_safety", {}).get(
                    "report_hash"
                ),
                "protocol_hash": state.get("review_content_safety", {}).get(
                    "protocol_hash"
                ),
                "category_totals": copy.deepcopy(
                    state.get("review_content_safety", {}).get(
                        "category_totals", {}
                    )
                ),
                "non_punitive": True,
            },
            "final_decision": state.get("final_decision"),
            "lineage": state.get("lineage", {}),
            "followups": state.get("followups", []),
            "evidence_gaps": state.get("result", {}).get("evidence_gaps", []),
            "authority_note": "Downstream modules must not treat the provisional winner as a human-approved merge or replacement.",
        }

    @_serialized_read()
    def public_progress(self, challenge_id: str) -> dict[str, Any]:
        """Return count-only observer progress without participant or blind-label maps.

        ``progress()`` intentionally remains adapter-facing and names the missing
        seats. The observer is a different trust boundary: completion timing must
        not become a side-channel for reviewer/submitter identity or candidate
        label inference.
        """

        state = self.store.load(challenge_id)
        submitters = {
            participant_id
            for participant_id, participant in state.get("participants", {}).items()
            if isinstance(participant, dict) and participant.get("can_submit", True)
        }
        submitted = {
            participant_id
            for participant_id, submission_id in state.get(
                "participant_active_submission", {}
            ).items()
            if state.get("submissions", {}).get(submission_id, {}).get("status")
            == "ACTIVE"
        }
        assignment_map = state.get("review_assignments", {})
        reviewers = {
            participant_id
            for participant_id, participant in state.get("participants", {}).items()
            if isinstance(participant, dict)
            and participant.get("can_review", True)
            and participant.get("review_required", True)
            and (not assignment_map or bool(assignment_map.get(participant_id)))
        }
        reviewed = set(state.get("participant_active_review", {}))
        phase = state.get("state")
        next_actions: list[str] = []
        if phase == ChallengeState.DRAFT.value:
            next_actions = ["register participants", "lock challenge"]
        elif phase == ChallengeState.BUILDING.value:
            next_actions = ["collect missing submissions", "close submissions"]
        elif phase == ChallengeState.SUBMISSIONS_CLOSED.value:
            next_actions = ["run deterministic checks"]
        elif phase == ChallengeState.TESTED.value:
            next_actions = ["open blind review"]
        elif phase == ChallengeState.REVIEW_OPEN.value:
            next_actions = ["collect missing reviews", "close voting"]
        elif phase == ChallengeState.VOTING_CLOSED.value:
            next_actions = ["synthesize result and merge map"]
        elif phase == ChallengeState.SYNTHESIZED.value:
            next_actions = ["human decision", "spawn explicit follow-up round"]
        elif phase == ChallengeState.FINALIZED.value:
            next_actions = ["export result/evidence bundle", "spawn optional follow-up round"]

        assignment_report = state.get("review_assignment_report", {})
        coverage = assignment_report.get("candidate_coverage", {})
        coverage_values = [
            int(value)
            for value in coverage.values()
            if isinstance(value, int) and not isinstance(value, bool)
        ] if isinstance(coverage, dict) else []
        orchestration = public_orchestration_report(orchestration_report(state))
        return {
            "schema_version": "axm.challenge-public-progress/0.6",
            "challenge_id": challenge_id,
            "state": phase,
            "packet_hash": state.get("packet_hash"),
            "rubric_hash": state.get("rubric_hash"),
            "submitters": {
                "registered_count": len(submitters),
                "completed_count": len(submitted),
                "missing_count": len(submitters - submitted),
                "all_completed": bool(submitters) and submitters <= submitted,
                "identity_details_hidden": True,
            },
            "reviewers": {
                "required_count": len(reviewers),
                "completed_count": len(reviewed & reviewers),
                "missing_count": len(reviewers - reviewed),
                "all_required_completed": reviewers <= reviewed,
                "identity_details_hidden": True,
            },
            "review_assignment": {
                "mode": assignment_report.get("mode"),
                "assignment_hash": assignment_report.get("assignment_hash"),
                "candidate_count": len(coverage_values),
                "candidate_coverage_summary": {
                    "minimum": min(coverage_values) if coverage_values else None,
                    "maximum": max(coverage_values) if coverage_values else None,
                    "values_hidden": True,
                },
                "all_candidate_targets_met": assignment_report.get(
                    "all_candidate_targets_met"
                ),
                "blind_label_set_hidden": True,
            },
            "active_submission_count": len(submitted),
            "deterministic_result_count": len(state.get("test_results", {})),
            "recommendation_status": state.get("result", {}).get(
                "recommendation_status"
            ),
            "provisional_winner": state.get("result", {}).get("provisional_winner"),
            "orchestration": orchestration,
            "next_actions": next_actions,
            "details_hidden": True,
            "authority_boundary": (
                "Observer progress exposes counts and readiness only; seat identities, "
                "per-seat completion timing, assignments, and blind-label coverage remain sealed."
            ),
        }

    @_serialized_read(recover=False)
    def public_integrity_view(self, challenge_id: str) -> dict[str, Any]:
        """Return observer-safe integrity status without forensic identity detail."""

        raw = self.verify_integrity(challenge_id)
        event_chain = raw.get("event_chain", {})
        orchestration = raw.get("orchestration", {})
        return {
            "schema_version": "axm.challenge-public-integrity/0.6",
            "challenge_id": challenge_id,
            "valid": bool(raw.get("valid", False)),
            "checked_at": raw.get("checked_at"),
            "error_count": len(raw.get("errors", [])),
            "warning_count": len(raw.get("warnings", [])),
            "artifact_submission_count": raw.get("artifact_submission_count", 0),
            "verified_external_receipt_count": raw.get(
                "verified_external_receipt_count", 0
            ),
            "event_chain": {
                "valid": bool(event_chain.get("valid", False)),
                "event_count": event_chain.get("event_count"),
                "error_count": len(event_chain.get("errors", [])),
                "warning_count": len(event_chain.get("warnings", [])),
            },
            "orchestration": {
                "valid": bool(orchestration.get("valid", False)),
                "task_count": orchestration.get("task_count", 0),
                "plan_count": orchestration.get("plan_count", 0),
                "expected_task_count": orchestration.get("expected_task_count", 0),
                "error_count": len(orchestration.get("errors", [])),
                "warning_count": len(orchestration.get("warnings", [])),
                "details_hidden": True,
            },
            "details_hidden": True,
            "authority_boundary": (
                "Observer integrity exposes validity and counts only. Full forensic errors "
                "remain available through the local API/CLI because they may contain seat, "
                "artifact, review, or filesystem identifiers."
            ),
        }

    @_serialized_read()
    def public_lineage_view(self, challenge_id: str) -> dict[str, Any]:
        """Return lineage topology without participant-copy or operator identity leakage."""

        raw = self.lineage_view(challenge_id)
        followups = []
        for item in raw.get("recorded_followups", []):
            if not isinstance(item, dict):
                continue
            copied = item.get("copied_participants", [])
            labels = item.get("selected_blind_labels", [])
            followups.append(
                {
                    "challenge_id": item.get("challenge_id"),
                    "mode": item.get("mode"),
                    "selected_candidate_count": len(labels) if isinstance(labels, list) else 0,
                    "child_packet_hash": item.get("child_packet_hash"),
                    "copied_participant_count": len(copied) if isinstance(copied, list) else 0,
                    "inputs_copied_into_child": item.get("inputs_copied_into_child"),
                    "lineage_input_receipt_hash": item.get(
                        "lineage_input_receipt_hash"
                    ),
                    "created_at": item.get("created_at"),
                    "identity_details_hidden": True,
                }
            )
        lineage = copy.deepcopy(raw.get("lineage", {}))
        if isinstance(lineage, dict):
            labels = lineage.pop("selected_blind_labels", [])
            lineage["selected_candidate_count"] = (
                len(labels) if isinstance(labels, list) else 0
            )
            lineage["blind_label_details_hidden"] = True
        children = []
        for item in raw.get("children", []):
            if not isinstance(item, dict):
                continue
            children.append(
                {
                    key: copy.deepcopy(item.get(key))
                    for key in (
                        "challenge_id",
                        "title",
                        "category",
                        "state",
                        "created_at",
                        "updated_at",
                        "submission_count",
                        "followup_count",
                        "parent_challenge_id",
                    )
                }
            )
        sealed_inputs = raw.get("sealed_lineage_inputs")
        sealed_summary = None
        if isinstance(sealed_inputs, dict):
            inputs = sealed_inputs.get("inputs", [])
            sealed_summary = {
                "present": True,
                "input_count": len(inputs) if isinstance(inputs, list) else 0,
                "receipt_hash": sealed_inputs.get("receipt_hash"),
                "details_hidden": True,
            }
        return {
            "schema_version": "axm.challenge-public-lineage/0.6",
            "challenge_id": challenge_id,
            "lineage": lineage,
            "ancestry_nearest_first": copy.deepcopy(
                raw.get("ancestry_nearest_first", [])
            ),
            "children": children,
            "recorded_followups": followups,
            "sealed_lineage_inputs": sealed_summary,
            "details_hidden": True,
            "authority_boundary": (
                "Observer lineage exposes topology and counts only; copied participant ids, "
                "operator identities, selected blind labels, and input path details remain sealed."
            ),
        }

    @_serialized_read()
    def integration_return(self, challenge_id: str) -> dict[str, Any]:
        state = self.store.load(challenge_id)
        return self._integration_return_from_state(state)

    @_serialized_read(recover=False)
    def verify_integrity(self, challenge_id: str) -> dict[str, Any]:
        """Recompute challenge evidence without mutating or repairing stored data."""

        state = self.store.load(challenge_id)
        packet_schema_version = str(state.get("packet", {}).get("schema_version", ""))
        is_v04_packet = packet_schema_version in {
            "axm.challenge-arena/0.4",
            "axm.challenge-arena/0.5",
        }
        is_v05_packet = packet_schema_version == "axm.challenge-arena/0.5"
        errors: list[str] = []
        warnings: list[str] = []
        challenge_dir = self.store.challenge_dir(challenge_id)
        sealed_input_receipts: dict[str, dict[str, Any]] = {}
        verified_manifests_for_diagnostics: dict[str, dict[str, Any]] = {}

        if packet_hash(state["packet"]) != state.get("packet_hash"):
            errors.append("packet hash mismatch")
        if rubric_hash(state["packet"]) != state.get("rubric_hash"):
            errors.append("rubric hash mismatch")

        blind_seed = state.get("blind_seed")
        blind_commitment = state.get("blind_seed_commitment")
        if state.get("locked_at") and is_v04_packet:
            expected_algorithm = (
                BLIND_ORDER_ALGORITHM_V2 if is_v05_packet else BLIND_ORDER_ALGORITHM_V1
            )
            if state.get("blind_order_algorithm") != expected_algorithm:
                errors.append("blind-order algorithm mismatch")
            if not isinstance(blind_seed, str):
                errors.append("blind-order seed missing from locked state")
            else:
                try:
                    expected_commitment = blind_seed_commitment(
                        challenge_id,
                        blind_seed,
                        algorithm=str(state.get("blind_order_algorithm")),
                    )
                    if expected_commitment != blind_commitment:
                        errors.append("blind-order seed commitment mismatch")
                except Exception as exc:
                    errors.append(
                        f"blind-order seed invalid: {type(exc).__name__}: {exc}"
                    )
        elif state.get("locked_at"):
            warnings.append(
                "Legacy challenge uses deterministic replay blind ordering without a sealed random seed."
            )

        locked_path = challenge_dir / "packet.locked.json"
        locked: dict[str, Any] = {}
        if state.get("locked_at"):
            if locked_path.is_symlink():
                errors.append("locked packet file is a symbolic link")
            elif not locked_path.is_file():
                errors.append("locked packet file missing")
            else:
                try:
                    value = read_json(locked_path)
                    locked = value if isinstance(value, dict) else {}
                except Exception as exc:
                    errors.append(f"locked packet file unreadable: {type(exc).__name__}: {exc}")
                if locked:
                    if locked.get("packet_hash") != state.get("packet_hash"):
                        errors.append("locked packet file hash does not match state")
                    if locked.get("rubric_hash") != state.get("rubric_hash"):
                        errors.append("locked rubric file hash does not match state")
                    if packet_hash(locked.get("packet", {})) != state.get("packet_hash"):
                        errors.append("locked packet file content hash mismatch")
                    locked_roster_hash = state.get("locked_participant_roster_hash") or locked.get(
                        "participant_roster_hash"
                    )
                    if locked.get("participant_roster_hash") != locked_roster_hash:
                        errors.append("locked participant roster hash mismatch")
                    if is_v04_packet:
                        if locked.get("blind_order_algorithm") != state.get(
                            "blind_order_algorithm"
                        ):
                            errors.append("locked blind-order algorithm mismatch")
                        if locked.get("blind_seed_commitment") != blind_commitment:
                            errors.append("locked blind-seed commitment mismatch")
                    if sorted(locked.get("registered_participants", [])) != sorted(
                        set(locked.get("registered_participants", []))
                    ):
                        errors.append("locked participant roster contains duplicates")

            current_roster_hash = sha256_json(state.get("participants", {}))
            if current_roster_hash != state.get("participant_roster_hash"):
                errors.append("current participant roster hash mismatch")
            if not state["packet"]["participant_policy"].get(
                "allow_late_registration", False
            ):
                locked_roster_hash = state.get("locked_participant_roster_hash") or state.get(
                    "participant_roster_hash"
                )
                if current_roster_hash != locked_roster_hash:
                    errors.append("participant roster changed after a sealed lock")

        for input_item in state.get("packet", {}).get("inputs", []):
            if not isinstance(input_item, dict) or not input_item.get("seal_receipt_hash"):
                continue
            input_id = str(input_item.get("id", ""))
            if not input_id:
                errors.append("sealed packet input has no input id")
                continue
            if input_item.get("artifact_root_scope") != "relative_to_challenge_directory":
                errors.append(f"sealed packet input {input_id!r} is not challenge-local")
                continue
            expected_root = (Path("inputs") / input_id / "artifacts").as_posix()
            if input_item.get("artifact_root") != expected_root:
                errors.append(f"sealed packet input {input_id!r} has an unexpected artifact root")
                continue
            try:
                relative_root = safe_relative_path(str(input_item["artifact_root"]))
            except (KeyError, ValueError) as exc:
                errors.append(f"sealed packet input {input_id!r} has an unsafe root: {exc}")
                continue
            root_path = challenge_dir / relative_root
            if root_path.is_symlink() or not root_path.is_dir():
                errors.append(f"sealed packet input {input_id!r} root is missing or symbolic")
                continue

            actual_evidence: list[dict[str, Any]] = []
            declared_paths: set[str] = set()
            declared_files = input_item.get("artifact_files", [])
            if not isinstance(declared_files, list) or not declared_files:
                errors.append(f"sealed packet input {input_id!r} has no file evidence")
                continue
            for evidence in declared_files:
                if not isinstance(evidence, dict):
                    errors.append(f"sealed packet input {input_id!r} has malformed file evidence")
                    continue
                try:
                    rel = safe_relative_path(str(evidence["path"]))
                except (KeyError, ValueError) as exc:
                    errors.append(
                        f"sealed packet input {input_id!r} has an unsafe artifact path: {exc}"
                    )
                    continue
                rel_text = rel.as_posix()
                if rel_text in declared_paths:
                    errors.append(
                        f"sealed packet input {input_id!r} repeats artifact path {rel_text!r}"
                    )
                    continue
                declared_paths.add(rel_text)
                path = root_path / rel
                if path.is_symlink():
                    errors.append(
                        f"sealed packet input {input_id!r} contains a symbolic link: {rel_text}"
                    )
                    continue
                if not path.is_file():
                    errors.append(f"sealed packet input {input_id!r} artifact missing: {rel_text}")
                    continue
                size = path.stat().st_size
                digest = sha256_file(path)
                if size != evidence.get("bytes"):
                    errors.append(
                        f"sealed packet input {input_id!r} byte count mismatch: {rel_text}"
                    )
                if digest != evidence.get("sha256"):
                    errors.append(f"sealed packet input {input_id!r} hash mismatch: {rel_text}")
                actual_evidence.append({"path": rel_text, "bytes": size, "sha256": digest})

            actual_paths: set[str] = set()
            for stored_path in sorted(root_path.rglob("*")):
                if stored_path.is_symlink():
                    errors.append(
                        f"sealed packet input {input_id!r} contains a symbolic link: "
                        f"{stored_path.relative_to(root_path).as_posix()}"
                    )
                elif stored_path.is_file():
                    actual_paths.add(stored_path.relative_to(root_path).as_posix())
            unexpected_paths = sorted(actual_paths - declared_paths)
            missing_declared_paths = sorted(declared_paths - actual_paths)
            for rel_text in unexpected_paths:
                errors.append(
                    f"sealed packet input {input_id!r} contains an undeclared artifact: {rel_text}"
                )
            for rel_text in missing_declared_paths:
                # A missing path may already have a more specific error above; keep this
                # explicit set-level mismatch for forensic clarity.
                errors.append(
                    f"sealed packet input {input_id!r} declared artifact is absent: {rel_text}"
                )

            calculated_set_hash = artifact_set_hash(actual_evidence)
            if calculated_set_hash != input_item.get("artifact_set_hash"):
                errors.append(f"sealed packet input {input_id!r} artifact set hash mismatch")

            receipt_path = root_path.parent / "input-receipt.json"
            if receipt_path.is_symlink():
                errors.append(f"sealed packet input {input_id!r} receipt is a symbolic link")
                continue
            if not receipt_path.is_file():
                errors.append(f"sealed packet input {input_id!r} receipt file missing")
                continue
            try:
                receipt = read_json(receipt_path)
            except Exception as exc:
                errors.append(
                    f"sealed packet input {input_id!r} receipt unreadable: {type(exc).__name__}: {exc}"
                )
                continue
            if not isinstance(receipt, dict):
                errors.append(f"sealed packet input {input_id!r} receipt is not an object")
                continue
            receipt_core = {key: value for key, value in receipt.items() if key != "receipt_hash"}
            receipt_hash = sha256_json(receipt_core)
            if receipt_hash != receipt.get("receipt_hash"):
                errors.append(f"sealed packet input {input_id!r} receipt self-hash mismatch")
            if receipt_hash != input_item.get("seal_receipt_hash"):
                errors.append(f"sealed packet input {input_id!r} packet/receipt hash mismatch")
            for key in (
                "challenge_id",
                "input_id",
                "artifact_root",
                "artifact_root_scope",
                "artifact_files",
                "artifact_set_hash",
                "sealed_at",
                "authority",
            ):
                expected = challenge_id if key == "challenge_id" else (
                    input_id if key == "input_id" else input_item.get(key)
                )
                if receipt.get(key) != expected:
                    errors.append(
                        f"sealed packet input {input_id!r} receipt differs on {key}"
                    )
            sealed_input_receipts[input_id] = {
                "receipt_hash": receipt_hash,
                "receipt_file_sha256": sha256_file(receipt_path),
                "artifact_set_hash": calculated_set_hash,
            }

        for submission_id, submission in state.get("submissions", {}).items():
            try:
                relative_directory = safe_relative_path(submission["relative_directory"])
            except (KeyError, ValueError) as exc:
                errors.append(f"{submission_id}: unsafe submission directory: {exc}")
                continue
            directory = challenge_dir / relative_directory
            current = directory
            directory_symbolic = False
            while current != challenge_dir:
                if current.is_symlink():
                    errors.append(f"{submission_id}: submission directory uses a symbolic link")
                    directory_symbolic = True
                    break
                parent = current.parent
                if parent == current:
                    errors.append(f"{submission_id}: submission directory escaped challenge root")
                    directory_symbolic = True
                    break
                current = parent
            if directory_symbolic:
                continue
            if not directory.resolve().is_relative_to(challenge_dir.resolve()):
                errors.append(f"{submission_id}: submission directory escapes challenge root")
                continue
            manifest_path = directory / "submission.json"
            if not manifest_path.is_file():
                errors.append(f"{submission_id}: submission manifest missing")
                continue
            try:
                manifest = read_json(manifest_path)
            except Exception as exc:
                errors.append(f"{submission_id}: submission manifest unreadable: {type(exc).__name__}: {exc}")
                continue
            if not isinstance(manifest, dict):
                errors.append(f"{submission_id}: submission manifest is not an object")
                continue
            if sha256_json(manifest) != submission.get("manifest_hash"):
                errors.append(f"{submission_id}: submission manifest hash mismatch")
            if manifest.get("content_hash") != submission.get("content_hash"):
                errors.append(f"{submission_id}: content hash differs between manifest and state")
            if manifest.get("submission_id") != submission_id:
                errors.append(f"{submission_id}: manifest submission_id mismatch")
            if manifest.get("participant_id") != submission.get("participant_id"):
                errors.append(f"{submission_id}: manifest participant_id mismatch")
            if manifest.get("challenge_id") not in {None, challenge_id}:
                errors.append(f"{submission_id}: manifest challenge_id mismatch")
            if submission.get("status") == "ACTIVE":
                verified_manifests_for_diagnostics[submission_id] = copy.deepcopy(manifest)
            if state.get("packet", {}).get("participant_policy", {}).get(
                "require_submission_packet_ack", False
            ):
                if manifest.get("packet_hash") != state.get("packet_hash"):
                    errors.append(f"{submission_id}: manifest packet acknowledgement mismatch")
                if manifest.get("rubric_hash") != state.get("rubric_hash"):
                    errors.append(f"{submission_id}: manifest rubric acknowledgement mismatch")

            artifacts_root = directory / "artifacts"
            if artifacts_root.is_symlink() or not artifacts_root.is_dir():
                errors.append(f"{submission_id}: artifact root is missing or symbolic")
                continue
            file_evidence: list[dict[str, Any]] = []
            declared_paths: set[str] = set()
            artifacts = manifest.get("artifacts", [])
            if not isinstance(artifacts, list):
                errors.append(f"{submission_id}: manifest artifacts is not a list")
                artifacts = []
            for artifact in artifacts:
                if not isinstance(artifact, dict):
                    errors.append(f"{submission_id}: malformed artifact entry")
                    continue
                try:
                    rel = safe_relative_path(str(artifact["path"]))
                except (KeyError, ValueError) as exc:
                    errors.append(f"{submission_id}: unsafe artifact path {artifact.get('path')!r}: {exc}")
                    continue
                rel_text = rel.as_posix()
                if rel_text in declared_paths:
                    errors.append(f"{submission_id}: duplicate artifact path {rel_text}")
                    continue
                declared_paths.add(rel_text)
                path = artifacts_root / rel
                if path.is_symlink():
                    errors.append(f"{submission_id}: stored artifact is a symbolic link {rel_text}")
                    continue
                if not path.is_file():
                    errors.append(f"{submission_id}: artifact missing {rel_text}")
                    continue
                digest = sha256_file(path)
                size = path.stat().st_size
                if digest != artifact.get("sha256"):
                    errors.append(f"{submission_id}: artifact hash mismatch {rel_text}")
                if size != artifact.get("bytes"):
                    errors.append(f"{submission_id}: artifact byte count mismatch {rel_text}")
                file_evidence.append({"path": rel_text, "bytes": size, "sha256": digest})

            actual_paths: set[str] = set()
            for stored_path in sorted(artifacts_root.rglob("*")):
                rel_text = stored_path.relative_to(artifacts_root).as_posix()
                if stored_path.is_symlink():
                    errors.append(f"{submission_id}: stored artifact tree contains a symbolic link {rel_text}")
                elif stored_path.is_file():
                    actual_paths.add(rel_text)
            for rel_text in sorted(actual_paths - declared_paths):
                errors.append(f"{submission_id}: undeclared stored artifact {rel_text}")
            for rel_text in sorted(declared_paths - actual_paths):
                errors.append(f"{submission_id}: declared stored artifact is absent {rel_text}")

            calculated_artifact_set_hash = artifact_set_hash(file_evidence)
            if calculated_artifact_set_hash != submission.get("artifact_set_hash"):
                errors.append(f"{submission_id}: artifact set hash mismatch")
            if manifest.get("artifact_set_hash") not in {
                None,
                submission.get("artifact_set_hash"),
            }:
                errors.append(f"{submission_id}: manifest artifact set hash mismatch")
            if len(file_evidence) != int(submission.get("artifact_count", len(file_evidence))):
                errors.append(f"{submission_id}: artifact count mismatch")
            actual_total_bytes = sum(item["bytes"] for item in file_evidence)
            if actual_total_bytes != int(submission.get("artifact_bytes", actual_total_bytes)):
                errors.append(f"{submission_id}: artifact byte total mismatch")

            try:
                self._external_receipts_for_submission(state, submission_id)
            except Exception as exc:
                errors.append(
                    f"{submission_id}: external receipt integrity failure: {type(exc).__name__}: {exc}"
                )
            for index in state.get("external_receipts", {}).get(
                submission_id, {}
            ).values():
                if not isinstance(index, dict):
                    continue
                key_id = index.get("signature_key_id")
                if (
                    index.get("signature_present")
                    and key_id
                    and key_id not in self.trusted_runner_keys
                ):
                    warnings.append(
                        f"{submission_id}: receipt key {key_id!r} was valid at ingest but "
                        "was not configured for a fresh HMAC recheck in this process"
                    )

            stored_tests_path = directory / "deterministic-results.json"
            state_tests = state.get("test_results", {}).get(submission_id)
            if state_tests is not None:
                if stored_tests_path.is_symlink():
                    errors.append(f"{submission_id}: deterministic results file is a symbolic link")
                elif not stored_tests_path.is_file():
                    errors.append(f"{submission_id}: deterministic results file missing")
                else:
                    try:
                        disk_tests = read_json(stored_tests_path)
                        if sha256_json(disk_tests) != sha256_json(state_tests):
                            errors.append(f"{submission_id}: deterministic results differ from state")
                    except Exception as exc:
                        errors.append(f"{submission_id}: deterministic results unreadable: {type(exc).__name__}: {exc}")

        blind_map_state = state.get("blind_map", {})
        if blind_map_state:
            active_submissions = [
                submission
                for submission in state.get("submissions", {}).values()
                if submission.get("status") == "ACTIVE"
            ]
            try:
                if is_v04_packet:
                    if not isinstance(blind_seed, str):
                        raise IntegrityError("v0.4 blind seed is missing")
                    expected_blind_map = build_blind_map(
                        active_submissions,
                        challenge_id=challenge_id,
                        packet_hash=state.get("packet_hash", ""),
                        seed=blind_seed,
                        algorithm=str(state.get("blind_order_algorithm", BLIND_ORDER_ALGORITHM_V1)),
                    )
                    mismatch_message = (
                        "blind map does not reproduce from the committed seed and sealed submissions"
                    )
                else:
                    ordered = sorted(
                        active_submissions,
                        key=lambda submission: sha256_json(
                            {
                                "packet_hash": state.get("packet_hash", ""),
                                "content_hash": submission.get("content_hash"),
                            }
                        ),
                    )
                    expected_blind_map = {
                        f"Candidate-{index:02d}": str(submission["submission_id"])
                        for index, submission in enumerate(ordered, start=1)
                    }
                    mismatch_message = (
                        "legacy blind map does not reproduce from packet and content hashes"
                    )
                if expected_blind_map != blind_map_state:
                    errors.append(mismatch_message)
            except Exception as exc:
                errors.append(
                    f"blind map recomputation failed: {type(exc).__name__}: {exc}"
                )

        voting_closed_states = {
            ChallengeState.VOTING_CLOSED.value,
            ChallengeState.SYNTHESIZED.value,
            ChallengeState.FINALIZED.value,
        }
        reveal_path = challenge_dir / "reports" / "blind-seed-reveal.json"
        if is_v04_packet and state.get("state") in voting_closed_states:
            if not state.get("blind_seed_revealed_at"):
                errors.append("blind seed reveal timestamp missing after voting closed")
            if not state.get("blind_seed_reveal_hash"):
                errors.append("blind seed reveal hash missing after voting closed")
            if reveal_path.is_symlink():
                errors.append("blind seed reveal report is a symbolic link")
            elif not reveal_path.is_file():
                errors.append("blind seed reveal report missing after voting closed")
            else:
                try:
                    reveal = read_json(reveal_path)
                    if not isinstance(reveal, dict):
                        errors.append("blind seed reveal report is not an object")
                    else:
                        reveal_core = {
                            key: value
                            for key, value in reveal.items()
                            if key != "reveal_hash"
                        }
                        if sha256_json(reveal_core) != reveal.get("reveal_hash"):
                            errors.append("blind seed reveal self-hash mismatch")
                        if reveal.get("reveal_hash") != state.get(
                            "blind_seed_reveal_hash"
                        ):
                            errors.append("blind seed reveal hash differs from state")
                        if reveal.get("seed") != blind_seed:
                            errors.append("blind seed reveal value differs from locked state")
                        if reveal.get("commitment") != blind_commitment:
                            errors.append("blind seed reveal commitment differs from locked state")
                        if reveal.get("algorithm") != state.get("blind_order_algorithm"):
                            errors.append("blind seed reveal algorithm mismatch")
                        if reveal.get("challenge_id") != challenge_id:
                            errors.append("blind seed reveal challenge mismatch")
                        if reveal.get("blind_map_hash") != sha256_json(
                            blind_map_state
                        ):
                            errors.append("blind seed reveal blind-map hash mismatch")
                        if reveal.get("revealed_at") != state.get(
                            "blind_seed_revealed_at"
                        ):
                            errors.append("blind seed reveal timestamp differs from state")
                except Exception as exc:
                    errors.append(
                        f"blind seed reveal report unreadable: {type(exc).__name__}: {exc}"
                    )
        elif is_v04_packet:
            if state.get("blind_seed_revealed_at") or state.get(
                "blind_seed_reveal_hash"
            ):
                errors.append("blind seed was marked revealed before voting closed")
            if reveal_path.exists():
                errors.append("blind seed reveal report exists before voting closed")

        assignment_report = state.get("review_assignment_report", {})
        assignment_map = state.get("review_assignments", {})
        if assignment_report:
            assignment_core = {
                key: value
                for key, value in assignment_report.items()
                if key != "assignment_hash"
            }
            if sha256_json(assignment_core) != assignment_report.get("assignment_hash"):
                errors.append("review assignment self-hash mismatch")
            if assignment_map != assignment_report.get("assignments", {}):
                errors.append("review assignment map differs from its report")
            try:
                expected_assignment = build_review_assignments(state)
                if sha256_json(expected_assignment) != sha256_json(assignment_report):
                    errors.append("review assignment report is not reproducible from locked state")
            except Exception as exc:
                errors.append(
                    f"review assignment recomputation failed: {type(exc).__name__}: {exc}"
                )
            assignment_path = challenge_dir / "reports" / "review-assignments.json"
            if assignment_path.is_symlink():
                errors.append("review assignment report is a symbolic link")
            elif not assignment_path.is_file():
                errors.append("review assignment report missing")
            else:
                try:
                    if sha256_json(read_json(assignment_path)) != sha256_json(
                        assignment_report
                    ):
                        errors.append("review assignment report differs from state")
                except Exception as exc:
                    errors.append(
                        f"review assignment report unreadable: {type(exc).__name__}: {exc}"
                    )

        content_safety = state.get("review_content_safety", {})
        if content_safety:
            safety_core = {
                key: value
                for key, value in content_safety.items()
                if key != "report_hash"
            }
            if sha256_json(safety_core) != content_safety.get("report_hash"):
                errors.append("review content safety self-hash mismatch")
            if is_v04_packet:
                if content_safety.get("protocol_hash") != REVIEW_PROTOCOL_HASH:
                    errors.append("review content safety protocol hash mismatch")
                try:
                    recomputed_safety = scan_review_content(
                        state,
                        challenge_dir,
                        verified_manifests_for_diagnostics,
                        max_bytes_per_file=int(
                            content_safety.get("scan_limits", {}).get(
                                "max_bytes_per_file", 256 * 1024
                            )
                        ),
                        max_bytes_per_candidate=int(
                            content_safety.get("scan_limits", {}).get(
                                "max_bytes_per_candidate", 2 * 1024 * 1024
                            )
                        ),
                    )
                    if recomputed_safety.get("report_hash") != content_safety.get(
                        "report_hash"
                    ):
                        errors.append(
                            "review content safety report does not reproduce from sealed candidate artifacts"
                        )
                except Exception as exc:
                    errors.append(
                        "review content safety recomputation failed: "
                        f"{type(exc).__name__}: {exc}"
                    )
            else:
                warnings.append(
                    "Legacy review-content safety evidence verified under its original self-hash; "
                    "it was not re-scanned with the v0.4 protocol."
                )
            safety_path = (
                challenge_dir / "reports" / "review-content-safety.blind.json"
            )
            if safety_path.is_symlink():
                errors.append("review content safety report is a symbolic link")
            elif not safety_path.is_file():
                errors.append("review content safety report missing")
            else:
                try:
                    if sha256_json(read_json(safety_path)) != sha256_json(content_safety):
                        errors.append("review content safety report differs from state")
                except Exception as exc:
                    errors.append(
                        f"review content safety report unreadable: {type(exc).__name__}: {exc}"
                    )
            protocol_path = challenge_dir / "reports" / "review-protocol.json"
            expected_protocol = {**REVIEW_PROTOCOL, "protocol_hash": REVIEW_PROTOCOL_HASH}
            if protocol_path.is_symlink():
                errors.append("review protocol report is a symbolic link")
            elif not protocol_path.is_file():
                errors.append("review protocol report missing")
            else:
                try:
                    stored_protocol = read_json(protocol_path)
                    if is_v04_packet:
                        if sha256_json(stored_protocol) != sha256_json(expected_protocol):
                            errors.append("review protocol report differs from implementation")
                    elif not isinstance(stored_protocol, dict):
                        errors.append("legacy review protocol report is not an object")
                    else:
                        legacy_protocol_core = {
                            key: value
                            for key, value in stored_protocol.items()
                            if key != "protocol_hash"
                        }
                        if sha256_json(legacy_protocol_core) != stored_protocol.get(
                            "protocol_hash"
                        ):
                            errors.append("legacy review protocol self-hash mismatch")
                        if content_safety.get("protocol_hash") != stored_protocol.get(
                            "protocol_hash"
                        ):
                            errors.append(
                                "legacy review content-safety protocol hash differs from its stored protocol"
                            )
                except Exception as exc:
                    errors.append(
                        f"review protocol report unreadable: {type(exc).__name__}: {exc}"
                    )

        reviews_dir = challenge_dir / "reviews"
        review_hash_exclusions = {
            "review_id",
            "review_hash",
            "status",
            "supersedes",
            "superseded_by",
        }
        known_review_files: set[str] = set()
        active_reviews_by_reviewer: dict[str, list[str]] = {}
        for review_id, review in state.get("reviews", {}).items():
            review_path = reviews_dir / f"{review_id}.json"
            known_review_files.add(review_path.name)
            if review_path.is_symlink():
                errors.append(f"{review_id}: review file is a symbolic link")
                continue
            if not review_path.is_file():
                errors.append(f"{review_id}: review file missing")
                continue
            try:
                disk_review = read_json(review_path)
            except Exception as exc:
                errors.append(f"{review_id}: review file unreadable: {type(exc).__name__}: {exc}")
                continue
            if not isinstance(disk_review, dict):
                errors.append(f"{review_id}: review file is not an object")
                continue
            if disk_review.get("review_id") != review_id:
                errors.append(f"{review_id}: review file id mismatch")
            if disk_review.get("review_hash") != review.get("review_hash"):
                errors.append(f"{review_id}: review file/state hash field mismatch")
            if disk_review.get("supersedes") != review.get("supersedes"):
                errors.append(f"{review_id}: review revision ancestry differs from state")

            disk_core = {
                key: value
                for key, value in disk_review.items()
                if key not in review_hash_exclusions
            }
            state_core = {
                key: value
                for key, value in review.items()
                if key not in review_hash_exclusions
            }
            if sha256_json(disk_core) != disk_review.get("review_hash"):
                errors.append(f"{review_id}: immutable review file hash mismatch")
            if sha256_json(state_core) != review.get("review_hash"):
                errors.append(f"{review_id}: review state hash mismatch")
            if sha256_json(disk_core) != sha256_json(state_core):
                errors.append(f"{review_id}: immutable review content differs from state")

            reviewer_id = str(review.get("reviewer_id", ""))
            if reviewer_id not in state.get("participants", {}):
                errors.append(f"{review_id}: reviewer is absent from participant roster")
            if assignment_report:
                if review.get("assignment_hash") != assignment_report.get(
                    "assignment_hash"
                ):
                    errors.append(f"{review_id}: review assignment hash mismatch")
                if state.get("packet", {}).get("participant_policy", {}).get(
                    "require_review_packet_ack", False
                ):
                    try:
                        expected_packet_hash = self._review_packet_from_state(
                            state, reviewer_id
                        ).get("review_packet_hash")
                        if review.get("review_packet_hash") != expected_packet_hash:
                            errors.append(
                                f"{review_id}: review packet acknowledgement mismatch"
                            )
                        if not review.get("review_packet_acknowledged"):
                            errors.append(
                                f"{review_id}: review packet acknowledgement flag missing"
                            )
                    except Exception as exc:
                        errors.append(
                            f"{review_id}: review packet recomputation failed: "
                            f"{type(exc).__name__}: {exc}"
                        )
                expected_labels = set(assignment_map.get(reviewer_id, []))
                evaluated_labels = set(review.get("evaluations", {}))
                ranked_labels = set(review.get("ranking", []))
                if not evaluated_labels.issubset(expected_labels):
                    errors.append(f"{review_id}: evaluates an unassigned candidate")
                if not ranked_labels.issubset(expected_labels):
                    errors.append(f"{review_id}: ranks an unassigned candidate")
            status = review.get("status")
            if status == "ACTIVE":
                active_reviews_by_reviewer.setdefault(reviewer_id, []).append(review_id)
                if state.get("participant_active_review", {}).get(reviewer_id) != review_id:
                    errors.append(f"{review_id}: active review map does not point to this review")
                if review.get("superseded_by") is not None:
                    errors.append(f"{review_id}: active review unexpectedly has a successor")
            elif status == "SUPERSEDED":
                successor_id = review.get("superseded_by")
                successor = state.get("reviews", {}).get(successor_id)
                if not successor_id or not isinstance(successor, dict):
                    errors.append(f"{review_id}: superseded review has no valid successor")
                elif successor.get("supersedes") != review_id:
                    errors.append(f"{review_id}: successor does not point back to superseded review")
                if state.get("participant_active_review", {}).get(reviewer_id) == review_id:
                    errors.append(f"{review_id}: superseded review is still marked active")
            else:
                errors.append(f"{review_id}: unknown review lifecycle status {status!r}")

            predecessor_id = review.get("supersedes")
            if predecessor_id is not None:
                predecessor = state.get("reviews", {}).get(predecessor_id)
                if not isinstance(predecessor, dict):
                    errors.append(f"{review_id}: predecessor review is missing")
                elif predecessor.get("superseded_by") != review_id:
                    errors.append(f"{review_id}: predecessor does not point to this revision")

        if reviews_dir.is_dir():
            for path in sorted(reviews_dir.glob("*.json")):
                if path.name not in known_review_files:
                    errors.append(f"unreferenced review evidence file: {path.name}")
        for reviewer_id, review_id in state.get("participant_active_review", {}).items():
            review = state.get("reviews", {}).get(review_id)
            if not isinstance(review, dict):
                errors.append(f"active review map for {reviewer_id!r} points to a missing review")
            elif review.get("reviewer_id") != reviewer_id:
                errors.append(f"active review map for {reviewer_id!r} points to another reviewer")
            elif review.get("status") != "ACTIVE":
                errors.append(f"active review map for {reviewer_id!r} points to a non-active review")
        for reviewer_id, review_ids in active_reviews_by_reviewer.items():
            if len(review_ids) != 1:
                errors.append(
                    f"reviewer {reviewer_id!r} has {len(review_ids)} active reviews instead of one"
                )

        reports_dir = challenge_dir / "reports"
        private_diagnostics_path = reports_dir / "candidate-diagnostics.private.json"
        private_diagnostics = state.get("candidate_diagnostics", {})
        if private_diagnostics:
            diagnostics_schema = str(private_diagnostics.get("schema_version", ""))
            if diagnostics_schema == "axm.challenge-candidate-diagnostics/0.4":
                expected_hash = sha256_json(diagnostics_semantic_core(private_diagnostics))
                if private_diagnostics.get("diagnostics_hash") != expected_hash:
                    errors.append("candidate diagnostics self-hash mismatch")
                try:
                    recomputed_diagnostics = analyze_candidates(
                        state,
                        challenge_dir,
                        manifests=verified_manifests_for_diagnostics,
                        high_similarity_threshold=float(
                            private_diagnostics.get("policy", {}).get(
                                "high_text_similarity_threshold", 0.85
                            )
                        ),
                    )
                    if recomputed_diagnostics.get("diagnostics_hash") != private_diagnostics.get(
                        "diagnostics_hash"
                    ):
                        errors.append(
                            "candidate diagnostics do not reproduce from the sealed candidate artifacts"
                        )
                except Exception as exc:
                    errors.append(
                        "candidate diagnostics recomputation failed: "
                        f"{type(exc).__name__}: {exc}"
                    )
            else:
                # v0.2/v0.3 diagnostics intentionally hashed their complete report,
                # including generated_at, and used a different fingerprint algorithm.
                # Verify those bytes according to their own contract rather than
                # rewriting history or falsely treating a genuine old report as corrupt.
                legacy_core = {
                    key: value
                    for key, value in private_diagnostics.items()
                    if key != "diagnostics_hash"
                }
                if private_diagnostics.get("diagnostics_hash") != sha256_json(legacy_core):
                    errors.append("legacy candidate diagnostics self-hash mismatch")
                else:
                    warnings.append(
                        "Legacy candidate diagnostics verified under their original hash contract; "
                        "they were not re-derived with the v0.4 bounded scanner."
                    )
            if private_diagnostics_path.is_symlink():
                errors.append("candidate diagnostics private report is a symbolic link")
            elif not private_diagnostics_path.is_file():
                errors.append("candidate diagnostics private report missing")
            else:
                try:
                    disk = read_json(private_diagnostics_path)
                    if sha256_json(disk) != sha256_json(private_diagnostics):
                        errors.append("candidate diagnostics private report differs from state")
                except Exception as exc:
                    errors.append(f"candidate diagnostics private report unreadable: {type(exc).__name__}: {exc}")

        blind_diagnostics_path = reports_dir / "candidate-diagnostics.blind.json"
        blind_diagnostics_state = state.get("blind_candidate_diagnostics", {})
        if blind_diagnostics_state:
            if blind_diagnostics_state.get("source_diagnostics_hash") != private_diagnostics.get(
                "diagnostics_hash"
            ):
                errors.append("blind candidate diagnostics source hash mismatch")
            if blind_diagnostics_path.is_symlink():
                errors.append("candidate diagnostics blind report is a symbolic link")
            elif not blind_diagnostics_path.is_file():
                errors.append("candidate diagnostics blind report missing")
            else:
                try:
                    disk = read_json(blind_diagnostics_path)
                    if sha256_json(disk) != sha256_json(blind_diagnostics_state):
                        errors.append("candidate diagnostics blind report differs from state")
                except Exception as exc:
                    errors.append(f"candidate diagnostics blind report unreadable: {type(exc).__name__}: {exc}")

        for filename, key in (("result.json", "result"), ("merge-map.json", "merge_map")):
            path = reports_dir / filename
            value = state.get(key)
            if value:
                if path.is_symlink():
                    errors.append(f"{filename}: report file is a symbolic link")
                elif not path.is_file():
                    errors.append(f"{filename}: report file missing")
                else:
                    try:
                        if sha256_json(read_json(path)) != sha256_json(value):
                            errors.append(f"{filename}: report file differs from state")
                    except Exception as exc:
                        errors.append(f"{filename}: report unreadable: {type(exc).__name__}: {exc}")

        if state.get("final_decision"):
            path = reports_dir / "final-decision.json"
            if path.is_symlink():
                errors.append("final-decision.json: report file is a symbolic link")
            elif not path.is_file():
                errors.append("final-decision.json: report file missing")
            else:
                try:
                    if sha256_json(read_json(path)) != sha256_json(
                        state["final_decision"]
                    ):
                        errors.append("final-decision.json: report differs from state")
                except Exception as exc:
                    errors.append(f"final-decision.json: report unreadable: {type(exc).__name__}: {exc}")

        integration_path = reports_dir / "integration-return.json"
        if state.get("state") in {ChallengeState.SYNTHESIZED.value, ChallengeState.FINALIZED.value}:
            if integration_path.is_symlink():
                errors.append("integration-return.json: report file is a symbolic link")
            elif not integration_path.is_file():
                errors.append("integration-return.json: report file missing")
            else:
                try:
                    disk_integration = read_json(integration_path)
                    if is_v04_packet:
                        if sha256_json(disk_integration) != sha256_json(
                            self.integration_return(challenge_id)
                        ):
                            errors.append("integration-return.json: report differs from current state")
                    elif not isinstance(disk_integration, dict):
                        errors.append("integration-return.json: legacy report is not an object")
                    else:
                        legacy_bindings = {
                            "challenge_id": challenge_id,
                            "packet_hash": state.get("packet_hash"),
                            "rubric_hash": state.get("rubric_hash"),
                            "state": state.get("state"),
                        }
                        for key, expected in legacy_bindings.items():
                            if disk_integration.get(key) != expected:
                                errors.append(
                                    f"integration-return.json: legacy {key} binding mismatch"
                                )
                        if disk_integration.get("result") != state.get("result"):
                            errors.append("integration-return.json: legacy result differs from state")
                        if disk_integration.get("merge_map") != state.get("merge_map"):
                            errors.append("integration-return.json: legacy merge map differs from state")
                        if disk_integration.get("final_decision") != state.get("final_decision"):
                            errors.append("integration-return.json: legacy decision differs from state")
                        warnings.append(
                            "Legacy integration return preserved in its original wire shape; "
                            "file bytes remain event-hash bound."
                        )
                except Exception as exc:
                    errors.append(f"integration-return.json: report unreadable: {type(exc).__name__}: {exc}")

        result = state.get("result", {})
        withheld_statuses = {
            "NO_CANDIDATES",
            "ALL_CANDIDATES_INELIGIBLE",
            "EXACT_TIE",
            "INSUFFICIENT_EVIDENCE",
        }
        if result.get("recommendation_status") in withheld_statuses and result.get(
            "provisional_winner"
        ) is not None:
            errors.append("result semantics: provisional winner must be withheld for this status")
        if result.get("recommendation_status") == "EXACT_TIE" and len(
            result.get("exact_tie_labels", [])
        ) < 2:
            errors.append("result semantics: EXACT_TIE lacks multiple tied labels")

        lineage = state.get("lineage", {})
        lineage_receipt = state.get("lineage_inputs")
        if lineage_receipt:
            receipt_path = challenge_dir / "lineage-inputs.json"
            if receipt_path.is_symlink():
                errors.append("lineage input receipt file is a symbolic link")
            elif not receipt_path.is_file():
                errors.append("lineage input receipt file missing")
            else:
                try:
                    disk_receipt = read_json(receipt_path)
                    if sha256_json(disk_receipt) != sha256_json(lineage_receipt):
                        errors.append("lineage input receipt file differs from state")
                except Exception as exc:
                    errors.append(
                        f"lineage input receipt unreadable: {type(exc).__name__}: {exc}"
                    )
            receipt_core = {
                key: value
                for key, value in lineage_receipt.items()
                if key != "receipt_hash"
            }
            if sha256_json(receipt_core) != lineage_receipt.get("receipt_hash"):
                errors.append("lineage input receipt self-hash mismatch")
            if lineage_receipt.get("child_challenge_id") != challenge_id:
                errors.append("lineage input receipt child challenge mismatch")
            if lineage_receipt.get("parent_challenge_id") != lineage.get(
                "parent_challenge_id"
            ):
                errors.append("lineage input receipt parent challenge mismatch")

            packet_inputs = {
                str(item.get("id")): item
                for item in state.get("packet", {}).get("inputs", [])
                if isinstance(item, dict) and item.get("id")
            }
            for reference in lineage_receipt.get("inputs", []):
                if not isinstance(reference, dict):
                    errors.append("lineage input receipt contains a malformed input")
                    continue
                input_id = str(reference.get("id", ""))
                packet_reference = packet_inputs.get(input_id)
                if packet_reference is None:
                    errors.append(f"lineage input {input_id!r} is absent from the child packet")
                elif sha256_json(packet_reference) != sha256_json(reference):
                    errors.append(f"lineage input {input_id!r} differs from the child packet")
                if reference.get("artifact_root_scope") != "relative_to_challenge_directory":
                    errors.append(
                        f"lineage input {input_id!r} is not a sealed child-local evidence copy"
                    )
                    continue
                try:
                    artifact_root = safe_relative_path(str(reference["artifact_root"]))
                except (KeyError, ValueError) as exc:
                    errors.append(f"lineage input {input_id!r} has an unsafe root: {exc}")
                    continue
                root_path = challenge_dir / artifact_root
                file_evidence: list[dict[str, Any]] = []
                for evidence in reference.get("artifact_files", []):
                    if not isinstance(evidence, dict):
                        errors.append(f"lineage input {input_id!r} has malformed file evidence")
                        continue
                    try:
                        rel = safe_relative_path(str(evidence["path"]))
                    except (KeyError, ValueError) as exc:
                        errors.append(
                            f"lineage input {input_id!r} has an unsafe artifact path: {exc}"
                        )
                        continue
                    path = root_path / rel
                    if path.is_symlink():
                        errors.append(
                            f"lineage input {input_id!r} contains a symbolic link: {rel.as_posix()}"
                        )
                        continue
                    if not path.is_file():
                        errors.append(
                            f"lineage input {input_id!r} artifact missing: {rel.as_posix()}"
                        )
                        continue
                    size = path.stat().st_size
                    digest = sha256_file(path)
                    if size != evidence.get("bytes"):
                        errors.append(
                            f"lineage input {input_id!r} byte count mismatch: {rel.as_posix()}"
                        )
                    if digest != evidence.get("sha256"):
                        errors.append(
                            f"lineage input {input_id!r} hash mismatch: {rel.as_posix()}"
                        )
                    file_evidence.append(
                        {"path": rel.as_posix(), "bytes": size, "sha256": digest}
                    )
                if artifact_set_hash(file_evidence) != reference.get(
                    "artifact_set_hash"
                ):
                    errors.append(f"lineage input {input_id!r} artifact set hash mismatch")
        elif lineage.get("parent_challenge_id"):
            candidate_inputs = [
                item
                for item in state.get("packet", {}).get("inputs", [])
                if isinstance(item, dict) and item.get("kind") == "arena_candidate"
            ]
            if any(item.get("copied_into_child") for item in candidate_inputs):
                errors.append("child packet declares copied lineage inputs but has no seal receipt")
            elif candidate_inputs:
                warnings.append(
                    "follow-up uses parent-workspace references rather than portable sealed input copies"
                )

        parent_id = lineage.get("parent_challenge_id")
        if parent_id:
            if self.store.exists(str(parent_id)):
                parent_state = self.store.load(str(parent_id))
                recorded = [
                    item
                    for item in parent_state.get("followups", [])
                    if item.get("challenge_id") == challenge_id
                ]
                if not recorded:
                    errors.append("lineage parent has no matching follow-up record")
                parent_event_head = lineage.get("parent_event_head")
                if parent_event_head:
                    parent_event_hashes = {
                        event.get("event_hash")
                        for event in self.store.read_events(str(parent_id))
                    }
                    if parent_event_head not in parent_event_hashes:
                        errors.append("lineage parent event snapshot is absent from parent history")
            elif lineage_receipt:
                warnings.append(
                    "lineage parent is absent, but the child retains sealed portable evidence copies"
                )
            else:
                errors.append("lineage parent is absent and child inputs are not portable copies")

        event_report = self.store.verify_event_chain(challenge_id)
        errors.extend(f"event chain: {item}" for item in event_report.get("errors", []))
        events = self.store.read_events(challenge_id)
        latest_by_action: dict[str, dict[str, Any]] = {}
        receipt_events: set[tuple[str, str]] = set()
        sealed_input_events: dict[str, dict[str, Any]] = {}
        review_events: dict[str, dict[str, Any]] = {}
        latest_report_file_hashes: dict[str, str] = {}
        latest_transaction_sidecars: dict[str, dict[str, str]] = {}
        for event in events:
            payload = event.get("payload", {})
            latest_by_action[str(event.get("action"))] = payload if isinstance(payload, dict) else {}
            if isinstance(payload, dict) and isinstance(
                payload.get("report_file_sha256"), dict
            ):
                for relative_path, digest in payload["report_file_sha256"].items():
                    latest_report_file_hashes[str(relative_path)] = str(digest)
            if isinstance(payload, dict) and "transaction_sidecars" in payload:
                sidecar_evidence = payload.get("transaction_sidecars")
                if not isinstance(sidecar_evidence, list):
                    errors.append(
                        f"event evidence: transaction sidecars are malformed at sequence {event.get('sequence')}"
                    )
                else:
                    seen_event_sidecars: set[str] = set()
                    for descriptor in sidecar_evidence:
                        if not isinstance(descriptor, dict):
                            errors.append(
                                f"event evidence: malformed transaction sidecar at sequence {event.get('sequence')}"
                            )
                            continue
                        relative_path = str(descriptor.get("relative_path", ""))
                        try:
                            safe_relative_path(relative_path)
                        except ValueError:
                            errors.append(
                                f"event evidence: unsafe transaction sidecar path {relative_path!r}"
                            )
                            continue
                        if relative_path in seen_event_sidecars:
                            errors.append(
                                f"event evidence: duplicate transaction sidecar path {relative_path!r}"
                            )
                            continue
                        seen_event_sidecars.add(relative_path)
                        mode = str(descriptor.get("mode", ""))
                        digest = str(descriptor.get("sha256", ""))
                        if mode not in {"replace", "immutable"}:
                            errors.append(
                                f"event evidence: invalid transaction sidecar mode for {relative_path}"
                            )
                            continue
                        if len(digest) != 64 or any(
                            character not in "0123456789abcdef" for character in digest
                        ):
                            errors.append(
                                f"event evidence: invalid transaction sidecar hash for {relative_path}"
                            )
                            continue
                        latest_transaction_sidecars[relative_path] = {
                            "mode": mode,
                            "sha256": digest,
                        }
            if event.get("action") == "EXTERNAL_RECEIPT_ATTACHED" and isinstance(payload, dict):
                receipt_events.add((str(payload.get("submission_id")), str(payload.get("receipt_hash"))))
            if event.get("action") == "DRAFT_INPUT_SEALED" and isinstance(payload, dict):
                sealed_input_events[str(payload.get("receipt_hash"))] = payload
            if event.get("action") in {"REVIEW_RECORDED", "REVIEW_REVISED"} and isinstance(
                payload, dict
            ):
                review_events[str(payload.get("review_id"))] = payload

        lock_payload = latest_by_action.get("CHALLENGE_LOCKED")
        if state.get("locked_at") and lock_payload:
            expected_locked_roster = state.get("locked_participant_roster_hash") or locked.get(
                "participant_roster_hash"
            )
            if lock_payload.get("packet_hash") != state.get("packet_hash"):
                errors.append("event evidence: locked packet hash mismatch")
            if lock_payload.get("rubric_hash") != state.get("rubric_hash"):
                errors.append("event evidence: locked rubric hash mismatch")
            if lock_payload.get("participant_roster_hash") != expected_locked_roster:
                errors.append("event evidence: locked participant roster hash mismatch")
            if is_v04_packet:
                if lock_payload.get("blind_order_algorithm") != state.get(
                    "blind_order_algorithm"
                ):
                    errors.append("event evidence: locked blind-order algorithm mismatch")
                if lock_payload.get("blind_seed_commitment") != state.get(
                    "blind_seed_commitment"
                ):
                    errors.append("event evidence: locked blind-seed commitment mismatch")
            if locked_path.is_file() and lock_payload.get("locked_packet_file_sha256") not in {
                None,
                sha256_file(locked_path),
            }:
                errors.append("event evidence: locked packet file hash mismatch")

        checks_payload = latest_by_action.get("DETERMINISTIC_CHECKS_COMPLETED")
        if checks_payload and checks_payload.get("test_results_hash") != sha256_json(
            state.get("test_results", {})
        ):
            errors.append("event evidence: deterministic test results hash mismatch")
        blind_payload = latest_by_action.get("BLIND_REVIEW_OPENED")
        if blind_payload:
            if blind_payload.get("blind_map_hash") != sha256_json(state.get("blind_map", {})):
                errors.append("event evidence: blind map hash mismatch")
            if is_v04_packet:
                if blind_payload.get("blind_order_algorithm") != state.get(
                    "blind_order_algorithm"
                ):
                    errors.append("event evidence: blind-order algorithm mismatch")
                if blind_payload.get("blind_seed_commitment") != state.get(
                    "blind_seed_commitment"
                ):
                    errors.append("event evidence: blind-seed commitment mismatch")
            if blind_payload.get("blind_candidate_diagnostics_hash") != sha256_json(
                state.get("blind_candidate_diagnostics", {})
            ):
                errors.append("event evidence: blind candidate diagnostics hash mismatch")
        voting_payload = latest_by_action.get("VOTING_CLOSED")
        if state.get("state") in {
            ChallengeState.VOTING_CLOSED.value,
            ChallengeState.SYNTHESIZED.value,
            ChallengeState.FINALIZED.value,
        }:
            if not voting_payload:
                errors.append("event evidence: voting close event missing")
            elif is_v04_packet:
                if voting_payload.get("blind_seed_commitment") != state.get(
                    "blind_seed_commitment"
                ):
                    errors.append("event evidence: voting blind-seed commitment mismatch")
                if voting_payload.get("blind_seed_reveal_hash") != state.get(
                    "blind_seed_reveal_hash"
                ):
                    errors.append("event evidence: blind-seed reveal hash mismatch")
                if reveal_path.is_file() and voting_payload.get(
                    "blind_seed_reveal_file_sha256"
                ) not in {None, sha256_file(reveal_path)}:
                    errors.append("event evidence: blind-seed reveal file hash mismatch")
        submissions_payload = latest_by_action.get("SUBMISSIONS_CLOSED")
        if submissions_payload and submissions_payload.get(
            "candidate_diagnostics_hash"
        ) != state.get("candidate_diagnostics", {}).get("diagnostics_hash"):
            errors.append("event evidence: candidate diagnostics hash mismatch")
        result_payload = latest_by_action.get("RESULT_SYNTHESIZED")
        if result_payload:
            if result_payload.get("result_hash") != sha256_json(state.get("result", {})):
                errors.append("event evidence: result hash mismatch")
            if result_payload.get("merge_map_hash") != sha256_json(
                state.get("merge_map", {})
            ):
                errors.append("event evidence: merge map hash mismatch")
        sealed_inputs_payload = latest_by_action.get("FOLLOWUP_INPUTS_SEALED")
        if lineage_receipt:
            if not sealed_inputs_payload:
                errors.append("event evidence: lineage inputs lack a sealing event")
            else:
                if sealed_inputs_payload.get("receipt_hash") != lineage_receipt.get(
                    "receipt_hash"
                ):
                    errors.append("event evidence: lineage input receipt hash mismatch")
                receipt_path = challenge_dir / "lineage-inputs.json"
                if receipt_path.is_file() and sealed_inputs_payload.get(
                    "receipt_file_sha256"
                ) != sha256_file(receipt_path):
                    errors.append("event evidence: lineage input receipt file hash mismatch")

        for input_id, receipt_evidence in sealed_input_receipts.items():
            receipt_hash = receipt_evidence["receipt_hash"]
            payload = sealed_input_events.get(receipt_hash)
            if not payload:
                errors.append(
                    f"event evidence: sealed packet input {input_id!r} lacks a sealing event"
                )
                continue
            if payload.get("input_id") != input_id:
                errors.append(
                    f"event evidence: sealed packet input {input_id!r} id mismatch"
                )
            if payload.get("artifact_set_hash") != receipt_evidence["artifact_set_hash"]:
                errors.append(
                    f"event evidence: sealed packet input {input_id!r} artifact set hash mismatch"
                )
            if payload.get("receipt_file_sha256") != receipt_evidence["receipt_file_sha256"]:
                errors.append(
                    f"event evidence: sealed packet input {input_id!r} receipt file hash mismatch"
                )

        for submission_id, bucket in state.get("external_receipts", {}).items():
            if not isinstance(bucket, dict):
                continue
            for receipt_hash in bucket:
                if (submission_id, receipt_hash) not in receipt_events:
                    errors.append(
                        f"event evidence: external receipt {receipt_hash} lacks an attachment event"
                    )

        for review_id, review in state.get("reviews", {}).items():
            payload = review_events.get(review_id)
            if not payload:
                errors.append(f"event evidence: review {review_id} lacks a record event")
                continue
            if payload.get("reviewer_id") != review.get("reviewer_id"):
                errors.append(f"event evidence: review {review_id} reviewer mismatch")
            if payload.get("review_hash") != review.get("review_hash"):
                errors.append(f"event evidence: review {review_id} content hash mismatch")
            if payload.get("supersedes") != review.get("supersedes"):
                errors.append(f"event evidence: review {review_id} ancestry mismatch")
            expected_file_hash = payload.get("review_file_sha256")
            review_path = challenge_dir / "reviews" / f"{review_id}.json"
            if expected_file_hash is not None and (
                not review_path.is_file() or sha256_file(review_path) != expected_file_hash
            ):
                errors.append(f"event evidence: review {review_id} file hash mismatch")

        for relative_path, expected in sorted(latest_report_file_hashes.items()):
            try:
                safe_path = safe_relative_path(relative_path)
            except ValueError:
                errors.append(f"event evidence: unsafe report path {relative_path!r}")
                continue
            path = challenge_dir / safe_path
            if not path.is_file() or sha256_file(path) != expected:
                errors.append(
                    f"event evidence: report file hash mismatch: {relative_path}"
                )

        for relative_path, descriptor in sorted(latest_transaction_sidecars.items()):
            safe_path = safe_relative_path(relative_path)
            path = challenge_dir / safe_path
            if path.is_symlink():
                errors.append(
                    f"event evidence: transaction sidecar is a symbolic link: {relative_path}"
                )
            elif not path.is_file() or sha256_file(path) != descriptor["sha256"]:
                errors.append(
                    f"event evidence: transaction sidecar file hash mismatch: {relative_path}"
                )

        for followup in state.get("followups", []):
            child_id = followup.get("challenge_id")
            if not child_id or not self.store.exists(child_id):
                errors.append(f"follow-up child missing: {child_id!r}")
                continue
            child = self.store.load(child_id)
            if child.get("lineage", {}).get("parent_challenge_id") != challenge_id:
                errors.append(f"follow-up child {child_id} does not point back to parent")
            if child.get("packet_hash") != followup.get("child_packet_hash"):
                errors.append(f"follow-up child {child_id} packet hash differs from parent record")

        orchestration_integrity = verify_orchestration_state(state)
        errors.extend(
            f"orchestration: {item}"
            for item in orchestration_integrity.get("errors", [])
        )
        warnings.extend(
            f"orchestration: {item}"
            for item in orchestration_integrity.get("warnings", [])
        )

        return {
            "valid": not errors,
            "challenge_id": challenge_id,
            "checked_at": utc_now(),
            "errors": errors,
            "warnings": sorted(set(warnings)),
            "event_chain": event_report,
            "artifact_submission_count": len(state.get("submissions", {})),
            "verified_external_receipt_count": sum(
                len(bucket)
                for bucket in state.get("external_receipts", {}).values()
                if isinstance(bucket, dict)
            ),
            "orchestration": orchestration_integrity,
        }
