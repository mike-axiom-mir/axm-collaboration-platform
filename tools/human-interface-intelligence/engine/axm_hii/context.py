from __future__ import annotations

from typing import Any

REQUIRED_FIELDS = (
    "user_skill_level",
    "user_goal",
    "task_type",
    "collaboration_mode",
    "device_types",
    "available_tools",
    "accessibility_needs",
    "privacy_mode",
    "offline_required",
    "resource_budget",
)

ALLOWED_SKILLS = {"beginner", "basic", "intermediate", "advanced", "specialist", "unknown"}
ALLOWED_COLLABORATION = {"human_only", "ai_only", "human_ai_shared", "supervised_automation"}
BUDGET_FIELDS = ("compute", "time", "attention", "complexity")
LIST_FIELDS = ("device_types", "available_tools", "accessibility_needs")
STRING_FIELDS = ("user_goal", "task_type", "privacy_mode")
COST_BUDGET_VALUES = {"none", "very_low", "low", "medium", "high", "very_high", "unknown"}
TIME_BUDGET_VALUES = {"instant", "short", "medium", "long", "variable", "unknown"}
SUPPORTED_ACCESSIBILITY_NEEDS = {
    "screen_reader",
    "limited_mobility",
    "hearing",
    "low_vision",
    "reduced_cognitive_load",
}


def assess_context(context: Any) -> dict[str, Any]:
    """Inspect a recommendation context without silently filling or rewriting it."""
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []

    if not isinstance(context, dict):
        return {
            "valid": False,
            "errors": [{"path": "/context", "message": "Context must be an object."}],
            "warnings": [],
            "missing_fields": list(REQUIRED_FIELDS),
            "unknown_fields": [],
            "unsupported_accessibility_needs": [],
        }

    missing = [field for field in REQUIRED_FIELDS if field not in context]
    for field in missing:
        errors.append({"path": f"/context/{field}", "message": "Required context field is missing."})

    unknown_fields = sorted(set(context) - set(REQUIRED_FIELDS))
    for field in unknown_fields:
        errors.append({"path": f"/context/{field}", "message": "Unknown context field; no silent extension is allowed."})

    if "user_skill_level" in context and context.get("user_skill_level") not in ALLOWED_SKILLS:
        errors.append({"path": "/context/user_skill_level", "message": "Unsupported user_skill_level."})
    if "collaboration_mode" in context and context.get("collaboration_mode") not in ALLOWED_COLLABORATION:
        errors.append({"path": "/context/collaboration_mode", "message": "Unsupported collaboration_mode."})

    for field in STRING_FIELDS:
        if field in context and not isinstance(context.get(field), str):
            errors.append({"path": f"/context/{field}", "message": "Value must be a string."})

    for field in LIST_FIELDS:
        value = context.get(field)
        if field not in context:
            continue
        if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
            errors.append({"path": f"/context/{field}", "message": "Value must be an array of strings."})
            continue
        empty_indexes = [index for index, item in enumerate(value) if not item.strip()]
        for index in empty_indexes:
            errors.append({"path": f"/context/{field}/{index}", "message": "List items must not be empty."})
        normalized = [item.strip().lower() for item in value if item.strip()]
        if len(normalized) != len(set(normalized)):
            warnings.append({"path": f"/context/{field}", "message": "Duplicate values are present; they are not silently removed."})

    if "offline_required" in context and not isinstance(context.get("offline_required"), bool):
        errors.append({"path": "/context/offline_required", "message": "Value must be boolean."})

    budget = context.get("resource_budget")
    if "resource_budget" in context:
        if not isinstance(budget, dict):
            errors.append({"path": "/context/resource_budget", "message": "resource_budget must be an object."})
        else:
            for field in BUDGET_FIELDS:
                if field not in budget:
                    errors.append({"path": f"/context/resource_budget/{field}", "message": "Required budget field is missing."})
                    continue
                value = budget[field]
                if not isinstance(value, str):
                    errors.append({"path": f"/context/resource_budget/{field}", "message": "Budget value must be a string."})
                    continue
                allowed = TIME_BUDGET_VALUES if field == "time" else COST_BUDGET_VALUES
                if value not in allowed:
                    errors.append({
                        "path": f"/context/resource_budget/{field}",
                        "message": f"Unsupported {field} budget value; allowed values are {sorted(allowed)}.",
                    })
            for field in sorted(set(budget) - set(BUDGET_FIELDS)):
                errors.append({"path": f"/context/resource_budget/{field}", "message": "Unknown budget field."})

    if context.get("user_skill_level") == "unknown":
        warnings.append({"path": "/context/user_skill_level", "message": "User skill is explicitly unknown; rankings will be conservative."})
    if isinstance(context.get("user_goal"), str) and not context.get("user_goal", "").strip():
        warnings.append({"path": "/context/user_goal", "message": "User goal is empty; recommendation reasoning may be less useful."})
    if isinstance(context.get("task_type"), str) and not context.get("task_type", "").strip():
        warnings.append({"path": "/context/task_type", "message": "Task type is empty; task-affinity scoring cannot help."})
    if isinstance(context.get("privacy_mode"), str) and not context.get("privacy_mode", "").strip():
        warnings.append({"path": "/context/privacy_mode", "message": "Privacy mode is empty and cannot guide later policy checks."})
    if isinstance(context.get("device_types"), list) and not context.get("device_types"):
        warnings.append({"path": "/context/device_types", "message": "No device type is declared; device-fit scoring cannot help."})

    needs = context.get("accessibility_needs", [])
    unsupported_accessibility = sorted({
        str(value).strip().lower()
        for value in needs
        if isinstance(value, str) and value.strip() and value.strip().lower() not in SUPPORTED_ACCESSIBILITY_NEEDS
    }) if isinstance(needs, list) else []
    for value in unsupported_accessibility:
        warnings.append({
            "path": "/context/accessibility_needs",
            "message": f"Accessibility need {value!r} has no deterministic rule in this engine version and requires manual review.",
        })

    return {
        "valid": not errors,
        "errors": errors,
        "warnings": warnings,
        "missing_fields": missing,
        "unknown_fields": unknown_fields,
        "unsupported_accessibility_needs": unsupported_accessibility,
    }
