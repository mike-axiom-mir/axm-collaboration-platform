from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any
import hashlib
import re
import uuid

from . import (
    __version__, CONTRACT_VERSION, MODULE_ID, EXPORT_FORMAT_VERSION,
    PRODUCER_RECEIPT_VERSION,
)
from .canonical_json import PROFILE_ID, PROFILE_VERSION, canonical_sha256
from .io import load_json
from .implementation_identity import implementation_fingerprint
from .learning import learning_atoms, course_plan
from .views import quick_view, practical_view, deep_view
from .validators import (
    validate_card, validate_source, validate_course, validate_producer_receipt,
)


HEX64 = re.compile(r"^[0-9a-f]{64}$")
REQUIRED_INFERENCE_KEYS = {
    "reasoning",
    "source_basis",
    "confidence",
    "evidence_reference",
}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def validate_stable_evidence_policy(card: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    knowledge = _dict(card.get("knowledge"))
    field_states = _dict(knowledge.get("field_states"))
    inferences = [
        item for item in _list(knowledge.get("inferences")) if isinstance(item, dict)
    ]
    inference_by_field: dict[str, list[dict[str, Any]]] = {}
    for item in inferences:
        field = item.get("field")
        if isinstance(field, str) and field:
            inference_by_field.setdefault(field, []).append(item)

    for field, state in field_states.items():
        if state == "inferred":
            candidates = inference_by_field.get(field, [])
            if not candidates:
                issues.append(f"{field}: INFERRED state has no inference evidence object")
                continue
            valid = False
            for item in candidates:
                missing = REQUIRED_INFERENCE_KEYS - set(item)
                confidence = item.get("confidence")
                if not missing and isinstance(confidence, (int, float)) and 0 <= float(confidence) <= 1:
                    if item.get("reasoning") not in (None, "") and item.get("source_basis") not in (None, "", [], {}) and item.get("evidence_reference") not in (None, "", [], {}):
                        valid = True
                        break
            if not valid:
                issues.append(
                    f"{field}: inference requires reasoning, source_basis, confidence 0..1, and evidence_reference"
                )

    unknowns = set(str(item) for item in _list(knowledge.get("unknowns")))
    for field, state in field_states.items():
        if state == "unknown" and field not in unknowns:
            issues.append(f"{field}: UNKNOWN state is missing from knowledge.unknowns")
        if state != "unknown" and field in unknowns:
            issues.append(f"{field}: appears in knowledge.unknowns but state is {state!r}")

    conflict_fields = {
        str(item.get("field"))
        for item in _list(knowledge.get("conflicts"))
        if isinstance(item, dict) and item.get("field")
    }
    for field, state in field_states.items():
        if state == "conflicted" and field not in conflict_fields:
            issues.append(f"{field}: CONFLICTED state has no conflict evidence object")
    for field in conflict_fields:
        if field_states.get(field) != "conflicted":
            issues.append(f"{field}: conflict evidence exists but field state is not CONFLICTED")

    return issues


def validate_stable_provenance_policy(card: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    source = _dict(card.get("source_reference"))
    source_hash = str(source.get("source_hash", ""))
    if not HEX64.fullmatch(source_hash):
        issues.append("source_reference.source_hash must be a lowercase SHA-256 hex digest")
    source_location = str(source.get("source_location", "")).strip()
    if not source_location:
        issues.append("source_reference.source_location is required")
    else:
        if "://" in source_location and not source_location.startswith("file://"):
            issues.append(
                "source_reference.source_location is not locally verifiable; strict provenance requires exact source bytes"
            )
        else:
            local_text = source_location[7:] if source_location.startswith("file://") else source_location
            local_path = Path(local_text)
            if not local_path.is_file():
                issues.append(
                    "source_reference.source_location is not accessible as a local file for strict hash verification"
                )
            elif HEX64.fullmatch(source_hash):
                actual = hashlib.sha256(local_path.read_bytes()).hexdigest()
                if actual != source_hash:
                    issues.append(
                        "source_reference.source_hash does not match the exact source bytes"
                    )
    if source.get("confidence") is None:
        issues.append("source_reference.confidence is required")

    enrichment = _dict(source.get("enrichment"))
    if enrichment:
        declared_enrichment_hash = str(source.get("enrichment_hash", ""))
        enrichment_payload = dict(enrichment)
        enrichment_payload.pop("enrichment_hash", None)
        actual_enrichment_hash = canonical_sha256(enrichment_payload)
        embedded_hash = str(enrichment.get("enrichment_hash", ""))
        if not HEX64.fullmatch(declared_enrichment_hash):
            issues.append("source_reference.enrichment_hash must be a lowercase SHA-256 hex digest")
        elif declared_enrichment_hash != actual_enrichment_hash:
            issues.append("source_reference.enrichment_hash does not match enrichment context")
        if embedded_hash and embedded_hash != actual_enrichment_hash:
            issues.append("embedded enrichment_hash does not match enrichment context")
        for name in ("enrichment_catalog_hash", "enrichment_source_seal_hash"):
            value = str(source.get(name, ""))
            if not HEX64.fullmatch(value):
                issues.append(f"source_reference.{name} must be a lowercase SHA-256 hex digest")
        seen_paths: set[str] = set()
        for item in _list(source.get("enrichment_sources")):
            if not isinstance(item, dict):
                issues.append("source_reference.enrichment_sources entries must be objects")
                continue
            relative = str(item.get("relative_path", ""))
            digest = str(item.get("sha256", ""))
            if not relative:
                issues.append("enrichment source relative_path is required")
            elif relative in seen_paths:
                issues.append(f"duplicate enrichment source relative_path: {relative}")
            else:
                seen_paths.add(relative)
            if not HEX64.fullmatch(digest):
                issues.append(f"enrichment source {relative!r} has invalid SHA-256")
    return issues


def validate_stable_handoff_card(card: dict[str, Any]) -> dict[str, Any]:
    schema_issues = validate_card(card)
    evidence_issues = validate_stable_evidence_policy(card)
    provenance_issues = validate_stable_provenance_policy(card)
    return {
        "valid": not (schema_issues or evidence_issues or provenance_issues),
        "shared_schema": {
            "status": "PASS" if not schema_issues else "FAIL",
            "issues": schema_issues,
        },
        "stable_evidence_policy": {
            "status": "PASS" if not evidence_issues else "FAIL",
            "issues": evidence_issues,
        },
        "stable_provenance_policy": {
            "status": "PASS" if not provenance_issues else "FAIL",
            "issues": provenance_issues,
        },
    }


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


EXPECTED_ARTIFACTS: tuple[tuple[str, str], ...] = (
    ("capability_card.json", "shared_capability_record"),
    ("learning_atoms.json", "learning_atoms"),
    ("course_plan.json", "course_plan"),
    ("quick_view.md", "quick_view"),
    ("practical_view.md", "practical_view"),
    ("deep_view.md", "deep_view"),
)
BUILD_IN_PROGRESS_MARKER = ".build_in_progress.json"


def _safe_relative(value: str) -> bool:
    path = PurePosixPath(value)
    return bool(value) and not path.is_absolute() and "." not in path.parts and ".." not in path.parts


def _portable_normalized_source_hash(record: dict[str, Any]) -> str:
    payload = deepcopy(record)
    ref = payload.get("source_reference")
    if isinstance(ref, dict):
        # Machine-specific/raw-verification timestamps and source locations may
        # legitimately change when the same sealed registry copy is relocated.
        # Technical/enrichment content and all source hashes/pointers remain.
        ref.pop("source_location", None)
        ref.pop("last_verified_at", None)
    return canonical_sha256(payload)


def _artifact_inventory(output_dir: Path) -> list[dict[str, Any]]:
    inventory: list[dict[str, Any]] = []
    for relative, artifact_type in EXPECTED_ARTIFACTS:
        path = output_dir / relative
        if path.is_symlink():
            raise ValueError(f"Artifact may not be a symbolic link: {relative}")
        if not path.is_file():
            raise ValueError(f"Required generated artifact is missing: {relative}")
        inventory.append({
            "relative_path": relative,
            "artifact_type": artifact_type,
            "bytes": path.stat().st_size,
            "sha256": _sha256_file(path),
        })
    return inventory


def _validate_timestamp(value: Any, field: str, issues: list[str]) -> None:
    text = str(value or "")
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("timezone missing")
    except Exception:
        issues.append(f"{field} must be a timezone-aware ISO-8601 timestamp")


def build_producer_receipt(
    *,
    normalized_source_path: str | Path,
    output_dir: str | Path,
    card: dict[str, Any],
    validation: dict[str, Any],
) -> dict[str, Any]:
    source_path = Path(normalized_source_path)
    output_root = Path(output_dir)
    source_ref = _dict(card.get("source_reference"))
    inventory = _artifact_inventory(output_root)
    semantic_hash = _portable_normalized_source_hash(load_json(source_path))
    receipt: dict[str, Any] = {
        "receipt_version": PRODUCER_RECEIPT_VERSION,
        "producer_execution_state": "RUN",
        "producer": {
            "module_id": MODULE_ID,
            "module_version": __version__,
            "implementation_fingerprint": implementation_fingerprint(),
            "shared_contract_version": CONTRACT_VERSION,
            "capability_record_export_format_version": EXPORT_FORMAT_VERSION,
        },
        "run": {
            "run_id": str(uuid.uuid4()),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        },
        "source": {
            "capability_id": card.get("capability_id", ""),
            "capability_revision": card.get("capability_revision", "unknown"),
            "source_location": source_ref.get("source_location", ""),
            "source_hash": source_ref.get("source_hash", ""),
            "source_pointer": source_ref.get("source_pointer", ""),
            "normalized_source_sha256": _sha256_file(source_path),
            # Old field kept as an explicit compatibility alias within the new
            # receipt format. Both values must agree.
            "normalized_source_canonical_sha256": semantic_hash,
            "normalized_source_semantic_sha256": semantic_hash,
        },
        "output": {
            "capability_card_file": "capability_card.json",
            "canonicalization_profile": PROFILE_ID,
            "canonicalization_profile_version": PROFILE_VERSION,
            "capability_card_canonical_sha256": canonical_sha256(card),
            "artifact_inventory": inventory,
            "artifact_set_hash": canonical_sha256(inventory),
        },
        "validation": validation,
        "complete": bool(validation.get("valid")),
    }
    receipt["producer_receipt_hash"] = canonical_sha256(receipt)
    return receipt


def _validate_artifact_set(
    root: Path, receipt: dict[str, Any], card: dict[str, Any], issues: list[str]
) -> dict[str, Any]:
    output = _dict(receipt.get("output"))
    declared_inventory = _list(output.get("artifact_inventory"))
    expected_names = [name for name, _ in EXPECTED_ARTIFACTS]
    declared_names = [str(_dict(item).get("relative_path", "")) for item in declared_inventory]
    if declared_names != expected_names:
        issues.append("Producer receipt artifact inventory membership/order is invalid")

    for relative in declared_names:
        if not _safe_relative(relative):
            issues.append(f"Unsafe artifact relative path: {relative!r}")

    try:
        actual_inventory = _artifact_inventory(root)
    except Exception as exc:
        issues.append(str(exc))
        actual_inventory = []

    if declared_inventory != actual_inventory:
        issues.append("Generated artifact inventory does not match current artifact bytes")
    declared_set_hash = str(output.get("artifact_set_hash", ""))
    if declared_set_hash != canonical_sha256(declared_inventory):
        issues.append("artifact_set_hash does not match the declared artifact inventory")

    allowed = set(expected_names) | {"producer_receipt.json"}
    actual_entries = []
    try:
        actual_entries = sorted(item.name for item in root.iterdir())
    except OSError as exc:
        issues.append(f"Unable to inspect generated output directory: {exc}")
    extras = [name for name in actual_entries if name not in allowed]
    if extras:
        issues.append(f"Unexpected generated output entries: {extras[:10]}")

    # Parse, validate, and deterministically re-derive every derived artifact.
    # Byte hashes prove artifact integrity; regeneration proves that the bytes are
    # the outputs of the current bound implementation for this exact card.
    try:
        atoms = load_json(root / "learning_atoms.json")
        if not isinstance(atoms, list):
            issues.append("learning_atoms.json must contain a JSON array")
        elif atoms != learning_atoms(card):
            issues.append("learning_atoms.json does not match deterministic regeneration from the Capability Card")
    except Exception as exc:
        issues.append(f"learning_atoms.json is invalid: {exc}")
    try:
        course = load_json(root / "course_plan.json")
        course_errors = validate_course(course)
        if course_errors:
            issues.extend(f"course_plan.json: {item}" for item in course_errors)
        if course != course_plan(card):
            issues.append("course_plan.json does not match deterministic regeneration from the Capability Card")
    except Exception as exc:
        issues.append(f"course_plan.json is invalid: {exc}")

    expected_views = {
        "quick_view.md": quick_view(card),
        "practical_view.md": practical_view(card),
        "deep_view.md": deep_view(card),
    }
    for name, expected in expected_views.items():
        try:
            actual = (root / name).read_text(encoding="utf-8")
            if actual != expected:
                issues.append(f"{name} does not match deterministic regeneration from the Capability Card")
        except Exception as exc:
            issues.append(f"{name} is not valid UTF-8 text: {exc}")

    return {
        "declared_inventory": declared_inventory,
        "actual_inventory": actual_inventory,
        "artifact_set_hash": declared_set_hash,
    }


def verify_producer_receipt(output_dir: str | Path) -> dict[str, Any]:
    root = Path(output_dir)
    receipt_path = root / "producer_receipt.json"
    card_path = root / "capability_card.json"
    marker_path = root / BUILD_IN_PROGRESS_MARKER
    issues: list[str] = []
    if marker_path.exists():
        issues.append(f"{BUILD_IN_PROGRESS_MARKER} is present; build is incomplete")
    if not receipt_path.is_file():
        return {"valid": False, "issues": issues + ["producer_receipt.json is missing"]}
    if not card_path.is_file():
        return {"valid": False, "issues": issues + ["capability_card.json is missing"]}
    if receipt_path.is_symlink() or card_path.is_symlink():
        return {"valid": False, "issues": issues + ["Producer receipt/card may not be symbolic links"]}

    try:
        receipt = load_json(receipt_path)
        card = load_json(card_path)
    except Exception as exc:
        return {"valid": False, "issues": issues + [str(exc)]}

    schema_issues = validate_producer_receipt(receipt)
    if schema_issues:
        issues.extend(f"producer receipt schema: {item}" for item in schema_issues)

    hashed_receipt = dict(receipt)
    declared_receipt_hash = str(hashed_receipt.pop("producer_receipt_hash", ""))
    actual_receipt_hash = canonical_sha256(hashed_receipt)
    if declared_receipt_hash != actual_receipt_hash:
        issues.append("producer_receipt_hash mismatch")

    producer = _dict(receipt.get("producer"))
    if producer.get("module_id") != MODULE_ID:
        issues.append("Producer module_id does not match this Atlas")
    if producer.get("module_version") != __version__:
        issues.append("Producer module_version does not match this Atlas")
    if producer.get("implementation_fingerprint") != implementation_fingerprint():
        issues.append("Producer implementation fingerprint does not match this Atlas runtime")
    if producer.get("shared_contract_version") != CONTRACT_VERSION:
        issues.append("Receipt shared-contract version is incompatible")
    if producer.get("capability_record_export_format_version") != EXPORT_FORMAT_VERSION:
        issues.append("Receipt Capability Record export format is incompatible")
    if receipt.get("receipt_version") != PRODUCER_RECEIPT_VERSION:
        issues.append("Producer receipt version is incompatible")
    if receipt.get("producer_execution_state") != "RUN":
        issues.append("Receipt producer_execution_state is not RUN")
    if receipt.get("complete") is not True:
        issues.append("Receipt is not marked complete")

    run = _dict(receipt.get("run"))
    try:
        uuid.UUID(str(run.get("run_id", "")))
    except Exception:
        issues.append("run.run_id is not a valid UUID")
    _validate_timestamp(run.get("completed_at"), "run.completed_at", issues)

    source = _dict(receipt.get("source"))
    for field in (
        "source_hash", "normalized_source_sha256",
        "normalized_source_canonical_sha256", "normalized_source_semantic_sha256",
    ):
        if not HEX64.fullmatch(str(source.get(field, ""))):
            issues.append(f"source.{field} must be a lowercase SHA-256 hex digest")
    if source.get("normalized_source_canonical_sha256") != source.get("normalized_source_semantic_sha256"):
        issues.append("Normalized source canonical/semantic hash aliases disagree")

    output = _dict(receipt.get("output"))
    if output.get("capability_card_file") != "capability_card.json":
        issues.append("output.capability_card_file must be capability_card.json")
    if output.get("canonicalization_profile") != PROFILE_ID:
        issues.append("Receipt canonicalization profile is incompatible")
    if output.get("canonicalization_profile_version") != PROFILE_VERSION:
        issues.append("Receipt canonicalization profile version is incompatible")

    artifact_result = _validate_artifact_set(root, receipt, card, issues)

    expected_hash = str(output.get("capability_card_canonical_sha256", ""))
    actual_hash = canonical_sha256(card)
    if expected_hash != actual_hash:
        issues.append("Capability Card canonical hash mismatch")

    current_validation = validate_stable_handoff_card(card)
    if not current_validation["valid"]:
        issues.append("Capability Card fails current stable-handoff conformance")
    if receipt.get("validation") != current_validation:
        issues.append("Receipt validation evidence does not match current card validation")

    return {
        "valid": not issues,
        "issues": issues,
        "receipt": receipt,
        "receipt_hash": declared_receipt_hash,
        "card_hash": actual_hash,
        **artifact_result,
    }


def receipt_matches_source(
    output_dir: str | Path,
    normalized_source: dict[str, Any],
) -> dict[str, Any]:
    verified = verify_producer_receipt(output_dir)
    if not verified["valid"]:
        return verified
    receipt = verified["receipt"]
    source = _dict(receipt.get("source"))
    expected_ref = _dict(normalized_source.get("source_reference"))
    issues = list(verified["issues"])

    if source.get("capability_id") != normalized_source.get("capability_id"):
        issues.append("Capability ID changed")
    if source.get("capability_revision") != str(
        normalized_source.get("revision") or "unknown"
    ):
        issues.append("Capability revision changed")
    if source.get("source_hash") != expected_ref.get("source_hash"):
        issues.append("Original source hash changed")
    if source.get("source_pointer", "") != expected_ref.get("source_pointer", ""):
        issues.append("Source pointer changed")
    expected_normalized_hash = _portable_normalized_source_hash(normalized_source)
    if source.get("normalized_source_semantic_sha256") != expected_normalized_hash:
        issues.append("Normalized source semantic content changed")

    return {
        **verified,
        "valid": not issues,
        "issues": issues,
    }
