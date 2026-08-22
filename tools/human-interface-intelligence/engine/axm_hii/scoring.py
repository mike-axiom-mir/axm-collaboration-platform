from __future__ import annotations

from typing import Any

from .constraints import evaluate_pattern_eligibility
from .registry import COST_ORDER, SKILL_ORDER, PatternRegistry, PatternScore


def _overlap(left: list[str], right: list[str]) -> set[str]:
    return {str(item).strip().lower() for item in left} & {str(item).strip().lower() for item in right}


def _normalized(value: str) -> str:
    return str(value or "unknown").strip().lower()


def score_pattern(
    pattern: dict[str, Any], capability: dict[str, Any], context: dict[str, Any]
) -> PatternScore:
    score = 0.0
    reasons: list[str] = []
    penalties: list[str] = []
    eligibility = evaluate_pattern_eligibility(pattern, capability, context)
    eligibility_blockers = list(eligibility["blockers"])

    task_type = _normalized(context.get("task_type"))
    task_affinity = {_normalized(v) for v in pattern.get("task_affinity", [])}
    if task_type in task_affinity:
        score += 34
        reasons.append(f"Pattern explicitly supports task type '{task_type}'.")
    elif any(task_type and (task_type in item or item in task_type) for item in task_affinity):
        score += 14
        reasons.append(f"Pattern has partial affinity with task type '{task_type}'.")

    cap_inputs = capability["input_profile"]["input_types"]
    cap_outputs = capability["output_profile"]["output_types"]
    input_match = _overlap(cap_inputs, pattern.get("input_affinity", []))
    output_match = _overlap(cap_outputs, pattern.get("output_affinity", []))
    if input_match:
        bonus = min(15, 5 * len(input_match))
        score += bonus
        reasons.append(f"Input fit: {', '.join(sorted(input_match))}.")
    if output_match:
        bonus = min(15, 5 * len(output_match))
        score += bonus
        reasons.append(f"Output fit: {', '.join(sorted(output_match))}.")

    user_skill = SKILL_ORDER.get(_normalized(context.get("user_skill_level")), -1)
    min_skill = SKILL_ORDER.get(_normalized(pattern.get("minimum_user_skill")), 4)
    if user_skill >= min_skill and user_skill >= 0:
        score += 9
        reasons.append("User skill meets the pattern's minimum.")
    elif user_skill >= 0:
        gap = min_skill - user_skill
        score -= 18 * gap
        penalties.append(
            f"Pattern requires {_normalized(pattern.get('minimum_user_skill'))} skill, above the user's {_normalized(context.get('user_skill_level'))} level."
        )
    else:
        score -= 4
        penalties.append("User skill is unknown.")

    if user_skill <= 1:
        if pattern.get("beginner_suitable"):
            score += 12
            reasons.append("Pattern is suitable for beginners.")
        else:
            score -= 24
            penalties.append("Pattern is not beginner-suitable.")

    devices = {_normalized(v) for v in context.get("device_types", [])}
    supported_devices = {_normalized(v) for v in pattern.get("device_affinity", [])}
    if devices & supported_devices:
        score += 7
        reasons.append("Pattern fits an available device.")
    elif devices:
        score -= 16
        penalties.append("Pattern does not fit the available device types.")

    feedback = _normalized(capability["interaction_profile"]["feedback_requirement"])
    preview = _normalized(pattern.get("preview_capability"))
    safe_preview = capability["risk_profile"].get("safe_preview_recommended", False)
    if feedback in {"live_preview", "continuous"}:
        if preview == "live_preview":
            score += 20
            reasons.append("Live feedback requirement is matched by live preview.")
        elif preview == "preview":
            score += 4
            penalties.append("Pattern offers preview, but not continuous live feedback.")
        else:
            score -= 18
            penalties.append("Pattern cannot satisfy the live feedback requirement.")
    elif feedback == "preview" or safe_preview:
        if preview in {"preview", "live_preview"}:
            score += 12
            reasons.append("Preview support lowers avoidable error cost.")
        else:
            score -= 12
            penalties.append("A safe preview is recommended but not well supported.")
    elif feedback == "status" and preview in {"status", "preview", "live_preview"}:
        score += 5
        reasons.append("Pattern can expose status feedback.")

    precision = _normalized(capability["interaction_profile"]["precision_requirement"])
    if precision == "exact":
        if pattern["interface_pattern_id"] in {
            "guided_form",
            "property_inspector",
            "table_spreadsheet",
            "code_editor",
            "approval_confirmation",
        }:
            score += 10
            reasons.append("Pattern supports exact review or parameter entry.")
        if pattern["interface_pattern_id"] in {"conversational_interface", "voice_interaction"}:
            score -= 18
            penalties.append("Natural-language control is too ambiguous for exact operation.")

    collaboration_mode = _normalized(context.get("collaboration_mode"))
    pid = pattern["interface_pattern_id"]
    if collaboration_mode == "human_ai_shared":
        if pid in {"structured_prompt_builder", "conversational_interface", "hybrid_visual_code", "approval_confirmation"}:
            score += 5
            reasons.append("Pattern supports a visible human-AI collaboration boundary.")
    elif collaboration_mode == "supervised_automation":
        if pid in {"automation_recipe_builder", "approval_confirmation", "monitoring_status"}:
            score += 12
            reasons.append("Pattern supports supervised automation with human oversight.")
        elif pid in {"canvas", "controller_game_style"}:
            score -= 6
            penalties.append("Pattern does not expose automation oversight well.")
    elif collaboration_mode == "ai_only":
        if pid in {"monitoring_status", "approval_confirmation", "dashboard"}:
            score += 10
            reasons.append("Pattern gives humans an oversight surface around AI-only execution.")
        elif pid in {"canvas", "drag_drop_workspace", "controller_game_style"}:
            score -= 8
            penalties.append("Direct-manipulation control is unnecessary for AI-only execution.")
    elif collaboration_mode == "human_only":
        if pid in {"conversational_interface", "structured_prompt_builder"}:
            score -= 5
            penalties.append("The selected workflow does not require an AI-mediated interface.")

    risk = _normalized(capability["risk_profile"]["risk_level"])
    reversibility = _normalized(capability["risk_profile"]["reversibility"])
    confirmation = bool(capability["risk_profile"]["human_confirmation_required"])
    is_gate = pattern["interface_pattern_id"] == "approval_confirmation"
    if confirmation or risk in {"high", "critical"} or reversibility == "irreversible":
        if is_gate:
            score += 36
            reasons.append("Explicit approval matches the declared consequence and confirmation requirements.")
        elif "confirm" in pattern.get("features", []) or "review" in pattern.get("features", []):
            score += 5
            reasons.append("Pattern includes a review or confirmation control.")
        else:
            score -= 18
            penalties.append("High-consequence action lacks a strong explicit approval gate.")
    elif is_gate:
        score -= 8
        penalties.append("An approval gate would add unnecessary friction for this low-risk task.")

    frequency = _normalized(capability["interaction_profile"]["interaction_frequency"])
    if frequency == "continuous" and pattern["interface_pattern_id"] in {
        "controller_game_style",
        "live_preview_controls",
        "monitoring_status",
    }:
        score += 12
        reasons.append("Pattern is suited to continuous interaction or observation.")
    if task_type == "long_running_automation":
        if pattern["interface_pattern_id"] == "automation_recipe_builder":
            score += 22
            reasons.append("Trigger-action structure fits a repeatable long-running workflow.")
        if pattern["interface_pattern_id"] == "monitoring_status":
            score += 8
            reasons.append("Monitoring is useful after the automation is configured.")

    decision_count = (
        len(capability["input_profile"].get("required_inputs", []))
        + len(capability["input_profile"].get("optional_inputs", []))
        + len(capability["task_profile"].get("required_human_actions", []))
    )
    if decision_count <= 3 and pattern["interface_pattern_id"] == "simple_action_button":
        score += 8
        reasons.append("The task has few decisions and can stay direct.")
    elif 3 <= decision_count <= 8 and pattern["interface_pattern_id"] == "guided_form":
        score += 8
        reasons.append("The number of decisions fits a compact guided form.")
    elif decision_count >= 7 and pattern["interface_pattern_id"] == "wizard":
        score += 10
        reasons.append("The task has enough dependent decisions to benefit from staged steps.")

    recovery_cost = _normalized(capability["cost_profile"].get("error_recovery_cost"))
    if recovery_cost == "high":
        if preview in {"preview", "live_preview"} or pattern["interface_pattern_id"] in {"wizard", "approval_confirmation"}:
            score += 8
            reasons.append("Pattern reduces the declared high recovery cost.")
        else:
            score -= 10
            penalties.append("Weak preview/review support is unsafe for high recovery cost.")

    pattern_attention = COST_ORDER.get(_normalized(pattern.get("attention_cost")), 99)
    accessibility_needs = {_normalized(v) for v in context.get("accessibility_needs", [])}
    visual_heavy = {"drag_drop_workspace", "node_graph_editor", "canvas", "timeline", "layer_editor", "map_spatial_interface", "live_preview_controls"}
    motor_heavy = visual_heavy | {"controller_game_style"}
    if "screen_reader" in accessibility_needs:
        if pid in {"guided_form", "wizard", "command_palette", "conversational_interface", "simple_action_button"}:
            score += 12
            reasons.append("Pattern has a stronger screen-reader path.")
        elif pid in visual_heavy:
            score -= 22
            penalties.append("Pattern is visually dense and weak for screen-reader use without an alternate path.")
    if "limited_mobility" in accessibility_needs:
        if pid in {"voice_interaction", "command_palette", "guided_form"}:
            score += 10
            reasons.append("Pattern can reduce precision pointer movement.")
        elif pid in motor_heavy:
            score -= 16
            penalties.append("Pattern may demand continuous or precise motor input.")
    if "hearing" in accessibility_needs and pid == "voice_interaction":
        score -= 25
        penalties.append("Voice interaction conflicts with the declared hearing accessibility need.")
    if "low_vision" in accessibility_needs and pid in visual_heavy:
        score -= 12
        penalties.append("Pattern relies heavily on visual detail without a declared alternate representation.")
    if "reduced_cognitive_load" in accessibility_needs:
        if pattern.get("beginner_suitable") and pattern_attention <= COST_ORDER["low"]:
            score += 8
            reasons.append("Pattern supports reduced cognitive load.")
        elif pattern_attention >= COST_ORDER["high"]:
            score -= 15
            penalties.append("Pattern is too attention-heavy for reduced cognitive load.")

    available_tools = {_normalized(v) for v in context.get("available_tools", [])}
    tool_options = {_normalized(v) for v in pattern.get("required_tool_any", [])}
    if tool_options:
        if available_tools & tool_options:
            score += 6
            reasons.append("A required supporting tool is available.")
        else:
            score -= 14
            penalties.append(f"Supporting tool unavailable; needs one of: {', '.join(sorted(tool_options))}.")

    compute_budget = COST_ORDER.get(_normalized(context.get("resource_budget", {}).get("compute")), 99)
    overhead = COST_ORDER.get(_normalized(pattern.get("compute_overhead", "unknown")), 99)
    if compute_budget != 99 and overhead != 99:
        if overhead <= compute_budget:
            score += 5
            reasons.append("Interface overhead stays within the compute budget.")
        else:
            score -= 9 * (overhead - compute_budget)
            penalties.append("Interface overhead exceeds the compute budget.")

    attention_budget = COST_ORDER.get(
        _normalized(context.get("resource_budget", {}).get("attention")), 99
    )
    if attention_budget != 99 and pattern_attention != 99:
        if pattern_attention <= attention_budget:
            score += 7
            reasons.append("Pattern stays within the attention budget.")
        else:
            score -= 7 * (pattern_attention - attention_budget)
            penalties.append("Pattern exceeds the stated attention budget.")

    if context.get("offline_required") and not pattern.get("offline_capable", False):
        score -= 100
        penalties.append("Pattern is not available offline.")

    unsafe = set(capability["interface_requirements"].get("unsafe_interface_patterns", []))
    if pattern["interface_pattern_id"] in unsafe:
        score -= 100
        penalties.append("Capability explicitly marks this pattern as unsafe.")

    required_features = set(capability["interface_requirements"].get("required_interface_features", []))
    pattern_features = set(pattern.get("features", []))
    matched_features = required_features & pattern_features
    missing_features = required_features - pattern_features
    if matched_features:
        score += min(12, 3 * len(matched_features))
        reasons.append(f"Required feature fit: {', '.join(sorted(matched_features))}.")
    if missing_features:
        score -= min(10, len(missing_features))
        penalties.append(
            "Base pattern requires augmentation for declared features: "
            + ", ".join(sorted(missing_features))
            + "."
        )

    for blocker in eligibility_blockers:
        if blocker not in penalties:
            penalties.append(f"Hard eligibility block: {blocker}")

    return PatternScore(
        pattern,
        round(score, 3),
        tuple(reasons),
        tuple(penalties),
        bool(eligibility["eligible"]),
        tuple(eligibility_blockers),
    )


def rank_patterns(
    capability: dict[str, Any], context: dict[str, Any], registry: PatternRegistry | None = None
) -> list[PatternScore]:
    registry = registry or PatternRegistry()
    ranked = [score_pattern(pattern, capability, context) for pattern in registry]
    return sorted(
        ranked,
        key=lambda item: (not item.eligible, -item.score, item.pattern["interface_pattern_id"]),
    )
