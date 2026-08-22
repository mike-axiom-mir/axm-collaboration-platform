from __future__ import annotations

from typing import Any

from .util import stable_id

SIGNAL_PACKET_VERSION = "0.1.0"


def _signal(kind: str, severity: str, facts: list[str], source: str, capability_id: str = "") -> dict[str, Any]:
    core = {"kind": kind, "severity": severity, "facts": facts, "source": source, "capability_id": capability_id}
    return {
        "signal_id": stable_id("axm.hii.intake-signal", core),
        "kind": kind,
        "severity": severity,
        "capability_id": capability_id,
        "facts": facts,
        "inferences": [],
        "source_reference": source,
    }


def build_quarantine_signal_packet(audit: dict[str, Any]) -> dict[str, Any]:
    """Preserve failed/blocked intake information as signal without treating it as executable truth."""
    signals: list[dict[str, Any]] = []
    audit_id = str(audit.get("audit_id", ""))

    for error in audit.get("handoff_shape_errors", []):
        signals.append(_signal("handoff_shape_error", "blocking", [str(error)], audit_id))

    for item in audit.get("context_assessments", []):
        assessment = item.get("assessment", {}) if isinstance(item, dict) else {}
        if not assessment.get("valid", False):
            facts = [f"{err.get('path', '')}: {err.get('message', '')}" for err in assessment.get("errors", [])]
            signals.append(_signal("context_preflight_failure", "blocking", facts, audit_id, str(item.get("capability_id", ""))))

    boundary = audit.get("paired_boundary")
    if isinstance(boundary, dict) and boundary.get("overall_status") in {"FAIL", "BLOCKED", "CONFLICTED"}:
        reason = str(boundary.get("reason", "Paired boundary blocked before record consumption."))
        signals.append(_signal("paired_boundary_block", "blocking", [reason], str(boundary.get("paired_gate_id", audit_id))))

    gate = audit.get("cross_module_gate")
    if isinstance(gate, dict):
        for record in gate.get("records", []):
            if record.get("gate_status") in {"FAIL", "BLOCKED"}:
                signals.append(_signal(
                    "record_gate_failure",
                    "blocking",
                    [str(value) for value in record.get("reasons", [])] or [f"Gate status: {record.get('gate_status')}"],
                    str(gate.get("gate_id", audit_id)),
                    str(record.get("capability_id", "")),
                ))

    evolution = audit.get("evolution_observations", {})
    for observation in evolution.get("observations", []) if isinstance(evolution, dict) else []:
        signals.append(_signal(
            f"evolution_{observation.get('kind', 'observation')}",
            str(observation.get("severity", "info")),
            [str(value) for value in observation.get("facts", [])],
            str(observation.get("source_reference", audit_id)),
            str(observation.get("capability_id", "")),
        ))

    dedup: dict[str, dict[str, Any]] = {item["signal_id"]: item for item in signals}
    signals = [dedup[key] for key in sorted(dedup)]
    core = {"audit_id": audit_id, "signal_ids": [item["signal_id"] for item in signals]}
    return {
        "signal_packet_version": SIGNAL_PACKET_VERSION,
        "signal_packet_id": stable_id("axm.hii.quarantine-signal-packet", core),
        "source_audit_id": audit_id,
        "producer": {"module_id": "axm.human-interface-intelligence", "authority": "signal_only"},
        "disposition": "retain_as_signal_even_when_execution_is_blocked",
        "governance": {
            "execution_authority": False,
            "automatic_canon": False,
            "automatic_source_mutation": False,
            "automatic_contract_change": False,
            "may_inform_module_three": True,
            "failed_records_are_not_promoted_to_facts": True,
        },
        "signal_count": len(signals),
        "signals": signals,
    }


def build_shadow_analysis_signal_packet(
    robustness_reports: list[dict[str, Any]],
    coverage_report: dict[str, Any] | None,
    *,
    source_audit_id: str,
    assurance_reports: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Convert bounded synthetic analysis into explicit non-factual research signals for Module Three."""
    signals: list[dict[str, Any]] = []

    stable_count = 0
    stable_blocked_count = 0
    for report in robustness_reports:
        classification = str(report.get("classification", ""))
        capability_id = str(report.get("capability_id", ""))
        if classification == "stable_under_bounded_probes":
            stable_count += 1
            continue
        if classification == "stable_blocked_under_bounded_probes":
            stable_blocked_count += 1
            continue
        if classification in {"pattern_sensitive", "status_sensitive"}:
            changed = [
                str(probe.get("probe_id", ""))
                for probe in report.get("probes", [])
                if probe.get("pattern_changed") or probe.get("status_changed")
            ]
            item = _signal(
                "synthetic_recommendation_sensitivity",
                "moderate" if classification == "pattern_sensitive" else "low",
                [
                    f"Bounded synthetic probe classification: {classification}.",
                    f"Changed probes: {', '.join(changed) if changed else 'none listed'}.",
                    f"Sensitivity ratio: {report.get('sensitivity_ratio', 0.0)}.",
                ],
                str(report.get("robustness_id", source_audit_id)),
                capability_id,
            )
            item["inferences"] = ["The selected interface may depend materially on the probed context dimension; investigate before changing policy."]
            signals.append(item)

    if robustness_reports:
        item = _signal(
            "bounded_stability_summary",
            "info",
            [
                f"{stable_count} of {len(robustness_reports)} non-blocked recommendations kept the same pattern and status under all generated bounded probes.",
                f"{stable_blocked_count} blocked outcomes also remained blocked under all generated bounded probes and are reported separately."
            ],
            source_audit_id,
        )
        item["inferences"] = ["This is limited local stability evidence, not proof of global robustness."]
        signals.append(item)


    for report in assurance_reports or []:
        assurance_status = str(report.get("overall_status", ""))
        if assurance_status not in {"REVIEW", "BLOCKED"}:
            continue
        review_checks = [
            str(item.get("check_id", ""))
            for item in report.get("checks", [])
            if item.get("status") in {"REVIEW", "BLOCKED"}
        ]
        item = _signal(
            "recommendation_assurance_" + assurance_status.lower(),
            "high" if assurance_status == "BLOCKED" else "moderate",
            [
                f"Assurance status: {assurance_status}.",
                f"Checks requiring attention: {', '.join(review_checks) if review_checks else 'none listed'}.",
            ],
            str(report.get("assurance_id", source_audit_id)),
            str(report.get("capability_id", "")),
        )
        item["inferences"] = [
            "The recommendation may still be structurally valid, but implementation should resolve the listed assurance findings first."
        ]
        signals.append(item)

    if isinstance(coverage_report, dict):
        unused = list(coverage_report.get("patterns_never_selected_in_batch", []))
        unseen = list(coverage_report.get("patterns_never_seen_in_top_three", []))
        item = _signal(
            "batch_registry_coverage_summary",
            "info",
            [
                f"Registry contains {coverage_report.get('registry_pattern_count', 0)} patterns.",
                f"Patterns never selected in this batch: {len(unused)}.",
                f"Patterns never appearing in the top three: {len(unseen)}.",
            ],
            str(coverage_report.get("coverage_id", source_audit_id)),
        )
        item["inferences"] = ["Low observed use may justify broader fixture research, but is not evidence that an interface pattern should be removed."]
        signals.append(item)

    dedup = {item["signal_id"]: item for item in signals}
    signals = [dedup[key] for key in sorted(dedup)]
    core = {"source_audit_id": source_audit_id, "signal_ids": [item["signal_id"] for item in signals]}
    return {
        "signal_packet_version": SIGNAL_PACKET_VERSION,
        "signal_packet_id": stable_id("axm.hii.shadow-analysis-signal-packet", core),
        "source_audit_id": source_audit_id,
        "producer": {"module_id": "axm.human-interface-intelligence", "authority": "signal_only"},
        "disposition": "retain_as_experimental_signal_only",
        "governance": {
            "execution_authority": False,
            "automatic_canon": False,
            "automatic_source_mutation": False,
            "automatic_contract_change": False,
            "may_inform_module_three": True,
            "synthetic_counterfactuals_are_not_observed_facts": True,
        },
        "signal_count": len(signals),
        "signals": signals,
    }
