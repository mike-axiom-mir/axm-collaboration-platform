from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any
import hashlib

from . import (
    __version__, CONTRACT_VERSION, MODULE_ID, EXPORT_FORMAT_VERSION,
    IMPLEMENTATION_FINGERPRINT_VERSION,
)
from .canonical_json import canonical_sha256


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


@lru_cache(maxsize=1)
def implementation_manifest() -> dict[str, Any]:
    """Fingerprint the exact installed runtime logic and bundled schemas.

    The fingerprint deliberately excludes docs, tests, bytecode caches, and
    machine-specific paths. It binds producer evidence to the Python source and
    schema bytes that can actually affect runtime behavior.
    """
    root = Path(__file__).resolve().parent
    candidates = sorted(root.glob("*.py")) + sorted((root / "schemas").glob("*.json"))
    entries = []
    for path in candidates:
        if not path.is_file() or path.is_symlink():
            continue
        entries.append({
            "relative_path": path.relative_to(root).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": _sha256_file(path),
        })
    stable = {
        "fingerprint_version": IMPLEMENTATION_FINGERPRINT_VERSION,
        "module_id": MODULE_ID,
        "module_version": __version__,
        "shared_contract_version": CONTRACT_VERSION,
        "capability_record_export_format_version": EXPORT_FORMAT_VERSION,
        "files": entries,
    }
    return {
        **stable,
        "implementation_fingerprint": canonical_sha256(stable),
        "file_count": len(entries),
    }


def implementation_fingerprint() -> str:
    return str(implementation_manifest()["implementation_fingerprint"])
