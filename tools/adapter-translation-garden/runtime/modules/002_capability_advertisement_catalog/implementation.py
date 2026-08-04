from __future__ import annotations
from typing import Any


def run(descriptors: list[dict[str, Any]]) -> dict[str, Any]:
    entries = []
    by_operation: dict[str, list[str]] = {}
    for index, descriptor in enumerate(descriptors):
        adapter_id = str(descriptor.get("adapter_id", f"adapter-{index + 1}"))
        entry = {
            "adapter_id": adapter_id,
            "read": sorted(set(descriptor.get("read", []))),
            "write": sorted(set(descriptor.get("write", []))),
            "preserve": sorted(set(descriptor.get("preserve", []))),
            "refuse": sorted(set(descriptor.get("refuse", []))),
            "verify": sorted(set(descriptor.get("verify", []))),
            "local_only": bool(descriptor.get("local_only", True)),
        }
        entries.append(entry)
        for operation in entry["read"] + entry["write"]:
            by_operation.setdefault(operation, []).append(adapter_id)
    return {"entries": entries, "by_operation": {k: sorted(v) for k, v in sorted(by_operation.items())}}
