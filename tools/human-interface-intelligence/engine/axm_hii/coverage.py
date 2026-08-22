from __future__ import annotations

from collections import Counter
from typing import Any

from .registry import PatternRegistry
from .util import stable_id

COVERAGE_VERSION = "0.1.0"


def build_pattern_coverage(gate_report: dict[str, Any], *, registry: PatternRegistry | None = None) -> dict[str, Any]:
    registry = registry or PatternRegistry()
    all_patterns = {item["interface_pattern_id"] for item in registry.patterns}
    selected = Counter()
    top3 = Counter()
    statuses = Counter()

    for record in gate_report.get("records", []):
        recommendation = record.get("recommendation")
        if isinstance(recommendation, dict):
            interface = recommendation.get("recommended_interface", {})
            pid = str(interface.get("interface_pattern_id", ""))
            if pid:
                selected[pid] += 1
            status = str(interface.get("recommendation_status", ""))
            if status:
                statuses[status] += 1
        trace = record.get("score_trace")
        if isinstance(trace, dict):
            for row in trace.get("ranked_patterns", [])[:3]:
                pid = str(row.get("interface_pattern_id", ""))
                if pid:
                    top3[pid] += 1

    unused_selected = sorted(all_patterns - set(selected))
    unseen_top3 = sorted(all_patterns - set(top3))
    core = {
        "source_gate_id": gate_report.get("gate_id", ""),
        "selected": dict(sorted(selected.items())),
        "top3": dict(sorted(top3.items())),
    }
    return {
        "coverage_version": COVERAGE_VERSION,
        "coverage_id": stable_id("axm.hii.pattern-coverage", core),
        "source_gate_id": gate_report.get("gate_id", ""),
        "registry_pattern_count": len(all_patterns),
        "selected_pattern_counts": dict(sorted(selected.items())),
        "top_three_appearance_counts": dict(sorted(top3.items())),
        "recommendation_status_counts": dict(sorted(statuses.items())),
        "patterns_never_selected_in_batch": unused_selected,
        "patterns_never_seen_in_top_three": unseen_top3,
        "interpretation_limits": [
            "Batch coverage measures observed fixture/context use, not intrinsic pattern usefulness.",
            "A pattern that is never selected must not be removed without broader evidence.",
            "Coverage is advisory input for registry research, not automatic registry mutation.",
        ],
    }
