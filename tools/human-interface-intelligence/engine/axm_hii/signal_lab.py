from __future__ import annotations

from typing import Any

from .audit import audit_handoff
from .coverage import build_pattern_coverage
from .robustness import probe_recommendation_stability
from .signals import build_quarantine_signal_packet, build_shadow_analysis_signal_packet
from .util import stable_id
from .ledger import build_ledger_preview

SIGNAL_LAB_VERSION = "0.2.0"


def run_signal_lab(
    batch: dict[str, Any],
    *,
    anchor_path: str | None = None,
    generated_at: str | None = None,
    strict_provenance: bool = False,
) -> dict[str, Any]:
    audit = audit_handoff(
        batch,
        anchor_path=anchor_path,
        generated_at=generated_at,
        strict_provenance=strict_provenance,
    )
    quarantine = build_quarantine_signal_packet(audit)
    gate = audit.get("cross_module_gate")
    robustness: list[dict[str, Any]] = []
    coverage = None

    if isinstance(gate, dict):
        coverage = build_pattern_coverage(gate)
        item_by_id = {str(item.get("item_id", "")): item for item in batch.get("records", [])}
        for record in gate.get("records", []):
            item = item_by_id.get(str(record.get("item_id", "")))
            if not isinstance(item, dict) or not isinstance(record.get("recommendation"), dict):
                continue
            try:
                robustness.append(probe_recommendation_stability(item["capability"], item["context"], generated_at="shadow"))
            except (KeyError, TypeError, ValueError):
                # The authoritative gate already reports malformed/blocked records; shadow analysis must not mask it.
                continue

    shadow_signals = build_shadow_analysis_signal_packet(
        robustness,
        coverage,
        source_audit_id=str(audit.get("audit_id", "")),
        assurance_reports=list(audit.get("recommendation_assurance", [])),
    )
    ledger_preview = build_ledger_preview([quarantine, shadow_signals])
    core = {
        "audit_id": audit.get("audit_id", ""),
        "quarantine_packet_id": quarantine.get("signal_packet_id", ""),
        "shadow_signal_packet_id": shadow_signals.get("signal_packet_id", ""),
        "robustness_ids": [item["robustness_id"] for item in robustness],
        "coverage_id": coverage.get("coverage_id", "") if isinstance(coverage, dict) else "",
    }
    return {
        "signal_lab_version": SIGNAL_LAB_VERSION,
        "signal_lab_id": stable_id("axm.hii.signal-lab", core),
        "mode": "shadow_advisory_only",
        "authoritative_audit": audit,
        "quarantine_signal_packet": quarantine,
        "shadow_signal_packet": shadow_signals,
        "signal_ledger_preview": ledger_preview,
        "robustness_reports": robustness,
        "pattern_coverage": coverage,
        "governance": {
            "authoritative_selection_engine_unchanged": True,
            "shadow_outputs_may_be_wrong": True,
            "shadow_outputs_are_signal_not_canon": True,
            "shadow_outputs_cannot_enable_execution": True,
        },
    }
