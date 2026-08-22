from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .engine import recommend_interface
from .context import assess_context
from .handoff import immutable_source_check, provenance_check, validate_handoff_shape
from .trace import build_score_trace, registry_fingerprint
from .contract_validation import validate_contract_record
from .version import CONTRACT_ID, CONTRACT_VERSION, MODULE_ID, MODULE_VERSION
from .util import stable_id

GATE_REPORT_VERSION = "0.4.0"


def _validate(instance: dict[str, Any], kind: str) -> dict[str, Any]:
    return validate_contract_record(instance, kind)


def _expected_differences(recommendation: dict[str, Any], expected: dict[str, Any]) -> list[dict[str, Any]]:
    differences: list[dict[str, Any]] = []
    selected = recommendation["recommended_interface"]
    checks = {
        "interface_pattern_id": selected["interface_pattern_id"],
        "recommendation_status": selected["recommendation_status"],
    }
    for field, actual in checks.items():
        if field in expected and expected[field] != actual:
            differences.append({"field": field, "expected": expected[field], "actual": actual})

    contains_checks = [
        ("beginner_allowed_contains", recommendation["beginner_layer"]["allowed_operations"]),
        ("beginner_restricted_contains", recommendation["beginner_layer"]["restricted_operations"]),
        ("expected_unknowns", recommendation["evidence"]["unknowns"]),
    ]
    for field, actual_values in contains_checks:
        for required in expected.get(field, []):
            if required not in actual_values:
                differences.append({"field": field, "expected_contains": required, "actual": actual_values})

    reason_text = " ".join(selected["why_this_interface"])
    for fragment in expected.get("reason_fragments", []):
        if fragment not in reason_text:
            differences.append({"field": "reason_fragments", "expected_contains": fragment, "actual": reason_text})
    return differences


def _record_gate(
    item: dict[str, Any],
    *,
    generated_at: str,
    strict_provenance: bool,
    include_trace: bool,
) -> dict[str, Any]:
    item_id = str(item.get("item_id", ""))
    capability = item.get("capability")
    context = item.get("context")
    expected = item.get("expected")
    reasons: list[str] = []
    context_assessment = assess_context(context)

    if not isinstance(capability, dict):
        return {
            "item_id": item_id,
            "capability_id": "",
            "gate_status": "FAIL",
            "reasons": ["capability must be an object"],
            "capability_validation": {"valid": False, "errors": [{"path": "/capability", "message": "not an object"}]},
            "recommendation_validation": {"valid": False, "errors": []},
            "provenance": {"status": "MISSING", "reason": "No capability record supplied."},
            "immutable_source": {"status": "NOT_RUN", "mismatches": []},
            "expectation_differences": [],
            "recommendation": None,
            "score_trace": None,
        }
    capability_id = str(capability.get("capability_id", ""))
    capability_validation = _validate(capability, "capability")
    provenance = provenance_check(capability, item.get("source_payload"))
    immutable = immutable_source_check(capability, item.get("immutable_source"))

    if not capability_validation["valid"]:
        reasons.append("Capability record failed the shared contract schema.")
        return {
            "item_id": item_id,
            "capability_id": capability_id,
            "gate_status": "FAIL",
            "reasons": reasons,
            "capability_validation": capability_validation,
            "recommendation_validation": {"valid": False, "errors": []},
            "provenance": provenance,
            "immutable_source": immutable,
            "expectation_differences": [],
            "recommendation": None,
            "score_trace": None,
        }

    if immutable["status"] == "CONFLICTED":
        reasons.append("Source-of-truth identity changed during the handoff.")
    if provenance["status"] == "CONFLICTED":
        reasons.append("Source payload hash conflicts with the declared source hash.")
    if strict_provenance and provenance["status"] != "VERIFIED":
        reasons.append("Strict provenance requires a supplied source payload with a verified hash.")
    if reasons:
        return {
            "item_id": item_id,
            "capability_id": capability_id,
            "gate_status": "BLOCKED",
            "reasons": reasons,
            "capability_validation": capability_validation,
            "recommendation_validation": {"valid": False, "errors": []},
            "provenance": provenance,
            "immutable_source": immutable,
            "expectation_differences": [],
            "recommendation": None,
            "score_trace": build_score_trace(capability, context, limit=5) if include_trace and context_assessment["valid"] else None,
        }

    if not context_assessment["valid"]:
        return {
            "item_id": item_id,
            "capability_id": capability_id,
            "gate_status": "FAIL",
            "reasons": ["Context failed deterministic preflight; no defaults or silent rewrites were applied."],
            "capability_validation": capability_validation,
            "recommendation_validation": {"valid": False, "errors": context_assessment["errors"]},
            "provenance": provenance,
            "immutable_source": immutable,
            "expectation_differences": [],
            "recommendation": None,
            "score_trace": None,
        }

    try:
        recommendation = recommend_interface(capability, context, generated_at=generated_at)
    except (KeyError, TypeError, ValueError) as exc:
        return {
            "item_id": item_id,
            "capability_id": capability_id,
            "gate_status": "FAIL",
            "reasons": [f"Deterministic engine could not consume the supplied context: {exc}"],
            "capability_validation": capability_validation,
            "recommendation_validation": {"valid": False, "errors": [{"path": "/context", "message": str(exc)}]},
            "provenance": provenance,
            "immutable_source": immutable,
            "expectation_differences": [],
            "recommendation": None,
            "score_trace": None,
        }

    recommendation_validation = _validate(recommendation, "recommendation")
    if not recommendation_validation["valid"]:
        reasons.append("Generated recommendation failed the shared recommendation schema.")
    differences: list[dict[str, Any]] = []
    if isinstance(expected, dict):
        differences = _expected_differences(recommendation, expected)
        if differences:
            reasons.append("Recommendation differs from the declared cross-module expectation.")
    else:
        reasons.append("No expected cross-module outcome was supplied, so consistency comparison was not run.")

    if not recommendation_validation["valid"] or differences:
        gate_status = "FAIL"
    elif not isinstance(expected, dict):
        gate_status = "NOT_RUN"
    else:
        gate_status = "PASS"
        reasons.append("Shared record, deterministic recommendation, and expected outcome agree.")

    return {
        "item_id": item_id,
        "capability_id": capability_id,
        "gate_status": gate_status,
        "reasons": reasons,
        "capability_validation": capability_validation,
        "recommendation_validation": recommendation_validation,
        "provenance": provenance,
        "immutable_source": immutable,
        "expectation_differences": differences,
        "recommendation": recommendation,
        "score_trace": build_score_trace(capability, context, limit=5) if include_trace else None,
    }


def run_cross_module_gate(
    batch: dict[str, Any],
    *,
    generated_at: str | None = None,
    strict_provenance: bool = False,
    include_trace: bool = True,
) -> dict[str, Any]:
    timestamp = generated_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    shape_errors = validate_handoff_shape(batch)
    if shape_errors:
        return {
            "report_version": GATE_REPORT_VERSION,
            "gate_id": stable_id("axm.hii.cross-module-gate", {"errors": shape_errors, "generated_at": timestamp}),
            "module_id": MODULE_ID,
            "module_version": MODULE_VERSION,
            "contract_id": batch.get("contract_id", ""),
            "contract_version": batch.get("contract_version", ""),
            "generated_at": timestamp,
            "external_atlas_execution_state": batch.get("producer", {}).get("execution_state", "UNVERIFIED") if isinstance(batch.get("producer"), dict) else "UNVERIFIED",
            "strict_provenance": strict_provenance,
            "registry_fingerprint": registry_fingerprint(),
            "overall_status": "FAIL",
            "handoff_errors": shape_errors,
            "summary": {"total": 0, "PASS": 0, "FAIL": 0, "BLOCKED": 0, "NOT_RUN": 0},
            "records": [],
        }

    records = [
        _record_gate(
            item,
            generated_at=timestamp,
            strict_provenance=strict_provenance,
            include_trace=include_trace,
        )
        for item in batch["records"]
    ]
    counts = {"PASS": 0, "FAIL": 0, "BLOCKED": 0, "NOT_RUN": 0}
    for record in records:
        counts[record["gate_status"]] += 1
    if counts["FAIL"]:
        overall = "FAIL"
    elif counts["BLOCKED"]:
        overall = "BLOCKED"
    elif counts["PASS"]:
        overall = "PASS"
    else:
        overall = "NOT_RUN"

    core = {
        "handoff_id": batch["handoff_id"],
        "generated_at": timestamp,
        "strict_provenance": strict_provenance,
        "statuses": [record["gate_status"] for record in records],
    }
    return {
        "report_version": GATE_REPORT_VERSION,
        "gate_id": stable_id("axm.hii.cross-module-gate", core),
        "module_id": MODULE_ID,
        "module_version": MODULE_VERSION,
        "contract_id": batch["contract_id"],
        "contract_version": batch["contract_version"],
        "generated_at": timestamp,
        "external_atlas_execution_state": batch["producer"]["execution_state"],
        "strict_provenance": strict_provenance,
        "registry_fingerprint": registry_fingerprint(),
        "overall_status": overall,
        "handoff_errors": [],
        "summary": {"total": len(records), **counts},
        "records": records,
    }
