from __future__ import annotations

from typing import Any

from .registry import PatternRegistry
from .scoring import rank_patterns


def registry_fingerprint(registry: PatternRegistry | None = None) -> str:
    """Return the fingerprint of the exact registry instance used for selection."""
    return (registry or PatternRegistry()).fingerprint


def build_score_trace(
    capability: dict[str, Any],
    context: dict[str, Any],
    *,
    registry: PatternRegistry | None = None,
    limit: int | None = None,
) -> dict[str, Any]:
    """Expose deterministic ranking, hard eligibility, reasons, and penalties."""
    registry = registry or PatternRegistry()
    ranked = rank_patterns(capability, context, registry)
    selected = ranked if limit is None else ranked[: max(0, limit)]
    rows: list[dict[str, Any]] = []
    for rank, item in enumerate(selected, start=1):
        rows.append({
            "rank": rank,
            "interface_pattern_id": item.pattern["interface_pattern_id"],
            "interface_name": item.pattern["interface_name"],
            "interface_family": item.pattern["interface_family"],
            "eligible": item.eligible,
            "eligibility_blockers": list(item.eligibility_blockers),
            "score": item.score,
            "reasons": list(item.reasons),
            "penalties": list(item.penalties),
            "minimum_user_skill": item.pattern["minimum_user_skill"],
            "attention_cost": item.pattern["attention_cost"],
            "interaction_cost": item.pattern["interaction_cost"],
            "compute_overhead": item.pattern.get("compute_overhead", "unknown"),
            "required_tool_any": item.pattern.get("required_tool_any", []),
        })
    return {
        "trace_version": "0.3.0",
        "capability_id": capability.get("capability_id", ""),
        "contract_version": capability.get("contract_version", ""),
        "registry_fingerprint": registry_fingerprint(registry),
        "ranked_patterns": rows,
    }
