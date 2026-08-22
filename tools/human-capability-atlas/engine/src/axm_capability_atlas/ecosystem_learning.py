from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

from . import __version__, CONTRACT_VERSION


def _dict(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def build_learning_path(cards: Iterable[dict[str, Any]], target_capability_id: str) -> dict[str, Any]:
    by_id = {str(card.get("capability_id")): card for card in cards if card.get("capability_id")}
    if target_capability_id not in by_id:
        raise KeyError(f"Target capability not found: {target_capability_id}")

    temporary: set[str] = set()
    permanent: set[str] = set()
    order: list[str] = []
    cycles: list[list[str]] = []
    missing: list[dict[str, str]] = []
    stack: list[str] = []

    def dependencies(capability_id: str) -> list[str]:
        card = by_id[capability_id]
        values = []
        values.extend(str(item) for item in _list(_dict(card.get("relationships")).get("dependency_capability_ids")))
        values.extend(str(item) for item in _list(_dict(card.get("learning_profile")).get("prerequisite_capability_ids")))
        return list(dict.fromkeys(values))

    def visit(capability_id: str) -> None:
        if capability_id in permanent:
            return
        if capability_id in temporary:
            if capability_id in stack:
                cycle = stack[stack.index(capability_id):] + [capability_id]
                if cycle not in cycles:
                    cycles.append(cycle)
            return
        temporary.add(capability_id)
        stack.append(capability_id)
        for dependency in dependencies(capability_id):
            if dependency not in by_id:
                item = {"required_by": capability_id, "missing_capability_id": dependency}
                if item not in missing:
                    missing.append(item)
                continue
            visit(dependency)
        stack.pop()
        temporary.remove(capability_id)
        permanent.add(capability_id)
        order.append(capability_id)

    visit(target_capability_id)
    steps = []
    for position, capability_id in enumerate(order, start=1):
        card = by_id[capability_id]
        learning = _dict(card.get("learning_profile"))
        steps.append({
            "position": position,
            "capability_id": capability_id,
            "human_name": _dict(card.get("identity")).get("human_name", ""),
            "minimum_skill_level": learning.get("minimum_skill_level", "unknown"),
            "recommended_learning_steps": _list(learning.get("recommended_learning_steps")),
            "beginner_safe_operations": _list(learning.get("beginner_safe_operations")),
            "proof_status": _dict(card.get("maturity_profile")).get("proof_status", "unverified"),
            "is_target": capability_id == target_capability_id,
        })

    status = "ready"
    if cycles:
        status = "blocked_by_cycle"
    elif missing:
        status = "incomplete_dependencies"

    return {
        "module": "AXM Human Capability Atlas",
        "module_version": __version__,
        "shared_contract_version": CONTRACT_VERSION,
        "operation": "ecosystem_learning_path",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "target_capability_id": target_capability_id,
        "status": status,
        "summary": {
            "step_count": len(steps),
            "missing_dependency_count": len(missing),
            "cycle_count": len(cycles),
        },
        "steps": steps,
        "missing_dependencies": missing,
        "cycles": cycles,
        "integrity_notes": [
            "Dependencies and prerequisites are placed before the target capability.",
            "Missing capabilities and cycles are reported rather than silently skipped.",
            "This plan orders capability learning; it does not claim the learner has completed or mastered any step.",
        ],
    }
