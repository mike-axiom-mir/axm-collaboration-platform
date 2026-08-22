from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any
import hashlib

from . import NORMALIZED_INVENTORY_VERSION
from .canonical_json import canonical_sha256
from .io import load_json


def _dict(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return list(value) if isinstance(value, list) else []


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _safe_relative(value: str) -> bool:
    p = PurePosixPath(value)
    return bool(value) and not p.is_absolute() and "." not in p.parts and ".." not in p.parts


def _portable_record_key(record: dict[str, Any]) -> str:
    ref = _dict(record.get("source_reference"))
    payload = {
        "capability_id": str(record.get("capability_id", "")),
        "revision": str(record.get("revision") or "unknown"),
        "source_hash": str(ref.get("source_hash", "")),
        "source_pointer": str(ref.get("source_pointer", "")),
        "source_line": str(ref.get("source_line", "")),
    }
    return canonical_sha256(payload)[:20]


def _semantic_payload(record: dict[str, Any]) -> dict[str, Any]:
    payload = deepcopy(record)
    ref = payload.get("source_reference")
    if isinstance(ref, dict):
        ref.pop("source_location", None)
        ref.pop("last_verified_at", None)
    return payload


def _stable_inventory(inventory: dict[str, Any]) -> dict[str, Any]:
    return {
        "inventory_version": inventory.get("inventory_version"),
        "records": inventory.get("records"),
    }


def _semantic_inventory(inventory: dict[str, Any]) -> dict[str, Any]:
    records = []
    for raw in _list(inventory.get("records")):
        item = _dict(raw)
        records.append({
            "record_key": item.get("record_key"),
            "capability_id": item.get("capability_id"),
            "capability_revision": item.get("capability_revision"),
            "source_hash": item.get("source_hash"),
            "source_pointer": item.get("source_pointer"),
            "source_line": item.get("source_line"),
            "normalized_source_semantic_sha256": item.get(
                "normalized_source_semantic_sha256"
            ),
        })
    return {
        "inventory_version": inventory.get("inventory_version"),
        "records": records,
    }


def _accepted_normalized_names(root: Path) -> list[str]:
    accepted_path = root / "reports" / "accepted_records.json"
    accepted = load_json(accepted_path)
    if not isinstance(accepted, list):
        raise ValueError("reports/accepted_records.json must be a JSON array")
    names: list[str] = []
    for item in accepted:
        if not isinstance(item, dict) or not item.get("normalized_path"):
            raise ValueError("accepted_records.json contains an invalid normalized_path entry")
        name = Path(str(item["normalized_path"])).name
        if name in names:
            raise ValueError(f"accepted_records.json repeats normalized file: {name}")
        names.append(name)
    return names


def build_normalized_inventory(intake_root: str | Path) -> dict[str, Any]:
    raw_root = Path(intake_root)
    if raw_root.is_symlink():
        raise ValueError(f"Intake root may not be a symbolic link: {raw_root}")
    root = raw_root.resolve(strict=True)
    normalized = root / "normalized_sources"
    if normalized.is_symlink() or not normalized.is_dir():
        raise ValueError("normalized_sources directory is missing or invalid")

    expected_names = _accepted_normalized_names(root)
    actual_paths = {
        path.name: path
        for path in normalized.glob("*.json")
        if path.is_file() and not path.is_symlink()
    }
    symlinks = [path.name for path in normalized.glob("*.json") if path.is_symlink()]
    if symlinks:
        raise ValueError(f"Normalized source files may not be symbolic links: {symlinks[:5]}")
    missing = sorted(set(expected_names) - set(actual_paths))
    extra = sorted(set(actual_paths) - set(expected_names))
    if missing or extra:
        raise ValueError(
            f"Normalized inventory membership mismatch: missing={missing[:5]} extra={extra[:5]}"
        )

    records: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    for name in expected_names:
        path = actual_paths[name]
        record = load_json(path)
        if not isinstance(record, dict) or not record.get("capability_id"):
            raise ValueError(f"Normalized source file is not a capability record: {name}")
        ref = _dict(record.get("source_reference"))
        key = _portable_record_key(record)
        if key in seen_keys:
            raise ValueError(f"Normalized record key collision: {key}")
        seen_keys.add(key)
        records.append({
            "relative_path": f"normalized_sources/{name}",
            "bytes": path.stat().st_size,
            "file_sha256": _sha256_file(path),
            "record_key": key,
            "capability_id": str(record.get("capability_id", "")),
            "capability_revision": str(record.get("revision") or "unknown"),
            "source_hash": str(ref.get("source_hash", "")),
            "source_pointer": str(ref.get("source_pointer", "")),
            "source_line": str(ref.get("source_line", "")),
            "normalized_source_semantic_sha256": canonical_sha256(
                _semantic_payload(record)
            ),
        })

    records.sort(key=lambda item: (
        item["capability_id"], item["capability_revision"], item["source_hash"],
        item["source_pointer"], item["source_line"], item["record_key"],
    ))
    inventory: dict[str, Any] = {
        "inventory_version": NORMALIZED_INVENTORY_VERSION,
        "intake_root_at_generation": str(root),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "records": records,
        "summary": {
            "record_count": len(records),
            "total_bytes": sum(int(item["bytes"]) for item in records),
        },
    }
    inventory["inventory_semantic_hash"] = canonical_sha256(
        _semantic_inventory(inventory)
    )
    inventory["inventory_hash"] = canonical_sha256(_stable_inventory(inventory))
    return inventory


def verify_normalized_inventory(
    intake_root: str | Path,
    inventory: dict[str, Any] | None = None,
) -> dict[str, Any]:
    root = Path(intake_root)
    issues: list[str] = []
    if inventory is None:
        try:
            inventory = load_json(root / "normalized_inventory.json")
        except Exception as exc:
            return {"valid": False, "issues": [str(exc)]}
    inventory = _dict(inventory)

    from .validators import validate_normalized_inventory

    issues.extend(
        f"schema: {item}" for item in validate_normalized_inventory(inventory)
    )
    if inventory.get("inventory_version") != NORMALIZED_INVENTORY_VERSION:
        issues.append("normalized inventory version is incompatible")
    declared_hash = str(inventory.get("inventory_hash", ""))
    if declared_hash != canonical_sha256(_stable_inventory(inventory)):
        issues.append("normalized inventory_hash mismatch")
    declared_semantic_hash = str(inventory.get("inventory_semantic_hash", ""))
    if declared_semantic_hash != canonical_sha256(_semantic_inventory(inventory)):
        issues.append("normalized inventory_semantic_hash mismatch")

    try:
        expected_names = _accepted_normalized_names(root)
    except Exception as exc:
        return {
            "valid": False,
            "issues": issues + [str(exc)],
            "inventory_hash": declared_hash,
        }

    declared_records = _list(inventory.get("records"))
    declared_paths = [str(_dict(item).get("relative_path", "")) for item in declared_records]
    expected_paths = [f"normalized_sources/{name}" for name in expected_names]
    if sorted(declared_paths) != sorted(expected_paths):
        issues.append("normalized inventory membership differs from accepted_records.json")
    if len(declared_paths) != len(set(declared_paths)):
        issues.append("normalized inventory contains duplicate relative paths")

    normalized_dir = root / "normalized_sources"
    actual_names = {
        path.name for path in normalized_dir.glob("*.json")
        if path.is_file() and not path.is_symlink()
    } if normalized_dir.is_dir() else set()
    if actual_names != set(expected_names):
        issues.append("normalized_sources directory membership differs from accepted records")

    seen_keys: set[str] = set()
    for raw in declared_records:
        item = _dict(raw)
        relative = str(item.get("relative_path", ""))
        if not _safe_relative(relative):
            issues.append(f"unsafe normalized inventory path: {relative!r}")
            continue
        path = root / PurePosixPath(relative)
        if path.is_symlink() or not path.is_file():
            issues.append(f"normalized inventory file is missing/invalid: {relative}")
            continue
        if path.stat().st_size != item.get("bytes") or _sha256_file(path) != item.get("file_sha256"):
            issues.append(f"normalized inventory file bytes changed: {relative}")
            continue
        try:
            record = load_json(path)
        except Exception as exc:
            issues.append(f"normalized inventory JSON invalid at {relative}: {exc}")
            continue
        ref = _dict(record.get("source_reference"))
        observed_key = _portable_record_key(record)
        if observed_key != item.get("record_key"):
            issues.append(f"normalized record key mismatch: {relative}")
        if observed_key in seen_keys:
            issues.append(f"duplicate normalized record key: {observed_key}")
        seen_keys.add(observed_key)
        comparisons = {
            "capability_id": str(record.get("capability_id", "")),
            "capability_revision": str(record.get("revision") or "unknown"),
            "source_hash": str(ref.get("source_hash", "")),
            "source_pointer": str(ref.get("source_pointer", "")),
            "source_line": str(ref.get("source_line", "")),
            "normalized_source_semantic_sha256": canonical_sha256(
                _semantic_payload(record)
            ),
        }
        for key, observed in comparisons.items():
            if item.get(key) != observed:
                issues.append(f"{relative}: {key} differs from normalized record")

    summary = _dict(inventory.get("summary"))
    if summary.get("record_count") != len(declared_records):
        issues.append("normalized inventory summary.record_count mismatch")
    if summary.get("total_bytes") != sum(int(_dict(item).get("bytes", 0) or 0) for item in declared_records):
        issues.append("normalized inventory summary.total_bytes mismatch")

    return {
        "valid": not issues,
        "issues": issues,
        "inventory_hash": declared_hash,
        "inventory_semantic_hash": declared_semantic_hash,
        "record_count": len(declared_records),
    }
