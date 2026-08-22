from __future__ import annotations

from typing import Any

from .registry import SKILL_ORDER


def plan_beginner_layer(
    capability: dict[str, Any], context: dict[str, Any], status: str
) -> dict[str, Any]:
    learning = capability["learning_profile"]
    risk = capability["risk_profile"]
    user_skill = SKILL_ORDER.get(context.get("user_skill_level", "unknown"), -1)
    min_skill = SKILL_ORDER.get(learning.get("minimum_skill_level", "unknown"), -1)

    if status in {"insufficient_information", "no_safe_match"}:
        return {
            "enabled": False,
            "operation_class": "restricted_safe_operation",
            "allowed_operations": [],
            "restricted_operations": list(learning.get("advanced_operations", [])),
            "default_values": {},
            "guided_steps": [
                "Resolve the listed unknowns or conflicts.",
                "Revalidate the capability record.",
                "Generate a new recommendation only after evidence is adequate.",
            ],
            "explanation_depth": "practical",
            "estimated_capability_cost": {
                "compute": "none",
                "attention": "low",
                "complexity": "blocked",
            },
            "reasons_for_restrictions": [
                "The system cannot honestly expose a beginner operation while critical evidence is unresolved."
            ],
        }

    if risk["risk_level"] in {"high", "critical"} or risk["reversibility"] == "irreversible":
        operation_class = "restricted_safe_operation"
    elif min_skill > user_skill >= 0:
        operation_class = "guided_advanced_operation"
    else:
        operation_class = "simplified_control"

    allowed = list(learning.get("beginner_safe_operations", []))
    restricted = list(learning.get("advanced_operations", []))
    reasons: list[str] = []
    if risk["reversibility"] == "irreversible":
        reasons.append("Irreversible variants remain restricted from the beginner layer.")
    if risk["risk_level"] in {"moderate", "high", "critical"}:
        reasons.append("Risk level requires staged review and explicit consequence explanation.")
    if min_skill > user_skill >= 0:
        reasons.append("Full control exceeds the user's current declared skill level.")
    reasons.extend(capability["interface_requirements"].get("beginner_layer_constraints", []))

    defaults = {
        "preview_before_apply": bool(
            risk.get("safe_preview_recommended")
            or capability["output_profile"].get("preview_available") == "KNOWN"
        ),
        "confirmation_required": bool(risk.get("human_confirmation_required")),
        "retain_recovery_point": risk.get("reversibility") != "irreversible",
        "show_hidden_control_summary": True,
    }

    steps = [
        "State the intended goal in plain language.",
        "Provide only the inputs required for the selected safe operation.",
    ]
    if defaults["preview_before_apply"]:
        steps.append("Review a preview or consequence summary before applying the operation.")
    if defaults["confirmation_required"]:
        steps.append("Give explicit confirmation after reviewing the target and consequences.")
    steps.extend([
        "Run the operation.",
        "Show the result, proof/status, and the available recovery action.",
        "Offer advanced mode as an explicit user choice; do not switch silently.",
    ])

    return {
        "enabled": True,
        "operation_class": operation_class,
        "allowed_operations": allowed,
        "restricted_operations": restricted,
        "default_values": defaults,
        "guided_steps": steps,
        "explanation_depth": "practical",
        "estimated_capability_cost": {
            "compute": capability["cost_profile"]["compute_cost"],
            "attention": capability["cost_profile"]["attention_cost"],
            "complexity": capability["interaction_profile"]["interaction_complexity"],
        },
        "reasons_for_restrictions": reasons,
    }


def plan_advanced_layer(capability: dict[str, Any], status: str) -> dict[str, Any]:
    advanced = list(capability["learning_profile"].get("advanced_operations", []))
    risk = capability["risk_profile"]
    available = bool(advanced) and status not in {"insufficient_information", "no_safe_match"}
    if not available:
        method = "not_available"
    elif risk["risk_level"] in {"moderate", "high", "critical"}:
        method = "demonstrated_skill"
    else:
        method = "manual_choice"
    return {
        "available": available,
        "unlock_method": method,
        "additional_controls": advanced,
        "additional_risks": list(risk.get("failure_modes", [])),
        "required_knowledge": list(capability["learning_profile"].get("recommended_learning_steps", [])),
    }
