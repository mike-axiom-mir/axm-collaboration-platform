from __future__ import annotations

import copy
from typing import Any

from .context import assess_context
from .engine import recommend_interface
from .util import stable_id

ROBUSTNESS_VERSION = "0.1.0"
SKILLS = ["beginner", "basic", "intermediate", "advanced", "specialist"]
COSTS = ["none", "very_low", "low", "medium", "high", "very_high"]
ATTENTION = ["very_low", "low", "medium", "high", "very_high"]
COMPLEXITY = ["very_low", "low", "medium", "high", "very_high"]


def _neighbor(values: list[str], current: str, delta: int) -> str | None:
    try:
        idx = values.index(str(current))
    except ValueError:
        return None
    target = idx + delta
    if 0 <= target < len(values):
        return values[target]
    return None


def _outcome(rec: dict[str, Any]) -> dict[str, Any]:
    selected = rec.get("recommended_interface", {})
    return {
        "pattern_id": selected.get("interface_pattern_id", ""),
        "status": selected.get("recommendation_status", ""),
        "confidence": selected.get("confidence", 0.0),
    }


def _candidate_probes(context: dict[str, Any]) -> list[dict[str, Any]]:
    probes: list[dict[str, Any]] = []

    skill = str(context.get("user_skill_level", "unknown"))
    for delta, label in ((-1, "skill_one_step_lower"), (1, "skill_one_step_higher")):
        value = _neighbor(SKILLS, skill, delta)
        if value is not None:
            changed = copy.deepcopy(context)
            changed["user_skill_level"] = value
            probes.append({"probe_id": label, "changed_path": "/user_skill_level", "synthetic_value": value, "context": changed})

    budget_specs = (
        ("compute", COSTS),
        ("attention", ATTENTION),
        ("complexity", COMPLEXITY),
    )
    for field, values in budget_specs:
        current = str(context.get("resource_budget", {}).get(field, "unknown"))
        value = _neighbor(values, current, -1)
        if value is not None:
            changed = copy.deepcopy(context)
            changed["resource_budget"][field] = value
            probes.append({
                "probe_id": f"{field}_budget_one_step_tighter",
                "changed_path": f"/resource_budget/{field}",
                "synthetic_value": value,
                "context": changed,
            })

    devices = list(context.get("device_types", []))
    if len(devices) > 1:
        for device in devices[:3]:
            changed = copy.deepcopy(context)
            changed["device_types"] = [value for value in devices if value != device]
            probes.append({
                "probe_id": f"without_device_{str(device).strip().lower().replace(' ', '_')}",
                "changed_path": "/device_types",
                "synthetic_value": changed["device_types"],
                "context": changed,
            })

    tools = list(context.get("available_tools", []))
    if tools:
        changed = copy.deepcopy(context)
        changed["available_tools"] = []
        probes.append({
            "probe_id": "without_declared_tools",
            "changed_path": "/available_tools",
            "synthetic_value": [],
            "context": changed,
        })

    # Hard cap keeps the shadow analysis bounded and deterministic.
    return probes[:8]


def probe_recommendation_stability(
    capability: dict[str, Any],
    context: dict[str, Any],
    *,
    generated_at: str = "shadow",
) -> dict[str, Any]:
    assessment = assess_context(context)
    if not assessment["valid"]:
        raise ValueError("Cannot run robustness probes on an invalid base context.")

    base = recommend_interface(capability, context, generated_at=generated_at)
    base_outcome = _outcome(base)
    probes: list[dict[str, Any]] = []
    changed_count = 0
    pattern_changes = 0
    status_changes = 0

    for candidate in _candidate_probes(context):
        candidate_assessment = assess_context(candidate["context"])
        if not candidate_assessment["valid"]:
            continue
        recommendation = recommend_interface(capability, candidate["context"], generated_at=generated_at)
        outcome = _outcome(recommendation)
        pattern_changed = outcome["pattern_id"] != base_outcome["pattern_id"]
        status_changed = outcome["status"] != base_outcome["status"]
        changed = pattern_changed or status_changed
        changed_count += int(changed)
        pattern_changes += int(pattern_changed)
        status_changes += int(status_changed)
        probes.append({
            "probe_id": candidate["probe_id"],
            "changed_path": candidate["changed_path"],
            "synthetic_value": candidate["synthetic_value"],
            "synthetic_context": True,
            "outcome": outcome,
            "pattern_changed": pattern_changed,
            "status_changed": status_changed,
        })

    total = len(probes)
    ratio = 0.0 if total == 0 else round(changed_count / total, 4)
    if total == 0:
        classification = "not_enough_probe_surface"
    elif pattern_changes:
        classification = "pattern_sensitive"
    elif status_changes:
        classification = "status_sensitive"
    elif base_outcome["status"] in {"insufficient_information", "no_safe_match"}:
        classification = "stable_blocked_under_bounded_probes"
    else:
        classification = "stable_under_bounded_probes"

    core = {
        "capability_id": capability.get("capability_id", ""),
        "base": base_outcome,
        "probes": [{"probe_id": item["probe_id"], "outcome": item["outcome"]} for item in probes],
    }
    return {
        "robustness_version": ROBUSTNESS_VERSION,
        "robustness_id": stable_id("axm.hii.robustness", core),
        "capability_id": capability.get("capability_id", ""),
        "authority": "shadow_advisory_only",
        "base_outcome": base_outcome,
        "classification": classification,
        "probe_count": total,
        "changed_probe_count": changed_count,
        "sensitivity_ratio": ratio,
        "probes": probes,
        "interpretation_limits": [
            "Probe contexts are synthetic counterfactuals, not observed user states.",
            "A stable result under these bounded probes is not proof of global robustness.",
            "A changed result is signal for review, not evidence that either outcome is wrong.",
            "Shadow analysis never grants execution authority or rewrites the base recommendation.",
        ],
    }
