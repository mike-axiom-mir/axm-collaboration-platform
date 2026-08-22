from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any
import hashlib

from .adapters import SUPPORTED_SUFFIXES, discover_source_files
from .canonical_json import canonical_sha256


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _relative(root: Path, path: Path) -> str:
    if root.is_file():
        return path.name
    return path.relative_to(root).as_posix()


def _safe_relative(value: str) -> bool:
    p = PurePosixPath(value)
    return (
        bool(value)
        and not p.is_absolute()
        and ".." not in p.parts
        and "." not in p.parts
    )


def build_source_seal(source_path: str | Path, *, recursive: bool = True) -> dict[str, Any]:
    raw_root = Path(source_path)
    if raw_root.is_symlink():
        raise ValueError(f"Source root may not be a symbolic link: {raw_root}")
    root = raw_root.resolve()
    files = discover_source_files(raw_root, recursive=recursive)
    if not files:
        raise ValueError(
            f"No supported capability source files found under {raw_root}. "
            f"Supported suffixes: {sorted(SUPPORTED_SUFFIXES)}"
        )

    entries = []
    for path in files:
        if path.is_symlink():
            raise ValueError(f"Capability source file may not be a symbolic link: {path}")
        resolved = path.resolve(strict=True)
        if root.is_dir() and root != resolved and root not in resolved.parents:
            raise ValueError(f"Capability source escapes the sealed source root: {path}")
        stat = resolved.stat()
        relative_path = _relative(root, resolved)
        if not _safe_relative(relative_path):
            raise ValueError(f"Unsafe source relative path: {relative_path!r}")
        entries.append({
            "relative_path": relative_path,
            "bytes": stat.st_size,
            "sha256": _sha256_file(resolved),
        })

    entries.sort(key=lambda item: item["relative_path"])
    if len({item["relative_path"] for item in entries}) != len(entries):
        raise ValueError("Source seal contains duplicate relative paths")

    stable = {
        "seal_version": "0.1.0",
        "recursive": bool(recursive),
        "supported_suffixes": sorted(SUPPORTED_SUFFIXES),
        "files": entries,
    }
    return {
        **stable,
        "source_root_at_generation": str(root),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "file_count": len(entries),
            "total_bytes": sum(item["bytes"] for item in entries),
        },
        "seal_hash": canonical_sha256(stable),
    }


def verify_source_seal(source_path: str | Path, seal: dict[str, Any]) -> dict[str, Any]:
    from .validators import validate_source_seal

    issues: list[str] = [f"schema: {item}" for item in validate_source_seal(seal)]
    raw_files = seal.get("files", []) if isinstance(seal.get("files"), list) else []
    expected_paths = [
        str(item.get("relative_path", ""))
        for item in raw_files
        if isinstance(item, dict)
    ]
    if not raw_files:
        issues.append("Source seal contains no files")
    if len(expected_paths) != len(set(expected_paths)):
        issues.append("Source seal contains duplicate relative paths")
    unsafe = [path for path in expected_paths if not _safe_relative(path)]
    if unsafe:
        issues.append(f"Source seal contains unsafe relative path(s): {unsafe[:5]}")
    declared_suffixes = sorted(str(item) for item in seal.get("supported_suffixes", []))
    current_suffixes = sorted(SUPPORTED_SUFFIXES)
    suffix_policy_matches = declared_suffixes == current_suffixes
    if not suffix_policy_matches:
        issues.append(
            f"Source seal suffix policy differs from this Atlas: "
            f"seal={declared_suffixes} atlas={current_suffixes}"
        )

    stable = {
        "seal_version": seal.get("seal_version"),
        "recursive": bool(seal.get("recursive", True)),
        "supported_suffixes": declared_suffixes,
        "files": sorted(raw_files, key=lambda item: str(item.get("relative_path", ""))),
    }
    declared_hash_valid = seal.get("seal_hash") == canonical_sha256(stable)
    if not declared_hash_valid:
        issues.append("Declared source seal hash is invalid")

    try:
        current = build_source_seal(
            source_path,
            recursive=bool(seal.get("recursive", True)),
        )
    except Exception as exc:
        return {
            "valid": False,
            "declared_seal_hash_valid": declared_hash_valid,
            "suffix_policy_matches": suffix_policy_matches,
            "expected_seal_hash": seal.get("seal_hash", ""),
            "observed_seal_hash": "",
            "missing_files": expected_paths,
            "added_files": [],
            "changed_files": [],
            "issues": issues + [str(exc)],
            "summary": {
                "expected_file_count": len(expected_paths),
                "observed_file_count": 0,
                "missing_count": len(expected_paths),
                "added_count": 0,
                "changed_count": 0,
            },
        }

    expected = {item["relative_path"]: item for item in raw_files if isinstance(item, dict)}
    observed = {item["relative_path"]: item for item in current.get("files", [])}

    missing = sorted(set(expected) - set(observed))
    added = sorted(set(observed) - set(expected))
    changed = []
    for path in sorted(set(expected) & set(observed)):
        before, after = expected[path], observed[path]
        if before.get("sha256") != after.get("sha256") or before.get("bytes") != after.get("bytes"):
            changed.append({
                "relative_path": path,
                "expected_sha256": before.get("sha256"),
                "observed_sha256": after.get("sha256"),
                "expected_bytes": before.get("bytes"),
                "observed_bytes": after.get("bytes"),
            })

    if missing:
        issues.append(f"{len(missing)} sealed file(s) are missing")
    if added:
        issues.append(f"{len(added)} source file(s) were added after sealing")
    if changed:
        issues.append(f"{len(changed)} sealed file(s) changed")

    valid = not issues
    return {
        "valid": valid,
        "declared_seal_hash_valid": declared_hash_valid,
        "suffix_policy_matches": suffix_policy_matches,
        "expected_seal_hash": seal.get("seal_hash", ""),
        "observed_seal_hash": current.get("seal_hash", ""),
        "missing_files": missing,
        "added_files": added,
        "changed_files": changed,
        "issues": issues,
        "summary": {
            "expected_file_count": len(expected),
            "observed_file_count": len(observed),
            "missing_count": len(missing),
            "added_count": len(added),
            "changed_count": len(changed),
        },
    }
