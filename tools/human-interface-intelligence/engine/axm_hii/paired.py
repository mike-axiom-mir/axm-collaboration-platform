"""Anchor-aware paired merge gate for Module One and Module Two."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .anchor import evaluate_anchor
from .gate import run_cross_module_gate
from .util import stable_id

PAIRED_GATE_VERSION = "0.3.0"


def run_paired_gate(
    batch: dict[str, Any],
    anchor_path: str | Path,
    *,
    generated_at: str | None = None,
    strict_provenance: bool = True,
    include_trace: bool = True,
) -> dict[str, Any]:
    """Run the anchor gate first and only execute recommendations after it passes.

    This ordering prevents Module Two from consuming records under a contract
    identity that has not been reconciled.
    """
    timestamp = generated_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    anchor_report = evaluate_anchor(anchor_path, generated_at=timestamp)
    if anchor_report.get("strict_merge_status") != "PASS":
        core = {
            "anchor_report_id": anchor_report.get("report_id"),
            "handoff_id": batch.get("handoff_id"),
            "status": "BLOCKED",
        }
        return {
            "paired_gate_version": PAIRED_GATE_VERSION,
            "paired_gate_id": stable_id("axm.hii.paired-gate", core),
            "generated_at": timestamp,
            "overall_status": "BLOCKED",
            "recommendation_execution_state": "NOT_RUN",
            "reason": "The Module One stable anchor did not pass the strict compatibility gate. Capability records were not consumed and recommendations were not generated.",
            "anchor_report": anchor_report,
            "cross_module_report": None,
        }

    cross_module_report = run_cross_module_gate(
        batch,
        generated_at=timestamp,
        strict_provenance=strict_provenance,
        include_trace=include_trace,
    )
    core = {
        "anchor_report_id": anchor_report.get("report_id"),
        "cross_module_gate_id": cross_module_report.get("gate_id"),
        "status": cross_module_report.get("overall_status"),
    }
    return {
        "paired_gate_version": PAIRED_GATE_VERSION,
        "paired_gate_id": stable_id("axm.hii.paired-gate", core),
        "generated_at": timestamp,
        "overall_status": cross_module_report.get("overall_status"),
        "recommendation_execution_state": "RUN",
        "reason": "The stable anchor passed before Module Two consumed the handoff batch.",
        "anchor_report": anchor_report,
        "cross_module_report": cross_module_report,
    }
