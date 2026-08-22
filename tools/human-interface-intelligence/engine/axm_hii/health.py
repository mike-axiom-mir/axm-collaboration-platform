from __future__ import annotations

from collections import Counter
from typing import Any

from .util import stable_id

HEALTH_REPORT_VERSION = "0.1.0"
OBSERVATION_VERSION = "0.1.0"


def _severity(kind: str) -> str:
    return {
        "boundary_block": "blocking",
        "evidence_gap": "high",
        "evidence_conflict": "blocking",
        "no_safe_match": "high",
        "conditional_dependency": "moderate",
        "weak_differentiation": "low",
        "low_confidence": "moderate",
    }.get(kind, "info")


def _observation(capability_id: str, kind: str, facts: list[str], investigations: list[str], source_id: str) -> dict[str, Any]:
    core = {"capability_id": capability_id, "kind": kind, "facts": facts, "source_id": source_id}
    return {
        "observation_id": stable_id("axm.hii.evolution-observation", core),
        "capability_id": capability_id,
        "kind": kind,
        "severity": _severity(kind),
        "facts": facts,
        "inferences": [],
        "suggested_investigations": investigations,
        "source_reference": source_id,
    }


def build_health_report(gate_report: dict[str, Any]) -> dict[str, Any]:
    records = gate_report.get("records", []) if isinstance(gate_report, dict) else []
    statuses = Counter()
    pattern_usage = Counter()
    recommendation_statuses = Counter()
    unknown_paths = Counter()
    conflict_paths = Counter()
    low_confidence: list[dict[str, Any]] = []

    for record in records:
        statuses[str(record.get("gate_status", "UNKNOWN"))] += 1
        recommendation = record.get("recommendation")
        if not isinstance(recommendation, dict):
            continue
        selected = recommendation.get("recommended_interface", {})
        pid = selected.get("interface_pattern_id")
        if pid:
            pattern_usage[str(pid)] += 1
        status = selected.get("recommendation_status")
        if status:
            recommendation_statuses[str(status)] += 1
        confidence = selected.get("confidence")
        if isinstance(confidence, (int, float)) and confidence < 0.6:
            low_confidence.append({"capability_id": record.get("capability_id", ""), "confidence": confidence, "pattern_id": pid or ""})
        evidence = recommendation.get("evidence", {})
        for path in evidence.get("unknowns", []):
            unknown_paths[str(path)] += 1
        for text in evidence.get("conflicts", []):
            conflict_paths[str(text).split(":", 1)[0]] += 1

    total = len(records)
    consistency_pass = statuses.get("PASS", 0)
    direct = recommendation_statuses.get("recommended", 0)
    conditional = recommendation_statuses.get("conditional", 0)
    blocked_recommendations = (
        recommendation_statuses.get("insufficient_information", 0)
        + recommendation_statuses.get("no_safe_match", 0)
    )
    processed_recommendations = sum(recommendation_statuses.values())
    return {
        "health_report_version": HEALTH_REPORT_VERSION,
        "source_gate_id": gate_report.get("gate_id", ""),
        "source_gate_status": gate_report.get("overall_status", ""),
        "total_records": total,
        "gate_status_counts": dict(sorted(statuses.items())),
        "recommendation_status_counts": dict(sorted(recommendation_statuses.items())),
        "pattern_usage": dict(sorted(pattern_usage.items())),
        "most_common_unknowns": [{"path": path, "count": count} for path, count in unknown_paths.most_common(10)],
        "most_common_conflicts": [{"path": path, "count": count} for path, count in conflict_paths.most_common(10)],
        "low_confidence_recommendations": low_confidence,
        "intake_readiness": {
            "consistency_pass_count": consistency_pass,
            "direct_recommendation_count": direct,
            "conditional_recommendation_count": conditional,
            "blocked_recommendation_count": blocked_recommendations,
            "unprocessed_or_failed_count": max(0, total - processed_recommendations),
            "all_gate_consistency_checks_passed": bool(total) and consistency_pass == total,
            "all_records_directly_recommendable": bool(total) and direct == total,
        },
    }


def build_evolution_observations(gate_report: dict[str, Any]) -> dict[str, Any]:
    observations: list[dict[str, Any]] = []
    source_id = str(gate_report.get("gate_id", ""))

    if gate_report.get("overall_status") in {"FAIL", "BLOCKED"} and not gate_report.get("records"):
        observations.append(_observation(
            "",
            "boundary_block",
            [f"Cross-module gate status is {gate_report.get('overall_status')}.", *[str(x) for x in gate_report.get("handoff_errors", [])]],
            ["Resolve the reported boundary or handoff errors before drawing conclusions about interface quality."],
            source_id,
        ))

    for record in gate_report.get("records", []):
        capability_id = str(record.get("capability_id", ""))
        gate_status = str(record.get("gate_status", ""))
        if gate_status in {"FAIL", "BLOCKED"}:
            observations.append(_observation(
                capability_id,
                "boundary_block",
                [str(reason) for reason in record.get("reasons", [])],
                ["Repair provenance, schema, immutable-source, or expectation conflicts before treating this as an interface-engine defect."],
                source_id,
            ))

        recommendation = record.get("recommendation")
        if not isinstance(recommendation, dict):
            continue
        selected = recommendation.get("recommended_interface", {})
        rec_status = selected.get("recommendation_status")
        evidence = recommendation.get("evidence", {})
        unknowns = evidence.get("unknowns", [])
        conflicts = evidence.get("conflicts", [])
        if unknowns:
            observations.append(_observation(
                capability_id,
                "evidence_gap",
                [f"Critical or relevant unknown: {path}" for path in unknowns],
                ["Improve source evidence for the listed paths; do not guess missing capability facts."],
                source_id,
            ))
        if conflicts:
            observations.append(_observation(
                capability_id,
                "evidence_conflict",
                [str(item) for item in conflicts],
                ["Resolve the conflicting source/test evidence and preserve both sides until resolution."],
                source_id,
            ))
        if rec_status == "no_safe_match":
            observations.append(_observation(
                capability_id,
                "no_safe_match",
                [str(reason) for reason in selected.get("why_this_interface", [])],
                ["Check whether the interface-pattern registry lacks a genuinely suitable safe pattern before adding one."],
                source_id,
            ))
        if rec_status == "conditional":
            conditions = [str(reason) for reason in selected.get("why_this_interface", []) if str(reason).startswith("Condition:")]
            if conditions:
                observations.append(_observation(
                    capability_id,
                    "conditional_dependency",
                    conditions,
                    ["Check whether the missing tool or resource budget is persistent enough to justify an ecosystem improvement."],
                    source_id,
                ))
        confidence = selected.get("confidence")
        if isinstance(confidence, (int, float)) and confidence < 0.6:
            observations.append(_observation(
                capability_id,
                "low_confidence",
                [f"Recommendation confidence is {confidence}."],
                ["Inspect score separation and source confidence before changing interface policy."],
                source_id,
            ))
        trace = record.get("score_trace")
        if isinstance(trace, dict):
            ranked = trace.get("ranked_patterns", [])
            if len(ranked) >= 2:
                margin = float(ranked[0].get("score", 0)) - float(ranked[1].get("score", 0))
                if 0 <= margin < 5:
                    observations.append(_observation(
                        capability_id,
                        "weak_differentiation",
                        [f"Top two deterministic interface scores differ by only {round(margin, 3)} points."],
                        ["Review whether an additional stable discriminating factor is missing; do not add arbitrary weights solely to force a winner."],
                        source_id,
                    ))

    batch_core = {"source_gate_id": source_id, "observation_ids": [item["observation_id"] for item in observations]}
    return {
        "observation_version": OBSERVATION_VERSION,
        "batch_id": stable_id("axm.hii.evolution-observation-batch", batch_core),
        "producer": {"module_id": "axm.human-interface-intelligence", "authority": "advisory_only"},
        "consumer_role": "grounded_ecosystem_improvement_analysis",
        "source_gate_id": source_id,
        "governance": {
            "advisory_only": True,
            "automatic_canon": False,
            "automatic_code_change": False,
            "source_evidence_required": True,
        },
        "observations": observations,
    }
