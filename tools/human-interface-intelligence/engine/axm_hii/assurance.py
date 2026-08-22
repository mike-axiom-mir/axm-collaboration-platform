from __future__ import annotations

from collections import Counter
from typing import Any

from .constraints import evaluate_pattern_eligibility
from .context import assess_context
from .registry import COST_ORDER, PatternRegistry
from .scoring import rank_patterns
from .util import stable_id

ASSURANCE_VERSION = "0.1.0"
TIME_BUDGET_CAP = {
    "instant": 1,
    "short": 2,
    "medium": 3,
    "long": 5,
    "variable": 99,
    "unknown": 99,
}
VISUAL_HEAVY = {
    "drag_drop_workspace",
    "node_graph_editor",
    "canvas",
    "timeline",
    "layer_editor",
    "map_spatial_interface",
    "live_preview_controls",
}
MOTOR_HEAVY = VISUAL_HEAVY | {"controller_game_style"}


def _check(check_id: str, status: str, facts: list[str], actions: list[str] | None = None) -> dict[str, Any]:
    return {
        "check_id": check_id,
        "status": status,
        "facts": facts,
        "required_actions": actions or [],
    }


def _budget_check(pattern: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    budget = context["resource_budget"]
    comparisons: list[str] = []
    tensions: list[str] = []

    compute = COST_ORDER.get(str(pattern.get("compute_overhead", "unknown")), 99)
    compute_budget = COST_ORDER.get(str(budget.get("compute", "unknown")), 99)
    comparisons.append(f"Compute: pattern={pattern.get('compute_overhead', 'unknown')}, budget={budget.get('compute', 'unknown')}.")
    if compute != 99 and compute_budget != 99 and compute > compute_budget:
        tensions.append("compute overhead exceeds budget")

    attention = COST_ORDER.get(str(pattern.get("attention_cost", "unknown")), 99)
    attention_budget = COST_ORDER.get(str(budget.get("attention", "unknown")), 99)
    comparisons.append(f"Attention: pattern={pattern.get('attention_cost', 'unknown')}, budget={budget.get('attention', 'unknown')}.")
    if attention != 99 and attention_budget != 99 and attention > attention_budget:
        tensions.append("attention cost exceeds budget")

    interaction = COST_ORDER.get(str(pattern.get("interaction_cost", "unknown")), 99)
    complexity_budget = COST_ORDER.get(str(budget.get("complexity", "unknown")), 99)
    comparisons.append(
        "Complexity proxy: pattern interaction_cost="
        f"{pattern.get('interaction_cost', 'unknown')}, budget={budget.get('complexity', 'unknown')}."
    )
    if interaction != 99 and complexity_budget != 99 and interaction > complexity_budget:
        tensions.append("interaction-cost proxy exceeds complexity budget")

    time_cap = TIME_BUDGET_CAP.get(str(budget.get("time", "unknown")), 99)
    comparisons.append(
        "Time proxy: pattern interaction_cost="
        f"{pattern.get('interaction_cost', 'unknown')}, budget={budget.get('time', 'unknown')}."
    )
    if interaction != 99 and time_cap != 99 and interaction > time_cap:
        tensions.append("interaction-cost proxy exceeds time budget")

    if tensions:
        return _check(
            "resource_budget_fit",
            "REVIEW",
            comparisons + ["Tensions: " + "; ".join(tensions) + "."],
            ["Review whether the context budget is realistic or choose a lower-cost interface pattern."],
        )
    return _check("resource_budget_fit", "PASS", comparisons)


def _accessibility_check(pattern_id: str, context_assessment: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    needs = {str(value).strip().lower() for value in context.get("accessibility_needs", [])}
    unsupported = list(context_assessment.get("unsupported_accessibility_needs", []))
    issues: list[str] = []
    if unsupported:
        issues.append("No deterministic rule exists for: " + ", ".join(unsupported))
    if "screen_reader" in needs and pattern_id in VISUAL_HEAVY:
        issues.append("selected pattern is visually dense for screen-reader use without an alternate path")
    if "low_vision" in needs and pattern_id in VISUAL_HEAVY:
        issues.append("selected pattern relies heavily on visual detail")
    if "limited_mobility" in needs and pattern_id in MOTOR_HEAVY:
        issues.append("selected pattern may require continuous or precise motor input")
    if "hearing" in needs and pattern_id == "voice_interaction":
        issues.append("voice interaction conflicts with the declared hearing-related need")
    if issues:
        return _check(
            "accessibility_coverage",
            "REVIEW",
            issues,
            ["Provide an accessible alternate path or obtain a human accessibility review before implementation."],
        )
    return _check(
        "accessibility_coverage",
        "PASS",
        ["No deterministic accessibility conflict was detected for the declared needs."],
    )


def build_recommendation_assurance(
    capability: dict[str, Any],
    context: dict[str, Any],
    recommendation: dict[str, Any],
    *,
    registry: PatternRegistry | None = None,
) -> dict[str, Any]:
    """Cross-check a recommendation without silently changing its authority or output."""
    registry = registry or PatternRegistry()
    context_assessment = assess_context(context)
    selected = recommendation.get("recommended_interface", {})
    pattern_id = str(selected.get("interface_pattern_id", ""))
    recommendation_status = str(selected.get("recommendation_status", ""))
    checks: list[dict[str, Any]] = []

    if not context_assessment["valid"]:
        checks.append(_check(
            "context_preflight",
            "BLOCKED",
            [f"{item['path']}: {item['message']}" for item in context_assessment["errors"]],
            ["Correct the context and regenerate the recommendation."],
        ))
    else:
        checks.append(_check("context_preflight", "PASS", ["Context passed deterministic preflight without defaults."]))

    binding_issues: list[str] = []
    if recommendation.get("capability_id") != capability.get("capability_id"):
        binding_issues.append("recommendation capability_id does not match the supplied capability record")
    if recommendation.get("context") != context:
        binding_issues.append("recommendation context snapshot does not equal the supplied context")
    if binding_issues:
        checks.append(_check(
            "recommendation_input_binding",
            "BLOCKED",
            binding_issues,
            ["Do not execute; regenerate the recommendation from the exact capability and context."],
        ))
    else:
        checks.append(_check(
            "recommendation_input_binding",
            "PASS",
            ["Recommendation is bound to the supplied capability identity and exact context snapshot."],
        ))

    can_reproduce = context_assessment["valid"] and not binding_issues
    if recommendation_status in {"insufficient_information", "no_safe_match"} or not pattern_id:
        checks.append(_check(
            "selection_availability",
            "NOT_APPLICABLE",
            [f"Recommendation status is {recommendation_status or 'unknown'}; no executable interface pattern is asserted."],
        ))
    elif can_reproduce:
        try:
            pattern = registry.get(pattern_id)
        except KeyError:
            checks.append(_check(
                "selected_pattern_registry_identity",
                "BLOCKED",
                [f"Selected pattern {pattern_id!r} is absent from the active registry."],
                ["Recompute the recommendation against the active registry."],
            ))
            pattern = None
        else:
            checks.append(_check(
                "selected_pattern_registry_identity",
                "PASS",
                [f"Selected pattern {pattern_id!r} exists in registry {registry.fingerprint}."],
            ))

        if pattern is not None:
            eligibility = evaluate_pattern_eligibility(pattern, capability, context)
            checks.append(_check(
                "hard_constraint_eligibility",
                "PASS" if eligibility["eligible"] else "BLOCKED",
                ["Pattern satisfies explicit unsafe/offline hard constraints."] if eligibility["eligible"] else list(eligibility["blockers"]),
                [] if eligibility["eligible"] else ["Do not execute; recompute using an eligible pattern."],
            ))
            checks.append(_budget_check(pattern, context))

            pattern_features = set(pattern.get("features", []))
            confirmation_required = bool(capability.get("risk_profile", {}).get("human_confirmation_required"))
            if confirmation_required:
                flow = recommendation.get("recommended_interface", {}).get("preview_and_confirmation_flow", [])
                required_controls = recommendation.get("recommended_interface", {}).get("required_controls", [])
                planned = (
                    "explicit_confirmation" in required_controls
                    and any("explicit confirmation" in str(step).lower() for step in flow)
                )
                native_gate = bool({"confirm", "approve", "review"} & pattern_features)
                if not planned:
                    checks.append(_check(
                        "required_confirmation_plan",
                        "BLOCKED",
                        ["Capability requires human confirmation, but the recommendation lacks an explicit confirmation control and flow."],
                        ["Do not execute until a confirmation gate is present and tested."],
                    ))
                elif native_gate:
                    checks.append(_check(
                        "required_confirmation_plan",
                        "PASS",
                        ["The recommendation plans explicit confirmation and the base pattern contains a native approval/review control."],
                    ))
                else:
                    checks.append(_check(
                        "required_confirmation_plan",
                        "REVIEW",
                        ["The recommendation plans explicit confirmation, but the base pattern needs a composed confirmation gate."],
                        ["Implement and test the composed confirmation gate before execution."],
                    ))

            preview_required = bool(capability.get("risk_profile", {}).get("safe_preview_recommended"))
            if preview_required:
                flow = recommendation.get("recommended_interface", {}).get("preview_and_confirmation_flow", [])
                required_controls = recommendation.get("recommended_interface", {}).get("required_controls", [])
                planned = (
                    "non_destructive_preview" in required_controls
                    and any("non-destructive preview" in str(step).lower() for step in flow)
                )
                native_preview = pattern.get("preview_capability") in {"preview", "live_preview"}
                if not planned:
                    checks.append(_check(
                        "safe_preview_plan",
                        "BLOCKED",
                        ["A safe preview is recommended by the capability, but no non-destructive preview control and flow are planned."],
                        ["Do not execute until the preview path is present and tested."],
                    ))
                elif native_preview:
                    checks.append(_check(
                        "safe_preview_plan",
                        "PASS",
                        ["The recommendation includes a non-destructive preview and the base pattern natively supports preview."],
                    ))
                else:
                    checks.append(_check(
                        "safe_preview_plan",
                        "REVIEW",
                        ["The recommendation plans preview, but the base pattern needs a composed preview surface."],
                        ["Implement and test the preview surface before execution."],
                    ))

            required = set(capability.get("interface_requirements", {}).get("required_interface_features", []))
            missing = sorted(required - set(pattern.get("features", [])))
            if missing:
                checks.append(_check(
                    "required_feature_augmentation",
                    "REVIEW",
                    ["Base pattern does not natively declare: " + ", ".join(missing) + "."],
                    ["Add and test the required controls before treating the interface implementation as complete."],
                ))
            else:
                checks.append(_check(
                    "required_feature_augmentation",
                    "PASS",
                    ["Base pattern declares all required interface features."],
                ))

            tool_options = {str(value).strip().lower() for value in pattern.get("required_tool_any", [])}
            tools = {str(value).strip().lower() for value in context.get("available_tools", [])}
            if tool_options and not tool_options & tools:
                checks.append(_check(
                    "supporting_tool_availability",
                    "REVIEW",
                    ["No required supporting tool is available; needs one of: " + ", ".join(sorted(tool_options)) + "."],
                    ["Supply a compatible tool or select a pattern without that dependency."],
                ))
            else:
                checks.append(_check("supporting_tool_availability", "PASS", ["Supporting-tool requirements are satisfied or not applicable."]))

            devices = {str(value).strip().lower() for value in context.get("device_types", [])}
            supported_devices = {str(value).strip().lower() for value in pattern.get("device_affinity", [])}
            if devices and not devices & supported_devices:
                checks.append(_check(
                    "device_fit",
                    "REVIEW",
                    [f"Declared devices {sorted(devices)} do not intersect pattern affinity {sorted(supported_devices)}."],
                    ["Confirm an alternate device implementation before use."],
                ))
            else:
                checks.append(_check("device_fit", "PASS", ["Pattern fits at least one declared device or no device was declared."]))

            checks.append(_accessibility_check(pattern_id, context_assessment, context))

            ranked = [item for item in rank_patterns(capability, context, registry) if item.eligible]
            if ranked and ranked[0].pattern["interface_pattern_id"] == pattern_id:
                if len(ranked) > 1:
                    gap = round(ranked[0].score - ranked[1].score, 3)
                    ratio = round(gap / max(abs(ranked[0].score), 1.0), 4)
                    status = "REVIEW" if gap <= 3 or ratio <= 0.03 else "PASS"
                    facts = [
                        f"Top score={ranked[0].score}; second score={ranked[1].score}; margin={gap}; normalized_margin={ratio}."
                    ]
                    actions = ["Review the full score trace because the top candidates are nearly tied."] if status == "REVIEW" else []
                    checks.append(_check("selection_margin", status, facts, actions))
                else:
                    checks.append(_check("selection_margin", "PASS", ["Only one eligible registry pattern remained."]))
            else:
                checks.append(_check(
                    "selection_reproduction",
                    "BLOCKED",
                    ["The active registry/scoring engine did not reproduce the selected pattern as the top eligible result."],
                    ["Do not execute until recommendation and active dependencies are reconciled."],
                ))
    else:
        checks.append(_check(
            "selection_reproduction",
            "BLOCKED",
            ["Selection was not reproduced because context or input binding failed."],
            ["Correct input identity and context before re-running assurance."],
        ))

    statuses = {item["status"] for item in checks}
    if "BLOCKED" in statuses:
        overall = "BLOCKED"
    elif "REVIEW" in statuses:
        overall = "REVIEW"
    elif statuses == {"PASS", "NOT_APPLICABLE"} or statuses == {"NOT_APPLICABLE"}:
        overall = "NOT_APPLICABLE"
    else:
        overall = "PASS"

    counts = Counter(item["status"] for item in checks)
    core = {
        "capability_id": capability.get("capability_id", ""),
        "recommendation_id": recommendation.get("recommendation_id", ""),
        "registry_fingerprint": registry.fingerprint,
        "checks": checks,
    }
    return {
        "assurance_version": ASSURANCE_VERSION,
        "assurance_id": stable_id("axm.hii.recommendation-assurance", core),
        "capability_id": capability.get("capability_id", ""),
        "recommendation_id": recommendation.get("recommendation_id", ""),
        "selected_interface_pattern_id": pattern_id,
        "recommendation_status": recommendation_status,
        "overall_status": overall,
        "registry_fingerprint": registry.fingerprint,
        "check_counts": {
            "PASS": counts.get("PASS", 0),
            "REVIEW": counts.get("REVIEW", 0),
            "BLOCKED": counts.get("BLOCKED", 0),
            "NOT_APPLICABLE": counts.get("NOT_APPLICABLE", 0),
        },
        "checks": checks,
        "governance": {
            "advisory_cross_check": True,
            "changes_authoritative_recommendation": False,
            "grants_execution_authority": False,
            "automatic_canon": False,
        },
    }
