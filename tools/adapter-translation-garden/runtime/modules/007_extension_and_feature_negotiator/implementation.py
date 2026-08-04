from __future__ import annotations
from typing import Any


def run(*, supported: list[str], required: list[str] | None = None, optional: list[str] | None = None) -> dict[str, Any]:
    supported_set = set(supported)
    required_set = set(required or [])
    optional_set = set(optional or [])
    missing = sorted(required_set - supported_set)
    enabled = sorted(required_set | (optional_set & supported_set))
    return {
        "ok": not missing,
        "enabled": enabled if not missing else [],
        "missing_required": missing,
        "unsupported_optional": sorted(optional_set - supported_set),
        "reason": "All required features supported" if not missing else "Required features are missing",
    }
