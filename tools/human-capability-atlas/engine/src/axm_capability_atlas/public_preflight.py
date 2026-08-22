from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any
import hashlib

from . import (
    __version__, CONTRACT_VERSION, EXPORT_FORMAT_VERSION, MODULE_ID,
    PUBLIC_INTAKE_PREFLIGHT_VERSION, INGEST_IN_PROGRESS_MARKER,
    PUBLIC_INTAKE_IN_PROGRESS_MARKER,
)
from .canonical_json import canonical_sha256
from .discovery_integrity import build_discovery_integrity_report
from .enrichment import verify_enrichment_catalog
from .implementation_identity import implementation_fingerprint
from .io import load_json
from .normalized_inventory import verify_normalized_inventory
from .repository_snapshot import capture_repository_snapshot, verify_repository_snapshot
from .source_seal import verify_source_seal


PREFLIGHT_FILENAME = "public_intake_preflight.json"

BOUND_ARTIFACTS: tuple[tuple[str, str], ...] = (
    ("capability_registry_source_seal.json", "capability_registry_source_seal"),
    ("analysis/discovery_integrity_report.json", "discovery_integrity_report"),
    ("analysis/enrichment_catalog.json", "enrichment_catalog"),
    ("analysis/identity_report.json", "identity_report"),
    ("analysis/capability_graph.json", "capability_graph"),
    ("reports/enrichment_report.json", "enrichment_report"),
    ("reports/human_capability_targets.json", "human_capability_targets"),
    ("reports/dependency_reference_targets.json", "dependency_reference_targets"),
    ("reports/registry_role_review_targets.json", "registry_role_review_targets"),
    ("reports/accepted_records.json", "accepted_records"),
    ("reports/rejected_records.json", "rejected_records"),
    ("reports/duplicate_capability_ids.json", "duplicate_capability_ids"),
    ("ingestion_report.json", "ingestion_report"),
    ("intake_gate_report.json", "intake_gate_report"),
    ("registry_snapshot.json", "registry_snapshot"),
    ("normalized_inventory.json", "normalized_inventory"),
)


def _dict(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _safe_relative(value: str) -> bool:
    path = PurePosixPath(value)
    return bool(value) and not path.is_absolute() and "." not in path.parts and ".." not in path.parts


def _artifact_bindings(output_root: Path) -> list[dict[str, Any]]:
    bindings = []
    for relative, artifact_type in BOUND_ARTIFACTS:
        path = output_root / relative
        if path.is_symlink():
            raise ValueError(f"Preflight artifact may not be a symbolic link: {relative}")
        if not path.is_file():
            raise ValueError(f"Required public-intake artifact is missing: {relative}")
        bindings.append({
            "relative_path": relative,
            "artifact_type": artifact_type,
            "bytes": path.stat().st_size,
            "sha256": _sha256_file(path),
        })
    return bindings


def _semantic_preflight(preflight: dict[str, Any]) -> dict[str, Any]:
    repository = _dict(preflight.get("repository_snapshot"))
    return {
        "preflight_version": preflight.get("preflight_version"),
        "operation": preflight.get("operation"),
        "module_id": preflight.get("module_id"),
        "module_version": preflight.get("module_version"),
        "implementation_fingerprint": preflight.get("implementation_fingerprint"),
        "shared_contract_version": preflight.get("shared_contract_version"),
        "capability_record_export_format_version": preflight.get(
            "capability_record_export_format_version"
        ),
        "status": preflight.get("status"),
        "allow_dirty_repository": preflight.get("allow_dirty_repository"),
        "repository_snapshot": {
            "snapshot_version": repository.get("snapshot_version"),
            "git": repository.get("git"),
            "snapshot_hash": repository.get("snapshot_hash"),
        },
        "artifact_layout": [
            {
                "relative_path": _dict(item).get("relative_path"),
                "artifact_type": _dict(item).get("artifact_type"),
            }
            for item in _list(preflight.get("artifact_bindings"))
        ],
        "counts": preflight.get("counts"),
        "role_partition": preflight.get("role_partition"),
        "discovery_bundle_hash": preflight.get("discovery_bundle_hash"),
        "source_seal_hash": preflight.get("source_seal_hash"),
        "normalized_inventory_semantic_hash": preflight.get(
            "normalized_inventory_semantic_hash"
        ),
        "enrichment_catalog_hash": preflight.get("enrichment_catalog_hash"),
        "enrichment_source_seal_hash": preflight.get("enrichment_source_seal_hash"),
        "blockers": preflight.get("blockers"),
        "warnings": preflight.get("warnings"),
        "merge_claim": preflight.get("merge_claim"),
    }


def _exact_preflight(preflight: dict[str, Any]) -> dict[str, Any]:
    value = dict(preflight)
    value.pop("preflight_hash", None)
    value.pop("preflight_semantic_hash", None)
    return value


def build_public_intake_preflight(
    repository_root: str | Path,
    output_root: str | Path,
    *,
    status: str,
    blockers: list[str],
    warnings: list[str],
    counts: dict[str, Any],
    role_partition: dict[str, Any],
    discovery_bundle_hash: str,
    source_seal_hash: str,
    enrichment_catalog_hash: str,
    enrichment_source_seal_hash: str,
    allow_dirty_repository: bool,
) -> dict[str, Any]:
    repo = Path(repository_root).resolve(strict=True)
    output = Path(output_root).resolve(strict=True)
    repository_snapshot = capture_repository_snapshot(repo)
    artifact_bindings = _artifact_bindings(output)

    effective_blockers = list(blockers)
    effective_warnings = list(warnings)
    git = _dict(repository_snapshot.get("git"))
    if git.get("state") == "GIT_SNAPSHOT" and git.get("dirty") is True:
        message = (
            f"Repository snapshot is dirty ({git.get('status_entry_count', 0)} status entries)."
        )
        if allow_dirty_repository:
            effective_warnings.append(message + " Explicit allow-dirty was used; exact file hashes remain authoritative.")
        else:
            effective_blockers.append(message + " Re-run with a clean snapshot or explicit --allow-dirty.")
    elif git.get("state") == "NO_GIT_METADATA":
        effective_warnings.append(
            "Git commit metadata is unavailable; exact discovery/source/enrichment byte hashes are the snapshot authority."
        )
    elif git.get("state") == "GIT_METADATA_PARTIAL":
        effective_warnings.append(
            "Git metadata was only partially readable; exact file hashes remain authoritative."
        )

    inventory = load_json(output / "normalized_inventory.json")
    normalized_inventory_hash = str(inventory.get("inventory_hash", ""))
    normalized_inventory_semantic_hash = str(
        inventory.get("inventory_semantic_hash", "")
    )

    effective_status = "READY" if status == "READY" and not effective_blockers else "TEST_HOLD_REVIEW"
    preflight: dict[str, Any] = {
        "preflight_version": PUBLIC_INTAKE_PREFLIGHT_VERSION,
        "operation": "axm_public_intake_preflight",
        "module_id": MODULE_ID,
        "module_version": __version__,
        "implementation_fingerprint": implementation_fingerprint(),
        "shared_contract_version": CONTRACT_VERSION,
        "capability_record_export_format_version": EXPORT_FORMAT_VERSION,
        "repository_root_at_generation": str(repo),
        "output_root_at_generation": str(output),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": effective_status,
        "allow_dirty_repository": bool(allow_dirty_repository),
        "repository_snapshot": repository_snapshot,
        "artifact_bindings": artifact_bindings,
        "counts": counts,
        "role_partition": role_partition,
        "discovery_bundle_hash": discovery_bundle_hash,
        "source_seal_hash": source_seal_hash,
        "normalized_inventory_hash": normalized_inventory_hash,
        "normalized_inventory_semantic_hash": normalized_inventory_semantic_hash,
        "enrichment_catalog_hash": enrichment_catalog_hash,
        "enrichment_source_seal_hash": enrichment_source_seal_hash,
        "blockers": sorted(set(str(item) for item in effective_blockers)),
        "warnings": sorted(set(str(item) for item in effective_warnings)),
        "merge_claim": False,
    }
    preflight["preflight_semantic_hash"] = canonical_sha256(
        _semantic_preflight(preflight)
    )
    preflight["preflight_hash"] = canonical_sha256(_exact_preflight(preflight))
    return preflight


def verify_public_intake_preflight(
    output_root: str | Path,
    preflight: dict[str, Any] | None = None,
    *,
    repository_root: str | Path | None = None,
    ignore_in_progress: bool = False,
) -> dict[str, Any]:
    output = Path(output_root)
    issues: list[str] = []
    if not ignore_in_progress:
        if (output / INGEST_IN_PROGRESS_MARKER).exists():
            issues.append("public intake cannot verify while ingestion is marked IN_PROGRESS")
        if (output / PUBLIC_INTAKE_IN_PROGRESS_MARKER).exists():
            issues.append("public intake cannot verify while preparation is marked IN_PROGRESS")
    if preflight is None:
        try:
            preflight = load_json(output / PREFLIGHT_FILENAME)
        except Exception as exc:
            return {"valid": False, "issues": [str(exc)]}
    preflight = _dict(preflight)
    from .validators import validate_public_intake_preflight

    issues.extend(
        f"schema: {item}" for item in validate_public_intake_preflight(preflight)
    )

    declared_hash = str(preflight.get("preflight_hash", ""))
    actual_hash = canonical_sha256(_exact_preflight(preflight))
    if declared_hash != actual_hash:
        issues.append("public intake preflight_hash mismatch")
    declared_semantic_hash = str(preflight.get("preflight_semantic_hash", ""))
    actual_semantic_hash = canonical_sha256(_semantic_preflight(preflight))
    if declared_semantic_hash != actual_semantic_hash:
        issues.append("public intake preflight_semantic_hash mismatch")
    if preflight.get("preflight_version") != PUBLIC_INTAKE_PREFLIGHT_VERSION:
        issues.append("public intake preflight version is incompatible")
    if preflight.get("module_id") != MODULE_ID or preflight.get("module_version") != __version__:
        issues.append("public intake preflight module identity/version mismatch")
    if preflight.get("implementation_fingerprint") != implementation_fingerprint():
        issues.append("public intake preflight implementation fingerprint mismatch")
    if preflight.get("shared_contract_version") != CONTRACT_VERSION:
        issues.append("public intake preflight shared-contract version mismatch")
    if preflight.get("capability_record_export_format_version") != EXPORT_FORMAT_VERSION:
        issues.append("public intake preflight Capability Record export format mismatch")
    try:
        parsed = datetime.fromisoformat(str(preflight.get("generated_at", "")).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError("timezone missing")
    except Exception:
        issues.append("public intake preflight generated_at must be a timezone-aware ISO-8601 timestamp")
    if preflight.get("status") != "READY":
        issues.append(f"public intake preflight status is {preflight.get('status')}, not READY")
    if preflight.get("merge_claim") is not False:
        issues.append("public intake preflight must not claim merge acceptance")
    if _list(preflight.get("blockers")):
        issues.append("public intake preflight contains blockers")

    declared_bindings = _list(preflight.get("artifact_bindings"))
    expected_paths = [relative for relative, _ in BOUND_ARTIFACTS]
    declared_paths = [str(_dict(item).get("relative_path", "")) for item in declared_bindings]
    if declared_paths != expected_paths:
        issues.append("public intake preflight artifact binding membership/order is invalid")
    for item in declared_bindings:
        binding = _dict(item)
        relative = str(binding.get("relative_path", ""))
        if not _safe_relative(relative):
            issues.append(f"unsafe preflight artifact path: {relative!r}")
            continue
        path = output / relative
        if path.is_symlink() or not path.is_file():
            issues.append(f"preflight-bound artifact is missing/invalid: {relative}")
            continue
        if path.stat().st_size != binding.get("bytes") or _sha256_file(path) != binding.get("sha256"):
            issues.append(f"preflight-bound artifact changed: {relative}")

    normalized_result = verify_normalized_inventory(output)
    if not normalized_result.get("valid"):
        issues.extend(
            f"normalized inventory: {item}"
            for item in normalized_result.get("issues", [])
        )
    if normalized_result.get("inventory_hash") != preflight.get("normalized_inventory_hash"):
        issues.append("normalized inventory exact hash differs from preflight")
    if (
        normalized_result.get("inventory_semantic_hash")
        != preflight.get("normalized_inventory_semantic_hash")
    ):
        issues.append("normalized inventory semantic hash differs from preflight")

    repo_text = str(
        repository_root
        if repository_root is not None
        else preflight.get("repository_root_at_generation", "")
    )
    repo = Path(repo_text) if repo_text else None
    if repo is None or not repo.is_dir():
        issues.append("preflight repository snapshot is unavailable for re-verification")
    else:
        repository_result = verify_repository_snapshot(
            repo, _dict(preflight.get("repository_snapshot"))
        )
        if not repository_result.get("valid"):
            issues.extend(repository_result.get("issues", []))

        try:
            discovery = build_discovery_integrity_report(repo)
            if discovery.get("valid") is not True:
                issues.append("current public discovery integrity is invalid")
            if discovery.get("discovery_bundle_hash") != preflight.get("discovery_bundle_hash"):
                issues.append("public discovery bundle changed after preflight")
        except Exception as exc:
            issues.append(f"public discovery re-verification failed: {exc}")

        try:
            catalog = load_json(output / "analysis" / "enrichment_catalog.json")
            enrichment_result = verify_enrichment_catalog(repo, catalog)
            if not enrichment_result.get("valid"):
                issues.extend(enrichment_result.get("issues", []))
            if catalog.get("catalog_hash") != preflight.get("enrichment_catalog_hash"):
                issues.append("enrichment catalog hash differs from preflight")
            if catalog.get("source_seal_hash") != preflight.get("enrichment_source_seal_hash"):
                issues.append("enrichment source seal differs from preflight")
        except Exception as exc:
            issues.append(f"enrichment re-verification failed: {exc}")

        try:
            seal = load_json(output / "capability_registry_source_seal.json")
            capability_registry = repo / "registry" / "capabilities.jsonl"
            seal_result = verify_source_seal(capability_registry, seal)
            if not seal_result.get("valid"):
                issues.extend(seal_result.get("issues", []))
            if seal.get("seal_hash") != preflight.get("source_seal_hash"):
                issues.append("capability registry source seal differs from preflight")
        except Exception as exc:
            issues.append(f"capability registry seal re-verification failed: {exc}")

    return {
        "valid": not issues,
        "issues": issues,
        "preflight_hash": declared_hash,
        "preflight_semantic_hash": declared_semantic_hash,
        "status": preflight.get("status"),
    }
