from __future__ import annotations

from typing import Any

from .receipts import compare_receipts
from .util import stable_id

DRIFT_VERSION = "0.1.0"


def classify_decision_drift(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    comparison = compare_receipts(before, after)
    changed = {item["field"] for item in comparison["differences"]}
    causes: list[str] = []
    if "capability_hash" in changed:
        causes.append("capability_input_changed")
    if "context_hash" in changed:
        causes.append("recommendation_context_changed")
    if "registry_fingerprint" in changed:
        causes.append("interface_registry_changed")
    if "engine_version" in changed or "engine_id" in changed:
        causes.append("engine_changed")
    if "contract_id" in changed or "contract_version" in changed:
        causes.append("contract_boundary_changed")

    decision_changed = bool({"recommendation_core_hash", "selected_interface_pattern_id", "recommendation_status"} & changed)
    if not comparison["match"] and not causes:
        causes.append("output_or_receipt_metadata_changed")

    core = {
        "before": before.get("receipt_id", ""),
        "after": after.get("receipt_id", ""),
        "changed": sorted(changed),
    }
    return {
        "drift_version": DRIFT_VERSION,
        "drift_id": stable_id("axm.hii.decision-drift", core),
        "before_receipt_id": before.get("receipt_id", ""),
        "after_receipt_id": after.get("receipt_id", ""),
        "exact_match": comparison["match"],
        "decision_changed": decision_changed,
        "candidate_change_causes": causes,
        "differences": comparison["differences"],
        "interpretation": "Candidate causes identify changed decision inputs/boundaries; they do not prove causal sufficiency when multiple fields changed together.",
    }
