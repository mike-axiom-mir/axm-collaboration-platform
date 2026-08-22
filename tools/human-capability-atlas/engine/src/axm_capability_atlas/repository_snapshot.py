from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import os
import subprocess

from . import REPOSITORY_SNAPSHOT_VERSION
from .canonical_json import canonical_sha256


def _run_git(root: Path, *args: str) -> tuple[bool, str]:
    env = dict(os.environ)
    # Prevent optional index locking/refresh writes while inspecting a read-only copy.
    env["GIT_OPTIONAL_LOCKS"] = "0"
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args],
            env=env,
            text=True,
            capture_output=True,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False, ""
    if result.returncode != 0:
        return False, ""
    return True, result.stdout.strip()


def _stable_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    return {
        "snapshot_version": snapshot.get("snapshot_version"),
        "git": snapshot.get("git"),
    }


def capture_repository_snapshot(repository_root: str | Path) -> dict[str, Any]:
    raw = Path(repository_root)
    if raw.is_symlink():
        raise ValueError(f"Repository root may not be a symbolic link: {raw}")
    root = raw.resolve(strict=True)
    if not root.is_dir():
        raise ValueError(f"Repository root is not a directory: {root}")

    inside_ok, inside = _run_git(root, "rev-parse", "--is-inside-work-tree")
    if not inside_ok or inside != "true":
        git = {
            "state": "NO_GIT_METADATA",
            "commit": "",
            "branch": "",
            "dirty": None,
            "status_entry_count": 0,
            "status_hash": "",
        }
    else:
        commit_ok, commit = _run_git(root, "rev-parse", "HEAD")
        branch_ok, branch = _run_git(root, "rev-parse", "--abbrev-ref", "HEAD")
        status_ok, status_text = _run_git(
            root, "status", "--porcelain=v1", "--untracked-files=normal"
        )
        status_lines = [line for line in status_text.splitlines() if line] if status_ok else []
        git = {
            "state": "GIT_SNAPSHOT" if commit_ok and status_ok else "GIT_METADATA_PARTIAL",
            "commit": commit if commit_ok else "",
            "branch": branch if branch_ok else "",
            "dirty": bool(status_lines) if status_ok else None,
            "status_entry_count": len(status_lines),
            "status_hash": canonical_sha256(status_lines) if status_ok else "",
        }

    snapshot = {
        "snapshot_version": REPOSITORY_SNAPSHOT_VERSION,
        "repository_root_at_generation": str(root),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "git": git,
    }
    snapshot["snapshot_hash"] = canonical_sha256(_stable_snapshot(snapshot))
    return snapshot


def verify_repository_snapshot(
    repository_root: str | Path,
    snapshot: dict[str, Any],
) -> dict[str, Any]:
    from .validators import validate_repository_snapshot

    issues: list[str] = [f"schema: {item}" for item in validate_repository_snapshot(snapshot)]
    declared_hash = str(snapshot.get("snapshot_hash", ""))
    if declared_hash != canonical_sha256(_stable_snapshot(snapshot)):
        issues.append("repository snapshot_hash mismatch")
    try:
        current = capture_repository_snapshot(repository_root)
    except Exception as exc:
        return {
            "valid": False,
            "issues": issues + [str(exc)],
            "expected_snapshot_hash": declared_hash,
            "observed_snapshot_hash": "",
        }
    if current.get("snapshot_hash") != declared_hash:
        issues.append("repository Git snapshot changed after preflight")
    return {
        "valid": not issues,
        "issues": issues,
        "expected_snapshot_hash": declared_hash,
        "observed_snapshot_hash": current.get("snapshot_hash", ""),
        "current": current,
    }
