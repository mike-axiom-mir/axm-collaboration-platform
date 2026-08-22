from __future__ import annotations

from datetime import datetime, timezone
from copy import deepcopy
from pathlib import Path
from typing import Any
import hashlib
import math
import re

from . import (
    __version__, CONTRACT_VERSION, MODULE_ID, EXPORT_FORMAT_VERSION,
    BATCH_PLAN_VERSION, BATCH_RECEIPT_VERSION, PRODUCTION_MANIFEST_VERSION,
    INGEST_IN_PROGRESS_MARKER, PUBLIC_INTAKE_IN_PROGRESS_MARKER,
    PRODUCTION_FINALIZE_IN_PROGRESS_SUFFIX,
)
from .canonical_json import canonical_sha256
from .conformance import receipt_matches_source, verify_producer_receipt
from .identity import load_normalized_records
from .io import load_json, save_json, remove_file_durable
from .implementation_identity import implementation_fingerprint
from .normalized_inventory import verify_normalized_inventory
from .public_preflight import PREFLIGHT_FILENAME, verify_public_intake_preflight
from .validators import (
    validate_batch_plan, validate_batch_receipt, validate_production_run_manifest,
)
from .pipeline import build_from_file


def _dict(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return list(value) if isinstance(value, list) else []


BATCH_IN_PROGRESS_MARKER = ".batch_in_progress.json"


def _timestamp_is_aware(value: Any) -> bool:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.tzinfo is not None
    except Exception:
        return False


def _safe_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "-", str(value).strip()).strip("-").lower()
    return cleaned or "unnamed-capability"


def portable_record_key(record: dict[str, Any]) -> str:
    """Record identity that remains stable when the registry folder moves.

    Absolute source_location is deliberately excluded. Raw source hash + pointer
    preserve the source identity across a relocated read-only copy.
    """
    ref = _dict(record.get("source_reference"))
    payload = {
        "capability_id": str(record.get("capability_id", "")),
        "revision": str(record.get("revision") or "unknown"),
        "source_hash": str(ref.get("source_hash", "")),
        "source_pointer": str(ref.get("source_pointer", "")),
        "source_line": str(ref.get("source_line", "")),
    }
    return canonical_sha256(payload)[:20]


def portable_normalized_payload(record: dict[str, Any]) -> dict[str, Any]:
    """Remove only relocation/verification-time fields from normalized semantics."""
    payload = deepcopy(record)
    ref = payload.get("source_reference")
    if isinstance(ref, dict):
        ref.pop("source_location", None)
        ref.pop("last_verified_at", None)
    return payload


def portable_normalized_sha256(record: dict[str, Any]) -> str:
    return canonical_sha256(portable_normalized_payload(record))


def normalized_record_index(source: str | Path) -> dict[str, dict[str, Any]]:
    root = Path(source)
    records = load_normalized_records(root)
    scan_root = root / "normalized_sources" if (root / "normalized_sources").is_dir() else root

    if scan_root.is_dir():
        all_files = sorted(scan_root.glob("*.json"))
        accepted_report = root / "reports" / "accepted_records.json"
        if accepted_report.is_file():
            accepted = load_json(accepted_report)
            if not isinstance(accepted, list):
                raise ValueError("reports/accepted_records.json must be a JSON array")
            expected_names = []
            for entry in accepted:
                if not isinstance(entry, dict) or not entry.get("normalized_path"):
                    raise ValueError("accepted_records.json contains an invalid normalized_path entry")
                name = Path(str(entry["normalized_path"])).name
                if name in expected_names:
                    raise ValueError(f"accepted_records.json repeats normalized file: {name}")
                expected_names.append(name)

            actual_names = {path.name for path in all_files}
            expected_set = set(expected_names)
            missing = sorted(expected_set - actual_names)
            extra = sorted(actual_names - expected_set)
            if missing:
                raise ValueError(
                    f"Current accepted normalized inventory is incomplete; missing {len(missing)} file(s): {missing[:5]}"
                )
            if extra:
                raise ValueError(
                    f"Stale or untracked normalized files remain in the intake output; "
                    f"{len(extra)} extra file(s): {extra[:5]}. Use a fresh staging directory or resolve them before batching."
                )
            files = [scan_root / name for name in expected_names]
        else:
            files = all_files

        by_payload = {}
        for path in files:
            record = load_json(path)
            if not isinstance(record, dict) or not record.get("capability_id"):
                raise ValueError(f"Normalized source file is not a capability record: {path}")
            key = portable_record_key(record)
            if key in by_payload:
                raise ValueError(f"Portable record key collision: {key}")
            by_payload[key] = {
                "record": record,
                "normalized_path": str(path.resolve()),
            }
        if by_payload:
            return by_payload
        raise ValueError(f"No normalized capability records found at {root}")

    # File input fallback.
    if root.is_file() and len(records) == 1:
        record = records[0]
        return {
            portable_record_key(record): {
                "record": record,
                "normalized_path": str(root.resolve()),
            }
        }
    raise ValueError(f"No normalized capability records found at {root}")


def _record_descriptor(key: str, record: dict[str, Any], normalized_path: str) -> dict[str, Any]:
    ref = _dict(record.get("source_reference"))
    return {
        "record_key": key,
        "capability_id": str(record.get("capability_id", "")),
        "capability_revision": str(record.get("revision") or "unknown"),
        "source_hash": str(ref.get("source_hash", "")),
        "source_pointer": str(ref.get("source_pointer", "")),
        "source_line": str(ref.get("source_line", "")),
        "normalized_source_semantic_sha256": portable_normalized_sha256(record),
        "normalized_filename": Path(normalized_path).name,
    }


def _upstream_ingestion_anchor(
    source: str | Path, *, ignore_in_progress: bool = False
) -> dict[str, Any]:
    root = Path(source)
    report_path = root / "ingestion_report.json" if root.is_dir() else None
    ingest_in_progress = bool(root.is_dir() and (root / INGEST_IN_PROGRESS_MARKER).exists())
    public_intake_in_progress = bool(
        root.is_dir() and (root / PUBLIC_INTAKE_IN_PROGRESS_MARKER).exists()
    )
    effective_in_progress = (ingest_in_progress or public_intake_in_progress) and not ignore_in_progress
    if report_path is None or not report_path.is_file():
        return {
            "ingestion_report_present": False,
            "ingestion_report_sha256": "",
            "preflight_status": "TEST_HOLD_REVIEW" if effective_in_progress else "UNVERIFIED_SCOPE",
            "ingest_in_progress": ingest_in_progress and not ignore_in_progress,
            "public_intake_in_progress": public_intake_in_progress and not ignore_in_progress,
            "source_seal_hash": "",
            "normalized_inventory_present": False,
            "normalized_inventory_hash": "",
            "normalized_inventory_semantic_hash": "",
            "normalized_inventory_valid": None,
            "summary": {},
            "public_intake_preflight": {
                "present": False,
                "status": "NOT_APPLICABLE",
                "preflight_hash": "",
                "preflight_semantic_hash": "",
                "file_sha256": "",
                "verification_valid": None,
                "repository_snapshot_hash": "",
                "discovery_bundle_hash": "",
            },
        }

    report = load_json(report_path)
    summary = _dict(report.get("summary"))
    seal = _dict(report.get("source_seal_verification"))
    blockers = (
        int(summary.get("files_failed", 0) or 0)
        + int(summary.get("files_unrecognized", 0) or 0)
        + int(summary.get("records_rejected", 0) or 0)
        + int(summary.get("source_seal_failures", 0) or 0)
        + int(summary.get("stale_normalized_file_count", 0) or 0)
        + int(summary.get("enrichment_setup_failure_count", 0) or 0)
        + int(summary.get("enrichment_source_failures", 0) or 0)
        + int(summary.get("enrichment_conflicted_count", 0) or 0)
    )
    if int(summary.get("records_accepted", 0) or 0) < 1:
        blockers += 1
    if effective_in_progress:
        blockers += 1
    seal_hash = str(seal.get("seal_hash", ""))
    enrichment = _dict(report.get("enrichment"))
    enrichment_catalog_hash = str(enrichment.get("catalog_hash", ""))
    enrichment_source_seal_hash = str(enrichment.get("source_seal_hash", ""))

    inventory_path = root / "normalized_inventory.json"
    inventory_present = inventory_path.is_file()
    inventory_hash = ""
    inventory_semantic_hash = ""
    inventory_valid: bool | None = None
    if inventory_present:
        inventory = load_json(inventory_path)
        inventory_hash = str(inventory.get("inventory_hash", ""))
        inventory_semantic_hash = str(inventory.get("inventory_semantic_hash", ""))
        inventory_result = verify_normalized_inventory(root, inventory)
        inventory_valid = bool(inventory_result.get("valid"))
        expected_inventory = _dict(report.get("normalized_inventory"))
        expected_inventory_hash = str(expected_inventory.get("inventory_hash", ""))
        expected_inventory_semantic_hash = str(
            expected_inventory.get("inventory_semantic_hash", "")
        )
        if (
            not inventory_valid
            or (expected_inventory_hash and expected_inventory_hash != inventory_hash)
            or (
                expected_inventory_semantic_hash
                and expected_inventory_semantic_hash != inventory_semantic_hash
            )
        ):
            blockers += 1
    else:
        inventory_valid = False
        blockers += 1

    preflight_path = root / PREFLIGHT_FILENAME
    public_preflight = {
        "present": False,
        "status": "NOT_APPLICABLE",
        "preflight_hash": "",
        "preflight_semantic_hash": "",
        "file_sha256": "",
        "verification_valid": None,
        "repository_snapshot_hash": "",
        "discovery_bundle_hash": "",
    }
    if preflight_path.is_file():
        preflight = load_json(preflight_path)
        verification = verify_public_intake_preflight(
            root, preflight, ignore_in_progress=ignore_in_progress
        )
        repository_snapshot = _dict(preflight.get("repository_snapshot"))
        public_preflight = {
            "present": True,
            "status": str(preflight.get("status", "")),
            "preflight_hash": str(preflight.get("preflight_hash", "")),
            "preflight_semantic_hash": str(preflight.get("preflight_semantic_hash", "")),
            "file_sha256": hashlib.sha256(preflight_path.read_bytes()).hexdigest(),
            "verification_valid": bool(verification.get("valid")),
            "repository_snapshot_hash": str(repository_snapshot.get("snapshot_hash", "")),
            "discovery_bundle_hash": str(preflight.get("discovery_bundle_hash", "")),
        }
        if not verification.get("valid") or preflight.get("status") != "READY":
            blockers += 1

    preflight_status = (
        "TEST_HOLD_REVIEW"
        if blockers
        else ("READY" if seal_hash else "UNSEALED_SCOPE")
    )
    return {
        "ingestion_report_present": True,
        "ingestion_report_sha256": hashlib.sha256(report_path.read_bytes()).hexdigest(),
        "preflight_status": preflight_status,
        "ingest_in_progress": ingest_in_progress and not ignore_in_progress,
        "public_intake_in_progress": public_intake_in_progress and not ignore_in_progress,
        "source_seal_hash": seal_hash,
        "normalized_inventory_present": inventory_present,
        "normalized_inventory_hash": inventory_hash,
        "normalized_inventory_semantic_hash": inventory_semantic_hash,
        "normalized_inventory_valid": inventory_valid,
        "enrichment_catalog_hash": enrichment_catalog_hash,
        "enrichment_source_seal_hash": enrichment_source_seal_hash,
        "ingestion_module_version": str(report.get("module_version", "")),
        "public_intake_preflight": public_preflight,
        "summary": {
            "files_seen": int(summary.get("files_seen", 0) or 0),
            "files_unrecognized": int(summary.get("files_unrecognized", 0) or 0),
            "files_failed": int(summary.get("files_failed", 0) or 0),
            "records_found": int(summary.get("records_found", 0) or 0),
            "records_accepted": int(summary.get("records_accepted", 0) or 0),
            "records_rejected": int(summary.get("records_rejected", 0) or 0),
            "source_seal_failures": int(summary.get("source_seal_failures", 0) or 0),
            "enrichment_setup_failure_count": int(summary.get("enrichment_setup_failure_count", 0) or 0),
            "enrichment_source_failures": int(summary.get("enrichment_source_failures", 0) or 0),
            "enrichment_conflicted_count": int(summary.get("enrichment_conflicted_count", 0) or 0),
            "enrichment_partial_count": int(summary.get("enrichment_partial_count", 0) or 0),
        },
    }


def _semantic_upstream_anchor(upstream: dict[str, Any]) -> dict[str, Any]:
    public = _dict(upstream.get("public_intake_preflight"))
    return {
        "preflight_status": upstream.get("preflight_status"),
        "ingest_in_progress": upstream.get("ingest_in_progress", False),
        "public_intake_in_progress": upstream.get("public_intake_in_progress", False),
        "source_seal_hash": upstream.get("source_seal_hash", ""),
        "normalized_inventory_semantic_hash": upstream.get(
            "normalized_inventory_semantic_hash", ""
        ),
        "normalized_inventory_valid": upstream.get("normalized_inventory_valid"),
        "enrichment_catalog_hash": upstream.get("enrichment_catalog_hash", ""),
        "enrichment_source_seal_hash": upstream.get("enrichment_source_seal_hash", ""),
        "public_intake": {
            "present": public.get("present", False),
            "preflight_semantic_hash": public.get("preflight_semantic_hash", ""),
            "repository_snapshot_hash": public.get("repository_snapshot_hash", ""),
            "discovery_bundle_hash": public.get("discovery_bundle_hash", ""),
        },
        "summary": upstream.get("summary", {}),
    }


def _semantic_plan_payload(plan: dict[str, Any]) -> dict[str, Any]:
    return {
        "plan_version": plan.get("plan_version"),
        "module_id": plan.get("module_id"),
        "module_version": plan.get("module_version"),
        "implementation_fingerprint": plan.get("implementation_fingerprint"),
        "shared_contract_version": plan.get("shared_contract_version"),
        "capability_record_export_format_version": plan.get(
            "capability_record_export_format_version"
        ),
        "batch_size": plan.get("batch_size"),
        "record_count": plan.get("record_count"),
        "upstream_semantic": _semantic_upstream_anchor(_dict(plan.get("upstream_ingestion"))),
        "batches": plan.get("batches", []),
    }


def build_batch_plan(
    source: str | Path, *, batch_size: int = 100, ignore_in_progress: bool = False
) -> dict[str, Any]:
    if batch_size < 1:
        raise ValueError("batch_size must be at least 1")
    index = normalized_record_index(source)
    if not index:
        raise ValueError("Cannot create a production batch plan for an empty normalized registry")
    upstream = _upstream_ingestion_anchor(
        source, ignore_in_progress=ignore_in_progress
    )
    descriptors = [
        _record_descriptor(key, entry["record"], entry["normalized_path"])
        for key, entry in index.items()
    ]
    descriptors.sort(key=lambda item: (
        item["capability_id"], item["capability_revision"], item["source_hash"],
        item["source_pointer"], item["source_line"], item["record_key"]
    ))

    batches = []
    for offset in range(0, len(descriptors), batch_size):
        number = len(batches) + 1
        records = descriptors[offset: offset + batch_size]
        batch_id = f"batch_{number:04d}"
        stable_batch = {"batch_id": batch_id, "records": records}
        batches.append({
            **stable_batch,
            "record_count": len(records),
            "batch_hash": canonical_sha256(stable_batch),
        })

    stable_plan = {
        "plan_version": BATCH_PLAN_VERSION,
        "module_id": MODULE_ID,
        "module_version": __version__,
        "implementation_fingerprint": implementation_fingerprint(),
        "shared_contract_version": CONTRACT_VERSION,
        "capability_record_export_format_version": EXPORT_FORMAT_VERSION,
        "batch_size": batch_size,
        "record_count": len(descriptors),
        "upstream_ingestion": upstream,
        "batches": batches,
    }
    return {
        **stable_plan,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_at_generation": str(Path(source).resolve()),
        "summary": {
            "record_count": len(descriptors),
            "batch_count": len(batches),
            "batch_size": batch_size,
            "last_batch_size": len(batches[-1]["records"]) if batches else 0,
        },
        "plan_hash": canonical_sha256(stable_plan),
        "plan_semantic_hash": canonical_sha256(_semantic_plan_payload(stable_plan)),
    }


def verify_batch_plan(plan: dict[str, Any]) -> dict[str, Any]:
    issues = [f"schema: {item}" for item in validate_batch_plan(plan)]
    if plan.get("plan_version") != BATCH_PLAN_VERSION:
        issues.append("Batch plan version is incompatible")
    if plan.get("module_id") != MODULE_ID or plan.get("module_version") != __version__:
        issues.append("Batch plan module identity/version mismatch")
    if plan.get("implementation_fingerprint") != implementation_fingerprint():
        issues.append("Batch plan implementation fingerprint mismatch")
    if plan.get("shared_contract_version") != CONTRACT_VERSION:
        issues.append("Batch plan shared-contract version mismatch")
    if plan.get("capability_record_export_format_version") != EXPORT_FORMAT_VERSION:
        issues.append("Batch plan Capability Record export format mismatch")
    if not _timestamp_is_aware(plan.get("generated_at")):
        issues.append("Batch plan generated_at must be a timezone-aware ISO-8601 timestamp")
    batches = plan.get("batches", []) if isinstance(plan.get("batches"), list) else []
    seen = set()
    count = 0
    for batch in batches:
        stable_batch = {"batch_id": batch.get("batch_id"), "records": batch.get("records", [])}
        if batch.get("batch_hash") != canonical_sha256(stable_batch):
            issues.append(f"{batch.get('batch_id')}: batch_hash mismatch")
        if batch.get("record_count") != len(batch.get("records", [])):
            issues.append(f"{batch.get('batch_id')}: record_count mismatch")
        for record in batch.get("records", []):
            key = record.get("record_key")
            if key in seen:
                issues.append(f"Duplicate planned record_key: {key}")
            seen.add(key)
            count += 1
    stable_plan = {
        "plan_version": plan.get("plan_version"),
        "module_id": plan.get("module_id"),
        "module_version": plan.get("module_version"),
        "implementation_fingerprint": plan.get("implementation_fingerprint"),
        "shared_contract_version": plan.get("shared_contract_version"),
        "capability_record_export_format_version": plan.get("capability_record_export_format_version"),
        "batch_size": plan.get("batch_size"),
        "record_count": plan.get("record_count"),
        "upstream_ingestion": plan.get("upstream_ingestion", {}),
        "batches": batches,
    }
    if plan.get("plan_hash") != canonical_sha256(stable_plan):
        issues.append("plan_hash mismatch")
    if plan.get("plan_semantic_hash") != canonical_sha256(_semantic_plan_payload(plan)):
        issues.append("plan_semantic_hash mismatch")
    if count != plan.get("record_count"):
        issues.append(f"record_count mismatch: declared {plan.get('record_count')} observed {count}")
    if count < 1:
        issues.append("Production batch plan must contain at least one record")
    summary = _dict(plan.get("summary"))
    expected_summary = {
        "record_count": count,
        "batch_count": len(batches),
        "batch_size": plan.get("batch_size"),
        "last_batch_size": len(batches[-1].get("records", [])) if batches else 0,
    }
    if summary != expected_summary:
        issues.append("Batch plan summary is inconsistent with batch contents")
    expected_ids = [f"batch_{i:04d}" for i in range(1, len(batches) + 1)]
    actual_ids = [batch.get("batch_id") for batch in batches]
    if actual_ids != expected_ids:
        issues.append("Batch IDs are not a contiguous deterministic sequence")
    return {"valid": not issues, "issues": issues, "observed_record_count": count, "observed_batch_count": len(batches)}


def verify_plan_source_alignment(plan: dict[str, Any], normalized_source: str | Path) -> dict[str, Any]:
    """Prove the batch plan still covers exactly the normalized source/evidence set."""
    plan_check = verify_batch_plan(plan)
    if not plan_check["valid"]:
        return {
            "valid": False,
            "issues": ["Batch plan is invalid"] + plan_check["issues"],
            "missing_record_keys": [],
            "added_record_keys": [],
            "changed_record_keys": [],
        }

    current_upstream = _upstream_ingestion_anchor(normalized_source)
    planned_upstream = _dict(plan.get("upstream_ingestion"))
    upstream_changed = current_upstream != planned_upstream
    planned_records = {
        item["record_key"]: item
        for batch in plan.get("batches", [])
        for item in batch.get("records", [])
    }
    planned_keys = set(planned_records)

    # Detect stale/untracked files before the stricter normalized index loader
    # rejects them, so diagnostics retain exact added/missing record identities.
    source_root = Path(normalized_source)
    scan_root = (
        source_root / "normalized_sources"
        if (source_root / "normalized_sources").is_dir()
        else source_root
    )
    accepted_report = source_root / "reports" / "accepted_records.json"
    if scan_root.is_dir() and accepted_report.is_file():
        accepted = load_json(accepted_report)
        expected_names = {
            Path(str(item.get("normalized_path", ""))).name
            for item in accepted
            if isinstance(item, dict) and item.get("normalized_path")
        }
        actual_paths = {
            path.name: path
            for path in scan_root.glob("*.json")
            if path.is_file()
        }
        extra_names = sorted(set(actual_paths) - expected_names)
        missing_names = sorted(expected_names - set(actual_paths))
        if extra_names or missing_names:
            added_keys = []
            for name in extra_names:
                try:
                    value = load_json(actual_paths[name])
                    if isinstance(value, dict) and value.get("capability_id"):
                        added_keys.append(portable_record_key(value))
                    else:
                        added_keys.append(f"untracked:{name}")
                except Exception:
                    added_keys.append(f"unreadable:{name}")
            missing_keys = sorted(
                key
                for key, descriptor in planned_records.items()
                if descriptor.get("normalized_filename") in missing_names
            )
            issues = []
            if missing_names:
                issues.append(
                    f"Current accepted normalized inventory is incomplete; "
                    f"missing {len(missing_names)} file(s): {missing_names[:5]}"
                )
            if extra_names:
                issues.append(
                    f"Stale or untracked normalized files remain in the intake output; "
                    f"{len(extra_names)} extra file(s): {extra_names[:5]}"
                )
            if upstream_changed:
                issues.append("Upstream ingestion/preflight evidence changed after batch planning")
            return {
                "valid": False,
                "issues": issues,
                "missing_record_keys": missing_keys,
                "added_record_keys": sorted(added_keys),
                "changed_record_keys": [],
                "planned_record_count": int(plan.get("record_count", 0) or 0),
                "observed_record_count": len(actual_paths),
                "planned_upstream": planned_upstream,
                "observed_upstream": current_upstream,
            }

    try:
        index = normalized_record_index(normalized_source)
    except ValueError as exc:
        issues = [str(exc)]
        if upstream_changed:
            issues.append("Upstream ingestion/preflight evidence changed after batch planning")
        return {
            "valid": False,
            "issues": issues,
            "missing_record_keys": [],
            "added_record_keys": [],
            "changed_record_keys": [],
            "planned_record_count": int(plan.get("record_count", 0) or 0),
            "observed_record_count": 0,
            "planned_upstream": planned_upstream,
            "observed_upstream": current_upstream,
        }

    current_keys = set(index)
    missing = sorted(planned_keys - current_keys)
    added = sorted(current_keys - planned_keys)
    changed = []
    for key in sorted(planned_keys & current_keys):
        current_hash = portable_normalized_sha256(index[key]["record"])
        expected_hash = planned_records[key].get("normalized_source_semantic_sha256")
        if current_hash != expected_hash:
            changed.append(key)

    issues = []
    if missing:
        issues.append(f"{len(missing)} planned normalized record(s) are missing")
    if added:
        issues.append(f"{len(added)} normalized record(s) were added after the plan")
    if changed:
        issues.append(f"{len(changed)} normalized record(s) changed after the plan")
    if upstream_changed:
        issues.append("Upstream ingestion/preflight evidence changed after batch planning")
    return {
        "valid": not issues,
        "issues": issues,
        "missing_record_keys": missing,
        "added_record_keys": added,
        "changed_record_keys": changed,
        "planned_record_count": len(planned_keys),
        "observed_record_count": len(current_keys),
        "planned_upstream": planned_upstream,
        "observed_upstream": current_upstream,
    }


def _planned_batch(plan: dict[str, Any], batch_id: str) -> dict[str, Any]:
    for batch in plan.get("batches", []):
        if batch.get("batch_id") == batch_id:
            return batch
    raise KeyError(f"Unknown batch_id: {batch_id}")


def build_batch(
    plan: dict[str, Any],
    normalized_source: str | Path,
    batch_id: str,
    output_root: str | Path,
    *,
    resume: bool = True,
) -> dict[str, Any]:
    verified_plan = verify_batch_plan(plan)
    if not verified_plan["valid"]:
        raise ValueError("Invalid batch plan: " + "; ".join(verified_plan["issues"]))
    if plan.get("module_version") != __version__:
        raise ValueError(f"Batch plan producer version {plan.get('module_version')} does not match Atlas {__version__}")
    if plan.get("shared_contract_version") != CONTRACT_VERSION:
        raise ValueError("Batch plan shared-contract version is incompatible")
    upstream_status = _dict(plan.get("upstream_ingestion")).get("preflight_status")
    if upstream_status == "TEST_HOLD_REVIEW":
        raise ValueError("Batch plan upstream evidence is TEST_HOLD_REVIEW; resolve integrity blockers before production")
    alignment = verify_plan_source_alignment(plan, normalized_source)
    if not alignment["valid"]:
        raise ValueError("Batch plan no longer matches normalized source set: " + "; ".join(alignment["issues"]))

    batch = _planned_batch(plan, batch_id)
    index = normalized_record_index(normalized_source)
    batch_root = Path(output_root) / batch_id
    records_root = batch_root / "records"
    records_root.mkdir(parents=True, exist_ok=True)

    expected_output_names = {
        f"{_safe_name(item.get('capability_id',''))}__{item.get('record_key','')}"
        for item in batch.get("records", [])
    }
    existing_output_names = {item.name for item in records_root.iterdir()}
    stale_outputs = sorted(existing_output_names - expected_output_names)
    if stale_outputs:
        raise ValueError(
            f"Batch output contains stale/unplanned record directorie(s): {stale_outputs[:10]}"
        )

    # Invalidate prior batch completion before modifying any record output.
    remove_file_durable(batch_root / "batch_receipt.json")
    batch_marker = batch_root / BATCH_IN_PROGRESS_MARKER
    save_json(batch_marker, {
        "batch_state_version": "0.1.0",
        "state": "IN_PROGRESS",
        "batch_id": batch_id,
        "plan_hash": plan.get("plan_hash", ""),
        "implementation_fingerprint": implementation_fingerprint(),
    })

    results = []
    built = reused = failed = 0

    for planned in batch.get("records", []):
        key = planned["record_key"]
        entry = index.get(key)
        if entry is None:
            failed += 1
            results.append({"record_key": key, "capability_id": planned.get("capability_id"), "status": "FAILED", "issues": ["Planned normalized source record is missing or changed"]})
            continue
        record = entry["record"]
        if portable_normalized_sha256(record) != planned.get("normalized_source_semantic_sha256"):
            failed += 1
            results.append({"record_key": key, "capability_id": planned.get("capability_id"), "status": "FAILED", "issues": ["Normalized source canonical hash changed after batch plan"]})
            continue

        out_dir = records_root / f"{_safe_name(planned.get('capability_id',''))}__{key}"
        status = "BUILT"
        issues = []
        try:
            if resume and out_dir.exists():
                match = receipt_matches_source(out_dir, record)
                if match["valid"]:
                    status = "REUSED"
                    reused += 1
                else:
                    build_from_file(entry["normalized_path"], out_dir)
                    built += 1
                    issues = ["Previous output was not reusable: " + "; ".join(match.get("issues", []))]
            else:
                build_from_file(entry["normalized_path"], out_dir)
                built += 1
            verification = verify_producer_receipt(out_dir)
            if not verification["valid"]:
                raise ValueError("Producer receipt verification failed: " + "; ".join(verification.get("issues", [])))
            receipt = verification["receipt"]
            results.append({
                "record_key": key,
                "capability_id": planned.get("capability_id"),
                "capability_revision": planned.get("capability_revision"),
                "status": status,
                "output_directory": out_dir.relative_to(batch_root).as_posix(),
                "producer_run_id": _dict(receipt.get("run")).get("run_id", ""),
                "producer_receipt_hash": verification.get("receipt_hash", ""),
                "artifact_set_hash": _dict(receipt.get("output")).get("artifact_set_hash", ""),
                "capability_card_canonical_sha256": _dict(receipt.get("output")).get("capability_card_canonical_sha256", ""),
                "issues": issues,
            })
        except Exception as exc:
            failed += 1
            results.append({"record_key": key, "capability_id": planned.get("capability_id"), "status": "FAILED", "issues": [str(exc)]})

    receipt = {
        "batch_receipt_version": BATCH_RECEIPT_VERSION,
        "plan_hash": plan.get("plan_hash"),
        "plan_semantic_hash": plan.get("plan_semantic_hash"),
        "batch_id": batch_id,
        "batch_hash": batch.get("batch_hash"),
        "expected_record_count": batch.get("record_count"),
        "results": results,
        "producer": {
            "module_id": MODULE_ID,
            "module_version": __version__,
            "implementation_fingerprint": implementation_fingerprint(),
            "shared_contract_version": CONTRACT_VERSION,
        },
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "summary": {"expected": batch.get("record_count"), "built": built, "reused": reused, "failed": failed, "completed": built + reused},
        "status": "PASS" if failed == 0 and built + reused == batch.get("record_count") else "TEST_HOLD_REVIEW",
    }
    receipt["batch_receipt_hash"] = canonical_sha256(receipt)
    receipt_schema_errors = validate_batch_receipt(receipt)
    if receipt_schema_errors:
        raise ValueError(
            "Generated batch receipt failed schema validation: "
            + "; ".join(receipt_schema_errors)
        )
    remove_file_durable(batch_marker)
    save_json(batch_root / "batch_receipt.json", receipt)
    return receipt


def verify_batch_receipt(
    plan: dict[str, Any],
    normalized_source: str | Path,
    batch_id: str,
    output_root: str | Path,
) -> dict[str, Any]:
    issues = []
    plan_check = verify_batch_plan(plan)
    if not plan_check["valid"]:
        return {"valid": False, "issues": ["Batch plan is invalid"] + plan_check["issues"], "batch_id": batch_id}
    alignment = verify_plan_source_alignment(plan, normalized_source)
    if not alignment["valid"]:
        return {"valid": False, "issues": ["Batch plan no longer matches normalized source set"] + alignment["issues"], "batch_id": batch_id}
    batch = _planned_batch(plan, batch_id)
    batch_root = Path(output_root) / batch_id
    marker_path = batch_root / BATCH_IN_PROGRESS_MARKER
    if marker_path.exists():
        issues.append(f"{BATCH_IN_PROGRESS_MARKER} is present; batch build is incomplete")
    receipt_path = batch_root / "batch_receipt.json"
    if not receipt_path.is_file():
        return {"valid": False, "issues": issues + ["batch_receipt.json is missing"], "batch_id": batch_id}
    if receipt_path.is_symlink():
        return {"valid": False, "issues": issues + ["batch_receipt.json may not be a symbolic link"], "batch_id": batch_id}
    receipt = load_json(receipt_path)
    schema_issues = validate_batch_receipt(receipt)
    issues.extend(f"schema: {item}" for item in schema_issues)
    hashed_receipt = dict(receipt)
    declared_receipt_hash = hashed_receipt.pop("batch_receipt_hash", "")
    if declared_receipt_hash != canonical_sha256(hashed_receipt):
        issues.append("batch_receipt_hash mismatch")
    producer = _dict(receipt.get("producer"))
    if (
        producer.get("module_id") != MODULE_ID
        or producer.get("module_version") != __version__
        or producer.get("implementation_fingerprint") != implementation_fingerprint()
        or producer.get("shared_contract_version") != CONTRACT_VERSION
    ):
        issues.append("Batch receipt producer identity/version/implementation/contract mismatch")
    if receipt.get("batch_receipt_version") != BATCH_RECEIPT_VERSION:
        issues.append("Batch receipt version is incompatible")
    if not _timestamp_is_aware(receipt.get("completed_at")):
        issues.append("Batch receipt completed_at must be a timezone-aware ISO-8601 timestamp")
    if receipt.get("plan_hash") != plan.get("plan_hash"):
        issues.append("batch receipt plan_hash mismatch")
    if receipt.get("plan_semantic_hash") != plan.get("plan_semantic_hash"):
        issues.append("batch receipt plan_semantic_hash mismatch")
    if receipt.get("batch_hash") != batch.get("batch_hash"):
        issues.append("batch receipt batch_hash mismatch")

    planned_keys = [item["record_key"] for item in batch.get("records", [])]
    result_keys = [item.get("record_key") for item in receipt.get("results", [])]
    if result_keys != planned_keys:
        issues.append("Batch result membership/order does not exactly match the plan")
    summary = _dict(receipt.get("summary"))
    observed_built = sum(1 for item in receipt.get("results", []) if item.get("status") == "BUILT")
    observed_reused = sum(1 for item in receipt.get("results", []) if item.get("status") == "REUSED")
    observed_failed = sum(1 for item in receipt.get("results", []) if item.get("status") == "FAILED")
    if summary != {"expected": len(planned_keys), "built": observed_built, "reused": observed_reused, "failed": observed_failed, "completed": observed_built + observed_reused}:
        issues.append("Batch receipt summary does not match result statuses")
    expected_status = "PASS" if observed_failed == 0 and observed_built + observed_reused == len(planned_keys) else "TEST_HOLD_REVIEW"
    if receipt.get("status") != expected_status:
        issues.append("Batch receipt status does not match result statuses")

    index = normalized_record_index(normalized_source)
    expected_output_names = {
        f"{_safe_name(item.get('capability_id',''))}__{item.get('record_key','')}"
        for item in batch.get("records", [])
    }
    records_root = batch_root / "records"
    actual_output_names = (
        {item.name for item in records_root.iterdir()}
        if records_root.is_dir() else set()
    )
    stale_output_names = sorted(actual_output_names - expected_output_names)
    missing_output_names = sorted(expected_output_names - actual_output_names)
    if stale_output_names:
        issues.append(f"Batch contains stale/unplanned output directorie(s): {stale_output_names[:10]}")
    if missing_output_names:
        issues.append(f"Batch is missing planned output directorie(s): {missing_output_names[:10]}")

    seen_output_directories: set[str] = set()
    verified_record_keys: set[str] = set()
    for result in receipt.get("results", []):
        key = result.get("record_key")
        entry = index.get(key)
        if entry is None:
            issues.append(f"{key}: normalized source missing or changed")
            continue
        planned = next((item for item in batch.get("records", []) if item.get("record_key") == key), None)
        if planned and portable_normalized_sha256(entry["record"]) != planned.get("normalized_source_semantic_sha256"):
            issues.append(f"{key}: normalized source canonical hash no longer matches plan")
        declared_output_text = str(result.get("output_directory", ""))
        declared_output = Path(declared_output_text)
        if declared_output.is_absolute():
            issues.append(f"{key}: batch output_directory must be relative")
            continue
        if declared_output_text in seen_output_directories:
            issues.append(f"{key}: batch output_directory is duplicated")
            continue
        seen_output_directories.add(declared_output_text)
        out_dir = (batch_root / declared_output).resolve()
        batch_root_resolved = batch_root.resolve()
        if batch_root_resolved != out_dir and batch_root_resolved not in out_dir.parents:
            issues.append(f"{key}: batch output_directory escapes the batch root")
            continue
        expected_output = f"records/{_safe_name(planned.get('capability_id',''))}__{key}" if planned else ""
        if declared_output.as_posix() != expected_output:
            issues.append(f"{key}: batch output_directory does not match deterministic planned path")
            continue
        match = receipt_matches_source(out_dir, entry["record"])
        if not match["valid"]:
            issues.append(f"{key}: producer receipt invalid or source-mismatched: {'; '.join(match.get('issues', []))}")
        else:
            producer_receipt = match["receipt"]
            if match["card_hash"] != result.get("capability_card_canonical_sha256"):
                issues.append(f"{key}: batch result card hash does not match producer receipt")
            if match.get("receipt_hash") != result.get("producer_receipt_hash"):
                issues.append(f"{key}: batch result producer_receipt_hash mismatch")
            if _dict(producer_receipt.get("output")).get("artifact_set_hash") != result.get("artifact_set_hash"):
                issues.append(f"{key}: batch result artifact_set_hash mismatch")
            if _dict(producer_receipt.get("run")).get("run_id") != result.get("producer_run_id"):
                issues.append(f"{key}: batch result producer_run_id mismatch")
            if not any(item.startswith(f"{key}:") for item in issues):
                verified_record_keys.add(str(key))
        if result.get("status") not in {"BUILT", "REUSED"}:
            issues.append(f"{key}: result status is {result.get('status')}")

    return {
        "valid": not issues,
        "issues": issues,
        "batch_id": batch_id,
        "expected_record_count": len(planned_keys),
        "verified_record_count": len(verified_record_keys),
    }


def finalize_batch_run(
    plan: dict[str, Any],
    normalized_source: str | Path,
    output_root: str | Path,
) -> dict[str, Any]:
    plan_check = verify_batch_plan(plan)
    batch_reports = []
    covered = []
    issues = list(plan_check.get("issues", []))
    for batch in plan.get("batches", []):
        batch_id = batch["batch_id"]
        result = verify_batch_receipt(plan, normalized_source, batch_id, output_root)
        batch_reports.append(result)
        if result["valid"]:
            covered.extend(item["record_key"] for item in batch.get("records", []))
        else:
            issues.extend(f"{batch_id}: {item}" for item in result["issues"])

    upstream_status = _dict(plan.get("upstream_ingestion")).get("preflight_status", "UNVERIFIED_SCOPE")
    if upstream_status != "READY":
        issues.append(f"Upstream ingestion preflight is {upstream_status}, not READY")

    planned = [item["record_key"] for batch in plan.get("batches", []) for item in batch.get("records", [])]
    if len(covered) != len(set(covered)):
        issues.append("Verified batch coverage contains duplicate record keys")
    missing = sorted(set(planned) - set(covered))
    extra = sorted(set(covered) - set(planned))
    if missing:
        issues.append(f"Missing verified records: {len(missing)}")
    if extra:
        issues.append(f"Unexpected verified records: {len(extra)}")

    manifest = {
        "production_run_manifest_version": PRODUCTION_MANIFEST_VERSION,
        "plan_version": plan.get("plan_version"),
        "plan_hash": plan.get("plan_hash"),
        "plan_semantic_hash": plan.get("plan_semantic_hash"),
        "implementation_fingerprint": implementation_fingerprint(),
        "source_seal_hash": _dict(plan.get("upstream_ingestion")).get("source_seal_hash", ""),
        "upstream_ingestion": plan.get("upstream_ingestion", {}),
        "planned_record_count": len(planned),
        "verified_record_keys": sorted(covered),
        "missing_record_keys": missing,
        "extra_record_keys": extra,
        "batch_validation": [
            {
                "batch_id": item["batch_id"],
                "valid": item["valid"],
                "batch_receipt_hash": (
                    str(load_json(Path(output_root) / item["batch_id"] / "batch_receipt.json").get("batch_receipt_hash", ""))
                    if (Path(output_root) / item["batch_id"] / "batch_receipt.json").is_file()
                    else ""
                ),
                "batch_hash": _planned_batch(plan, item["batch_id"]).get("batch_hash", ""),
            }
            for item in batch_reports
        ],
        "module_id": MODULE_ID,
        "module_version": __version__,
        "shared_contract_version": CONTRACT_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": "COMPLETE_VERIFIED" if not issues and len(covered) == len(planned) else "TEST_HOLD_REVIEW",
        "merge_claim": False,
        "issues": issues,
        "summary": {
            "planned_records": len(planned),
            "verified_records": len(covered),
            "missing_records": len(missing),
            "extra_records": len(extra),
            "batch_count": len(plan.get("batches", [])),
            "verified_batch_count": sum(1 for item in batch_reports if item["valid"]),
        },
    }
    manifest["manifest_hash"] = canonical_sha256(manifest)
    return manifest



def production_finalize_marker_path(manifest_path: str | Path) -> Path:
    target = Path(manifest_path)
    return target.with_name(target.name + PRODUCTION_FINALIZE_IN_PROGRESS_SUFFIX)


def finalize_batch_run_to_file(
    plan: dict[str, Any],
    normalized_source: str | Path,
    output_root: str | Path,
    manifest_path: str | Path,
) -> dict[str, Any]:
    """Transactionally finalize and write a production manifest.

    Earlier completion evidence is invalidated before work begins. The in-progress
    marker remains on every failure path. The manifest is atomically written and
    re-read/verified before the marker is durably removed.
    """
    target = Path(manifest_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    marker = production_finalize_marker_path(target)
    remove_file_durable(target)
    save_json(marker, {
        "production_finalize_state_version": "0.1.0",
        "state": "IN_PROGRESS",
        "plan_hash": plan.get("plan_hash", ""),
        "plan_semantic_hash": plan.get("plan_semantic_hash", ""),
        "implementation_fingerprint": implementation_fingerprint(),
    })
    manifest = finalize_batch_run(plan, normalized_source, output_root)
    schema_errors = validate_production_run_manifest(manifest)
    if schema_errors:
        raise ValueError(
            "Production run manifest failed schema validation: "
            + "; ".join(schema_errors)
        )
    chain = verify_production_run_chain(
        manifest, plan, normalized_source, output_root
    )
    if not chain.get("valid"):
        raise ValueError(
            "Production run full-chain verification failed: "
            + "; ".join(chain.get("issues", []))
        )
    save_json(target, manifest)
    written = load_json(target)
    written_check = verify_production_run_manifest(written)
    if not written_check.get("valid"):
        raise ValueError(
            "Written production manifest failed verification: "
            + "; ".join(written_check.get("issues", []))
        )
    written_chain = verify_production_run_chain(
        written, plan, normalized_source, output_root
    )
    if not written_chain.get("valid"):
        raise ValueError(
            "Written production manifest failed full-chain verification: "
            + "; ".join(written_chain.get("issues", []))
        )
    remove_file_durable(marker)
    return written


def verify_production_run_file(manifest_path: str | Path) -> dict[str, Any]:
    target = Path(manifest_path)
    marker = production_finalize_marker_path(target)
    issues: list[str] = []
    if marker.exists():
        issues.append("production finalization is marked IN_PROGRESS")
    if not target.is_file():
        issues.append("production manifest is missing")
        return {"valid": False, "issues": issues, "manifest_path": str(target)}
    try:
        manifest = load_json(target)
    except Exception as exc:
        issues.append(str(exc))
        return {"valid": False, "issues": issues, "manifest_path": str(target)}
    result = verify_production_run_manifest(manifest)
    issues.extend(result.get("issues", []))
    return {
        **result,
        "valid": not issues,
        "issues": issues,
        "manifest_path": str(target),
        "finalize_marker_present": marker.exists(),
    }


def verify_production_run_chain_file(
    manifest_path: str | Path,
    plan: dict[str, Any],
    normalized_source: str | Path,
    output_root: str | Path,
) -> dict[str, Any]:
    file_result = verify_production_run_file(manifest_path)
    if not file_result.get("valid"):
        return file_result
    manifest = load_json(manifest_path)
    chain = verify_production_run_chain(
        manifest, plan, normalized_source, output_root
    )
    return {
        **chain,
        "manifest_path": str(Path(manifest_path)),
        "finalize_marker_present": False,
    }

def verify_production_run_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    issues = [f"schema: {item}" for item in validate_production_run_manifest(manifest)]
    if manifest.get("production_run_manifest_version") != PRODUCTION_MANIFEST_VERSION:
        issues.append("Production manifest version is incompatible")
    if manifest.get("plan_version") != BATCH_PLAN_VERSION:
        issues.append("Production manifest batch plan version is incompatible")
    if manifest.get("implementation_fingerprint") != implementation_fingerprint():
        issues.append("Production manifest implementation fingerprint mismatch")
    value = dict(manifest)
    declared = value.pop("manifest_hash", "")
    if declared != canonical_sha256(value):
        issues.append("manifest_hash mismatch")
    if (
        manifest.get("module_id") != MODULE_ID
        or manifest.get("module_version") != __version__
        or manifest.get("shared_contract_version") != CONTRACT_VERSION
    ):
        issues.append("Production manifest producer identity/version/contract mismatch")
    verified = manifest.get("verified_record_keys", []) if isinstance(manifest.get("verified_record_keys"), list) else []
    missing = manifest.get("missing_record_keys", []) if isinstance(manifest.get("missing_record_keys"), list) else []
    extra = manifest.get("extra_record_keys", []) if isinstance(manifest.get("extra_record_keys"), list) else []
    if len(verified) != len(set(verified)):
        issues.append("verified_record_keys contains duplicates")
    summary = _dict(manifest.get("summary"))
    if summary.get("verified_records") != len(verified):
        issues.append("summary.verified_records mismatch")
    if summary.get("missing_records") != len(missing):
        issues.append("summary.missing_records mismatch")
    if summary.get("extra_records") != len(extra):
        issues.append("summary.extra_records mismatch")
    if manifest.get("planned_record_count") != summary.get("planned_records"):
        issues.append("planned_record_count mismatch")
    if not _timestamp_is_aware(manifest.get("generated_at")):
        issues.append("Production manifest generated_at must be a timezone-aware ISO-8601 timestamp")
    if verified != sorted(verified) or missing != sorted(missing) or extra != sorted(extra):
        issues.append("Production manifest record-key lists must be deterministically sorted")
    if len(missing) != len(set(missing)) or len(extra) != len(set(extra)):
        issues.append("Production manifest missing/extra record-key lists contain duplicates")
    if set(verified) & set(missing) or set(verified) & set(extra) or set(missing) & set(extra):
        issues.append("Production manifest verified/missing/extra record-key sets overlap")
    if len(verified) + len(missing) != int(manifest.get("planned_record_count", 0) or 0):
        issues.append("Production manifest verified + missing coverage does not equal planned count")
    upstream = _dict(manifest.get("upstream_ingestion"))
    if manifest.get("source_seal_hash") != upstream.get("source_seal_hash"):
        issues.append("Production manifest source_seal_hash differs from upstream ingestion anchor")
    batch_validation = (
        manifest.get("batch_validation", [])
        if isinstance(manifest.get("batch_validation"), list)
        else []
    )
    batch_ids = [str(item.get("batch_id", "")) for item in batch_validation if isinstance(item, dict)]
    if len(batch_ids) != len(set(batch_ids)):
        issues.append("batch_validation contains duplicate batch IDs")
    expected_batch_count = int(summary.get("batch_count", 0) or 0)
    expected_batch_ids = [f"batch_{index:04d}" for index in range(1, expected_batch_count + 1)]
    if batch_ids != expected_batch_ids:
        issues.append("batch_validation IDs/order are not a deterministic contiguous sequence")
    if len(batch_validation) != expected_batch_count:
        issues.append("batch_validation count does not match summary.batch_count")
    observed_verified_batches = sum(
        isinstance(item, dict) and item.get("valid") is True for item in batch_validation
    )
    if summary.get("verified_batch_count") != observed_verified_batches:
        issues.append("summary.verified_batch_count mismatch")
    for item in batch_validation:
        if not isinstance(item, dict):
            issues.append("batch_validation contains a non-object entry")
            continue
        if item.get("valid") is not True:
            continue
        if not re.fullmatch(r"[0-9a-f]{64}", str(item.get("batch_receipt_hash", ""))):
            issues.append(f"{item.get('batch_id')}: missing/invalid batch_receipt_hash")
        if not re.fullmatch(r"[0-9a-f]{64}", str(item.get("batch_hash", ""))):
            issues.append(f"{item.get('batch_id')}: missing/invalid batch_hash")

    sealed_ready = (
        upstream.get("preflight_status") == "READY"
        and bool(re.fullmatch(r"[0-9a-f]{64}", str(manifest.get("source_seal_hash", ""))))
    )
    if manifest.get("planned_record_count", 0) < 1:
        issues.append("Production manifest must cover at least one record")

    expected_status = (
        "COMPLETE_VERIFIED"
        if sealed_ready
        and not missing
        and not extra
        and len(verified) == manifest.get("planned_record_count")
        and all(isinstance(item, dict) and item.get("valid") is True for item in batch_validation)
        and len(batch_validation) == expected_batch_count
        and not manifest.get("issues")
        else "TEST_HOLD_REVIEW"
    )
    if manifest.get("status") != expected_status:
        issues.append("Production manifest status is inconsistent with its contents")
    if manifest.get("merge_claim") is not False:
        issues.append("Production manifest must never claim merge acceptance")
    return {
        "valid": not issues,
        "issues": issues,
        "status": manifest.get("status"),
        "manifest_hash": declared,
    }



def verify_production_run_chain(
    manifest: dict[str, Any],
    plan: dict[str, Any],
    normalized_source: str | Path,
    output_root: str | Path,
) -> dict[str, Any]:
    """Re-verify the complete source -> plan -> batch -> receipt -> manifest chain."""
    base = verify_production_run_manifest(manifest)
    issues = list(base.get("issues", []))

    plan_result = verify_batch_plan(plan)
    if not plan_result.get("valid"):
        issues.extend(f"plan: {item}" for item in plan_result.get("issues", []))
    if manifest.get("plan_hash") != plan.get("plan_hash"):
        issues.append("Production manifest plan_hash does not match supplied batch plan")
    if manifest.get("plan_semantic_hash") != plan.get("plan_semantic_hash"):
        issues.append("Production manifest plan_semantic_hash does not match supplied batch plan")
    if manifest.get("implementation_fingerprint") != plan.get("implementation_fingerprint"):
        issues.append("Production manifest and plan implementation fingerprints differ")
    if manifest.get("upstream_ingestion") != plan.get("upstream_ingestion"):
        issues.append("Production manifest upstream ingestion anchor differs from supplied plan")

    alignment = verify_plan_source_alignment(plan, normalized_source)
    if not alignment.get("valid"):
        issues.extend(f"alignment: {item}" for item in alignment.get("issues", []))

    manifest_batches = {
        str(item.get("batch_id")): item
        for item in _list(manifest.get("batch_validation"))
        if isinstance(item, dict)
    }
    verified_keys: list[str] = []
    batch_results = []
    for batch in _list(plan.get("batches")):
        if not isinstance(batch, dict):
            continue
        batch_id = str(batch.get("batch_id", ""))
        result = verify_batch_receipt(plan, normalized_source, batch_id, output_root)
        batch_results.append(result)
        if not result.get("valid"):
            issues.extend(f"{batch_id}: {item}" for item in result.get("issues", []))
            continue
        verified_keys.extend(
            str(item.get("record_key")) for item in _list(batch.get("records"))
            if isinstance(item, dict)
        )
        declared = _dict(manifest_batches.get(batch_id))
        receipt_path = Path(output_root) / batch_id / "batch_receipt.json"
        receipt = load_json(receipt_path)
        if declared.get("batch_receipt_hash") != receipt.get("batch_receipt_hash"):
            issues.append(f"{batch_id}: production manifest batch_receipt_hash mismatch")
        if declared.get("batch_hash") != batch.get("batch_hash"):
            issues.append(f"{batch_id}: production manifest batch_hash mismatch")
        if declared.get("valid") is not True:
            issues.append(f"{batch_id}: production manifest does not mark verified batch valid")

    if sorted(verified_keys) != _list(manifest.get("verified_record_keys")):
        issues.append("Full-chain verified record membership differs from production manifest")

    return {
        "valid": not issues,
        "issues": issues,
        "status": manifest.get("status"),
        "manifest_hash": manifest.get("manifest_hash", ""),
        "plan_hash": plan.get("plan_hash", ""),
        "plan_semantic_hash": plan.get("plan_semantic_hash", ""),
        "verified_batch_count": sum(item.get("valid") is True for item in batch_results),
        "verified_record_count": len(verified_keys) if not issues else 0,
    }
