from __future__ import annotations

from typing import Any


def evaluate_pattern_eligibility(
    pattern: dict[str, Any], capability: dict[str, Any], context: dict[str, Any]
) -> dict[str, Any]:
    """Return non-negotiable selection blockers separately from soft scoring.

    A score can express preference. It must never overrule an explicit unsafe
    pattern declaration or a required offline boundary.
    """
    blockers: list[str] = []
    pattern_id = str(pattern.get("interface_pattern_id", ""))
    unsafe = {str(value) for value in capability.get("interface_requirements", {}).get("unsafe_interface_patterns", [])}
    if pattern_id in unsafe:
        blockers.append("Capability explicitly marks this interface pattern as unsafe.")
    if bool(context.get("offline_required")) and not bool(pattern.get("offline_capable", False)):
        blockers.append("Context requires offline operation, but this pattern is not declared offline-capable.")
    return {
        "eligible": not blockers,
        "blockers": blockers,
    }
