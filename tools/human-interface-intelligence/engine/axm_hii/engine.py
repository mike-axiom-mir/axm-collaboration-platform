from __future__ import annotations

import copy
from datetime import datetime, timezone
from typing import Any

from .beginner import plan_advanced_layer, plan_beginner_layer
from .context import assess_context
from .contract_validation import ensure_valid_capability
from .evidence import evidence_report
from .registry import COST_ORDER, PatternRegistry
from .scoring import rank_patterns
from .trace import registry_fingerprint
from .util import stable_id
from .version import CONTRACT_ID, CONTRACT_VERSION, MODULE_VERSION


def _critical_unknowns(capability: dict[str, Any]) -> list[str]:
    critical_prefixes = {
        "risk_profile.risk_level",
        "risk_profile.reversibility",
        "input_profile.input_types",
        "output_profile.output_types",
        "task_profile.supported_task_types",
    }
    found: list[str] = []
    for annotation in capability.get("evidence_annotations", []):
        if annotation["state"] == "UNKNOWN":
            path = annotation["path"].lstrip("/").replace("/", ".")
            if path in critical_prefixes:
                found.append(path)
    if not capability["task_profile"]["supported_task_types"]:
        found.append("task_profile.supported_task_types")
    if not capability["input_profile"]["input_types"]:
        found.append("input_profile.input_types")
    if not capability["output_profile"]["output_types"]:
        found.append("output_profile.output_types")
    if capability["risk_profile"]["risk_level"] == "unknown":
        found.append("risk_profile.risk_level")
    if capability["risk_profile"]["reversibility"] == "unknown":
        found.append("risk_profile.reversibility")
    return sorted(set(found))


def _conflicts(capability: dict[str, Any]) -> list[str]:
    return [
        annotation["path"].lstrip("/").replace("/", ".")
        for annotation in capability.get("evidence_annotations", [])
        if annotation["state"] == "CONFLICTED"
    ]


def _controls(pattern: dict[str, Any], capability: dict[str, Any]) -> tuple[list[str], list[str], list[str]]:
    safety_controls: list[str] = []
    if capability["risk_profile"].get("human_confirmation_required"):
        safety_controls.append("explicit_confirmation")
    if capability["risk_profile"].get("safe_preview_recommended"):
        safety_controls.append("non_destructive_preview")
    required = list(dict.fromkeys(
        list(capability["interface_requirements"].get("required_interface_features", []))
        + safety_controls
        + list(pattern.get("features", []))[:5]
    ))
    optional = list(dict.fromkeys(
        list(capability["interface_requirements"].get("optional_interface_features", []))
        + list(pattern.get("features", []))[5:]
    ))
    hidden = list(capability["learning_profile"].get("advanced_operations", []))
    return required, optional, hidden


def _fit_confidence(selected_score: float, gap: float, source_confidence: float) -> float:
    """Bound confidence by absolute fit, score separation, and source confidence."""
    absolute_fit = min(0.25, max(0.0, selected_score) / 400.0)
    separation = min(0.25, max(0.0, gap) / 100.0)
    source = 0.20 * max(0.0, min(1.0, float(source_confidence)))
    return max(0.05, min(0.95, 0.20 + absolute_fit + separation + source))


def recommend_interface(
    capability: dict[str, Any],
    context: dict[str, Any],
    *,
    registry: PatternRegistry | None = None,
    generated_at: str | None = None,
) -> dict[str, Any]:
    # Snapshot caller-owned data first so later external mutation cannot rewrite
    # an already-issued recommendation or invalidate its stable identity.
    capability_snapshot = copy.deepcopy(capability)
    context_snapshot = copy.deepcopy(context)

    ensure_valid_capability(capability_snapshot)
    context_assessment = assess_context(context_snapshot)
    if not context_assessment["valid"]:
        details = "; ".join(f"{item['path']}: {item['message']}" for item in context_assessment["errors"])
        raise ValueError(f"Invalid recommendation context; no defaults were applied. {details}")

    registry = registry or PatternRegistry()
    evidence = evidence_report(capability_snapshot)
    unknowns = _critical_unknowns(capability_snapshot)
    conflicts = _conflicts(capability_snapshot)
    ranked = rank_patterns(capability_snapshot, context_snapshot, registry)
    eligible_ranked = [item for item in ranked if item.eligible]

    block_reason = ""
    selected_conditions: list[str] = []
    if conflicts:
        status = "no_safe_match"
        selected = None
        block_reason = "A safe recommendation is blocked because credible capability evidence conflicts."
    elif unknowns:
        status = "insufficient_information"
        selected = None
        block_reason = "A safe recommendation is blocked until critical evidence is resolved."
    elif not eligible_ranked:
        status = "no_safe_match"
        selected = None
        blockers = sorted({reason for item in ranked for reason in item.eligibility_blockers})
        suffix = f" Hard constraints: {'; '.join(blockers)}" if blockers else ""
        block_reason = "No registered interface pattern is eligible for this capability and context." + suffix
    elif eligible_ranked[0].score < 0:
        status = "no_safe_match"
        selected = None
        block_reason = "No eligible interface pattern achieved a non-negative deterministic fit for this context."
    else:
        selected = eligible_ranked[0]
        capability_skill = capability_snapshot["learning_profile"]["minimum_skill_level"]
        risk = capability_snapshot["risk_profile"]["risk_level"]
        status = (
            "conditional"
            if risk in {"moderate", "high", "critical"}
            or capability_skill in {"intermediate", "advanced", "specialist"}
            and context_snapshot["user_skill_level"] in {"beginner", "basic"}
            else "recommended"
        )

        available_tools = {str(value).strip().lower() for value in context_snapshot.get("available_tools", [])}
        required_tool_any = {str(value).strip().lower() for value in selected.pattern.get("required_tool_any", [])}
        if required_tool_any and not (available_tools & required_tool_any):
            status = "conditional"
            selected_conditions.append(
                f"A supporting tool is still required; provide one of: {', '.join(sorted(required_tool_any))}."
            )

        budget_name = str(context_snapshot.get("resource_budget", {}).get("compute", "unknown")).strip().lower()
        overhead_name = str(selected.pattern.get("compute_overhead", "unknown")).strip().lower()
        budget = COST_ORDER.get(budget_name, 99)
        overhead = COST_ORDER.get(overhead_name, 99)
        if budget != 99 and overhead != 99 and overhead > budget:
            status = "conditional"
            selected_conditions.append(
                f"Interface compute overhead '{overhead_name}' exceeds the stated '{budget_name}' budget."
            )

        unsupported_accessibility = context_assessment.get("unsupported_accessibility_needs", [])
        if unsupported_accessibility:
            status = "conditional"
            selected_conditions.append(
                "Manual accessibility review is required for unsupported needs: "
                + ", ".join(unsupported_accessibility)
                + "."
            )

        if len(eligible_ranked) > 1:
            gap = selected.score - eligible_ranked[1].score
            normalized_gap = gap / max(abs(selected.score), 1.0)
            if gap <= 3 or normalized_gap <= 0.03:
                status = "conditional"
                selected_conditions.append(
                    "The top interface patterns are nearly tied; review the score trace before implementation."
                )

    if selected is None:
        pattern_id = ""
        pattern_name = ""
        pattern_family = ""
        why = [block_reason]
        why_not: list[str] = []
        required_controls: list[str] = []
        optional_controls: list[str] = []
        hidden_controls: list[str] = []
        confidence = 0.0
        progressive = ["Do not expose execution controls while the recommendation is blocked."]
        preview_flow = ["Show unresolved unknowns, conflicts, or hard constraints instead of a fake preview."]
        recovery_flow = ["Correct the source record or context, revalidate it, and rerun deterministic selection."]
    else:
        pattern = selected.pattern
        pattern_id = pattern["interface_pattern_id"]
        pattern_name = pattern["interface_name"]
        pattern_family = pattern["interface_family"]
        why = list(selected.reasons)[:10] + [f"Condition: {condition}" for condition in selected_conditions]
        required_features = set(capability_snapshot["interface_requirements"].get("required_interface_features", []))
        missing_features = sorted(required_features - set(pattern.get("features", [])))
        if missing_features:
            why.append(
                "The base pattern must be augmented with required controls: " + ", ".join(missing_features) + "."
            )
        why_not = []
        for alternative in eligible_ranked[1:4]:
            reason = alternative.penalties[0] if alternative.penalties else "Lower deterministic fit score."
            why_not.append(f"{alternative.pattern['interface_name']}: {reason}")
        required_controls, optional_controls, hidden_controls = _controls(pattern, capability_snapshot)
        gap = selected.score - eligible_ranked[1].score if len(eligible_ranked) > 1 else selected.score
        source_confidence = capability_snapshot["source_reference"].get("confidence", 0.0)
        confidence = _fit_confidence(selected.score, gap, source_confidence)
        progressive = [
            "Start with the declared beginner-safe operation and necessary controls only.",
            "Show a plain-language summary of hidden advanced controls.",
            "Reveal optional controls when the user asks or the task requires them.",
            "Require explicit user choice before entering advanced mode.",
        ]
        preview_flow = []
        if capability_snapshot["risk_profile"]["safe_preview_recommended"] or capability_snapshot["output_profile"]["preview_available"] == "KNOWN":
            preview_flow.append("Generate a non-destructive preview or consequence summary.")
        if capability_snapshot["risk_profile"]["human_confirmation_required"]:
            preview_flow.append("Require explicit confirmation after preview and before execution.")
        preview_flow.append("Show applied result and proof/status after execution.")
        recovery_flow = [
            "Validate inputs before execution.",
            "Keep cancel available until the commit point.",
            "Expose undo, restore, or a clear no-recovery warning according to declared reversibility.",
            "Record failure details without claiming success.",
        ]

    beginner = plan_beginner_layer(capability_snapshot, context_snapshot, status)
    advanced = plan_advanced_layer(capability_snapshot, status)

    alternatives = []
    for item in eligible_ranked[:4]:
        if item.pattern["interface_pattern_id"] == pattern_id:
            continue
        alternatives.append({
            "interface_pattern_id": item.pattern["interface_pattern_id"],
            "interface_name": item.pattern["interface_name"],
            "score": item.score,
            "tradeoff": item.penalties[0] if item.penalties else "Lower total fit than selected pattern.",
        })
        if len(alternatives) == 3:
            break

    selected_cost = {} if selected is None else {
        "attention": selected.pattern["attention_cost"],
        "interaction": selected.pattern["interaction_cost"],
        "minimum_skill": selected.pattern["minimum_user_skill"],
        "deterministic_score": selected.score,
        "compute_overhead": selected.pattern.get("compute_overhead", "unknown"),
        "required_tool_any": selected.pattern.get("required_tool_any", []),
    }
    costs_avoided = []
    if selected is not None:
        for item in eligible_ranked[1:6]:
            if item.pattern["attention_cost"] in {"high", "very_high"} and selected.pattern["attention_cost"] not in {"high", "very_high"}:
                costs_avoided.append(f"Avoided {item.pattern['interface_name']}'s higher attention cost.")
            if not item.pattern["beginner_suitable"] and selected.pattern["beginner_suitable"]:
                costs_avoided.append(f"Avoided {item.pattern['interface_name']}'s unnecessary skill burden.")
        costs_avoided = list(dict.fromkeys(costs_avoided))[:4]

    evidence["unknowns"] = sorted(set(evidence["unknowns"] + unknowns))
    fingerprint = registry_fingerprint(registry)
    recommendation_core = {
        "module_version": MODULE_VERSION,
        "contract_version": CONTRACT_VERSION,
        "capability": capability_snapshot,
        "context": context_snapshot,
        "registry_fingerprint": fingerprint,
        "pattern_id": pattern_id,
        "status": status,
    }
    return {
        "contract_id": CONTRACT_ID,
        "contract_version": CONTRACT_VERSION,
        "record_kind": "interface_recommendation",
        "recommendation_id": stable_id("axm.hii.recommendation", recommendation_core),
        "capability_id": capability_snapshot["capability_id"],
        "generated_at": generated_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "context": context_snapshot,
        "recommended_interface": {
            "interface_pattern_id": pattern_id,
            "interface_name": pattern_name,
            "interface_family": pattern_family,
            "confidence": round(confidence, 4),
            "recommendation_status": status,
            "why_this_interface": why,
            "why_not_other_interfaces": why_not,
            "required_controls": required_controls,
            "optional_controls": optional_controls,
            "hidden_advanced_controls": hidden_controls,
            "progressive_disclosure_plan": progressive,
            "preview_and_confirmation_flow": preview_flow,
            "error_recovery_flow": recovery_flow,
        },
        "beginner_layer": beginner,
        "advanced_layer": advanced,
        "cost_comparison": {
            "selected_interface_cost": selected_cost,
            "alternative_interfaces": alternatives,
            "unnecessary_costs_avoided": costs_avoided,
        },
        "evidence": evidence,
    }
