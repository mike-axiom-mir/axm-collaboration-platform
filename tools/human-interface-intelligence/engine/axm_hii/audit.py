from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .context import assess_context
from .assurance import build_recommendation_assurance
from .gate import MODULE_VERSION, run_cross_module_gate
from .handoff import validate_handoff_shape
from .health import build_evolution_observations, build_health_report
from .paired import run_paired_gate
from .receipts import build_decision_receipt
from .util import stable_id
from .version import MODULE_ID

AUDIT_VERSION = "0.2.0"


def audit_handoff(
    batch: dict[str, Any],
    *,
    anchor_path: str | Path | None = None,
    generated_at: str | None = None,
    strict_provenance: bool = False,
) -> dict[str, Any]:
    timestamp = generated_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    shape_errors = validate_handoff_shape(batch)
    context_assessments = []
    for item in batch.get("records", []) if isinstance(batch.get("records"), list) else []:
        context_assessments.append({
            "item_id": item.get("item_id", ""),
            "capability_id": item.get("capability", {}).get("capability_id", "") if isinstance(item.get("capability"), dict) else "",
            "assessment": assess_context(item.get("context")),
        })

    if anchor_path is not None:
        paired = run_paired_gate(
            batch,
            anchor_path,
            generated_at=timestamp,
            strict_provenance=strict_provenance,
            include_trace=True,
        )
        gate_report = paired.get("cross_module_report")
        boundary = paired
    else:
        gate_report = run_cross_module_gate(
            batch,
            generated_at=timestamp,
            strict_provenance=strict_provenance,
            include_trace=True,
        )
        boundary = None

    receipts: list[dict[str, Any]] = []
    assurance_reports: list[dict[str, Any]] = []
    if isinstance(gate_report, dict):
        item_by_id = {str(item.get("item_id", "")): item for item in batch.get("records", [])}
        for record in gate_report.get("records", []):
            recommendation = record.get("recommendation")
            item = item_by_id.get(str(record.get("item_id", "")))
            if isinstance(recommendation, dict) and isinstance(item, dict) and isinstance(item.get("capability"), dict) and isinstance(item.get("context"), dict):
                receipts.append(build_decision_receipt(
                    item["capability"], item["context"], recommendation, module_version=MODULE_VERSION
                ))
                assurance_reports.append(build_recommendation_assurance(
                    item["capability"], item["context"], recommendation
                ))
        health = build_health_report(gate_report)
        observations = build_evolution_observations(gate_report)
        gate_status = gate_report.get("overall_status", "")
    else:
        health = {
            "health_report_version": "0.1.0",
            "source_gate_id": "",
            "source_gate_status": boundary.get("overall_status", "") if isinstance(boundary, dict) else "",
            "total_records": 0,
            "gate_status_counts": {},
            "recommendation_status_counts": {},
            "pattern_usage": {},
            "most_common_unknowns": [],
            "most_common_conflicts": [],
            "low_confidence_recommendations": [],
            "intake_readiness": {
                "consistency_pass_count": 0,
                "direct_recommendation_count": 0,
                "conditional_recommendation_count": 0,
                "blocked_recommendation_count": 0,
                "unprocessed_or_failed_count": len(batch.get("records", [])),
                "all_gate_consistency_checks_passed": False,
                "all_records_directly_recommendable": False,
            },
        }
        observations = {
            "observation_version": "0.1.0",
            "batch_id": stable_id("axm.hii.evolution-observation-batch", {"boundary": boundary.get("paired_gate_id", "") if isinstance(boundary, dict) else ""}),
            "producer": {"module_id": MODULE_ID, "authority": "advisory_only"},
            "consumer_role": "grounded_ecosystem_improvement_analysis",
            "source_gate_id": "",
            "governance": {"advisory_only": True, "automatic_canon": False, "automatic_code_change": False, "source_evidence_required": True},
            "observations": [{
                "observation_id": stable_id("axm.hii.evolution-observation", {"kind": "boundary_block", "timestamp": timestamp}),
                "capability_id": "",
                "kind": "boundary_block",
                "severity": "blocking",
                "facts": [str(boundary.get("reason", "Paired boundary did not produce a cross-module gate report."))] if isinstance(boundary, dict) else ["No gate report was produced."],
                "inferences": [],
                "suggested_investigations": ["Resolve the paired boundary before interpreting capability-to-interface results."],
                "source_reference": boundary.get("paired_gate_id", "") if isinstance(boundary, dict) else "",
            }],
        }
        gate_status = boundary.get("overall_status", "") if isinstance(boundary, dict) else ""

    core = {
        "handoff_id": batch.get("handoff_id", ""),
        "gate_status": gate_status,
        "receipt_ids": [item["receipt_id"] for item in receipts],
        "shape_errors": shape_errors,
    }
    return {
        "audit_version": AUDIT_VERSION,
        "audit_id": stable_id("axm.hii.intake-audit", core),
        "module_id": MODULE_ID,
        "module_version": MODULE_VERSION,
        "generated_at": timestamp,
        "handoff_shape_errors": shape_errors,
        "context_assessments": context_assessments,
        "paired_boundary": boundary,
        "cross_module_gate": gate_report,
        "decision_receipts": receipts,
        "recommendation_assurance": assurance_reports,
        "health_report": health,
        "evolution_observations": observations,
    }
