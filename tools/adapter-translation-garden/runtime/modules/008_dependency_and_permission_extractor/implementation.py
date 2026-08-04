from __future__ import annotations
from typing import Any

KEYS = {
    "runtimes": {"runtime", "runtimes", "requires_runtime"},
    "libraries": {"library", "libraries", "dependencies", "requires"},
    "devices": {"device", "devices"},
    "paths": {"path", "paths", "filesystem_paths"},
    "network": {"host", "hosts", "network", "network_access"},
    "permissions": {"permission", "permissions", "capabilities", "authority"},
    "approvals": {"approval", "approvals", "human_approval"},
}


def run(contract: Any) -> dict[str, Any]:
    result: dict[str, list[str]] = {key: [] for key in KEYS}
    def visit(value: Any, key_hint: str = "") -> None:
        lowered = key_hint.lower()
        for bucket, names in KEYS.items():
            if lowered in names:
                if isinstance(value, list):
                    result[bucket].extend(str(x) for x in value)
                elif isinstance(value, (str, int, float, bool)):
                    result[bucket].append(str(value))
        if isinstance(value, dict):
            for key, child in value.items():
                visit(child, str(key))
        elif isinstance(value, list):
            for child in value:
                visit(child, key_hint)
    visit(contract)
    return {key: sorted(set(values)) for key, values in result.items()}
