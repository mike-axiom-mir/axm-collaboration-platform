from __future__ import annotations
from copy import deepcopy
from typing import Any


def run(
    entity: Any,
    *,
    source_system: str,
    native_id: str,
    schema_id: str | None = None,
    provenance: list[dict[str, Any]] | None = None,
    limitations: list[str] | None = None,
    authority: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not source_system or not native_id:
        raise ValueError("source_system and native_id are required")
    return {
        "schema": "axm.translation.canonical-entity-envelope/v1",
        "source_system": source_system,
        "native_id": native_id,
        "schema_id": schema_id,
        "entity": deepcopy(entity),
        "provenance": deepcopy(provenance or []),
        "limitations": list(limitations or []),
        "authority": deepcopy(authority or {"mode": "none"}),
        "native_ownership_preserved": True,
    }
