from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from .util import PACKAGE_ROOT, load_json

LOCK_PATH = PACKAGE_ROOT / "integration" / "dependency_lock.json"


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_dependency_lock(lock_path: str | Path = LOCK_PATH, *, package_root: str | Path | None = None) -> dict[str, Any]:
    root = Path(package_root) if package_root is not None else PACKAGE_ROOT
    lock = load_json(lock_path)
    results: list[dict[str, Any]] = []
    for entry in lock.get("files", []):
        relative = Path(entry["path"])
        target = root / relative
        if not target.is_file():
            results.append({"path": entry["path"], "status": "MISSING", "expected_sha256": entry["sha256"], "actual_sha256": ""})
            continue
        actual = file_sha256(target)
        results.append({
            "path": entry["path"],
            "status": "PASS" if actual == entry["sha256"] else "CONFLICTED",
            "expected_sha256": entry["sha256"],
            "actual_sha256": actual,
        })
    return {
        "lock_version": lock.get("lock_version", ""),
        "contract_id": lock.get("contract_id", ""),
        "contract_version": lock.get("contract_version", ""),
        "overall_status": "PASS" if results and all(item["status"] == "PASS" for item in results) else "BLOCKED",
        "files": results,
    }
