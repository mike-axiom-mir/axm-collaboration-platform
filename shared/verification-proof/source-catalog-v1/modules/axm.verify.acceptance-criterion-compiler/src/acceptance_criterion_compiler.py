"""Detached AXM Acceptance Criterion Compiler v0.1.0."""
from __future__ import annotations

from typing import Any, Dict, Mapping, Sequence
import copy
import hashlib
import json

CHECK_TYPES = ("MACHINE", "HUMAN", "COMPOSITE")

class AcceptanceCriterionError(ValueError):
    """An acceptance contract cannot be compiled without guessing."""

def _text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise AcceptanceCriterionError(f"{field} must be a non-empty string")
    return value.strip()

def _text_list(value: Any, field: str) -> list[str]:
    if not isinstance(value, (list, tuple)) or not value:
        raise AcceptanceCriterionError(f"{field} must be a non-empty list")
    result = []
    seen = set()
    for index, raw in enumerate(value):
        item = _text(raw, f"{field}[{index}]")
        if item in seen:
            raise AcceptanceCriterionError(f"duplicate item in {field}: {item}")
        seen.add(item)
        result.append(item)
    return result

def _criterion(raw: Mapping[str, Any], index: int) -> Dict[str, Any]:
    if not isinstance(raw, Mapping):
        raise AcceptanceCriterionError(f"criteria[{index}] must be an object")
    item = copy.deepcopy(dict(raw))
    for field in ("criterion_id", "statement", "proof_surface"):
        item[field] = _text(item.get(field), f"criteria[{index}].{field}")
    check_type = _text(item.get("check_type"), f"criteria[{index}].check_type").upper()
    if check_type not in CHECK_TYPES:
        raise AcceptanceCriterionError(f"unsupported check_type: {check_type}")
    item["check_type"] = check_type

    if not isinstance(item.get("tolerance"), Mapping):
        raise AcceptanceCriterionError(f"criteria[{index}].tolerance must be an object")
    item["tolerance"] = copy.deepcopy(dict(item["tolerance"]))
    item["evidence_requirements"] = _text_list(item.get("evidence_requirements"), f"criteria[{index}].evidence_requirements")
    item["refusal_conditions"] = _text_list(item.get("refusal_conditions"), f"criteria[{index}].refusal_conditions")

    if check_type in {"MACHINE", "COMPOSITE"}:
        if not isinstance(item.get("machine_check"), Mapping) or not item["machine_check"]:
            raise AcceptanceCriterionError(f"criteria[{index}].machine_check is required for {check_type}")
        item["machine_check"] = copy.deepcopy(dict(item["machine_check"]))
    else:
        item["machine_check"] = None

    if check_type in {"HUMAN", "COMPOSITE"}:
        if not isinstance(item.get("human_check"), Mapping) or not item["human_check"]:
            raise AcceptanceCriterionError(f"criteria[{index}].human_check is required for {check_type}")
        item["human_check"] = copy.deepcopy(dict(item["human_check"]))
    else:
        item["human_check"] = None
    return item

def compile_acceptance_contract(goal: Mapping[str, Any], criteria: Sequence[Mapping[str, Any]]) -> Dict[str, Any]:
    if not isinstance(goal, Mapping):
        raise AcceptanceCriterionError("goal must be an object")
    goal_id = _text(goal.get("goal_id"), "goal.goal_id")
    claim_id = _text(goal.get("claim_id"), "goal.claim_id")
    human_goal = _text(goal.get("human_goal"), "goal.human_goal")
    if not isinstance(criteria, (list, tuple)) or not criteria:
        raise AcceptanceCriterionError("explicit criteria are required; freeform goal inference is refused")

    compiled = []
    seen = set()
    for index, raw in enumerate(criteria):
        item = _criterion(raw, index)
        criterion_id = item["criterion_id"]
        if criterion_id in seen:
            raise AcceptanceCriterionError(f"duplicate criterion_id: {criterion_id}")
        seen.add(criterion_id)
        compiled.append(item)
    compiled.sort(key=lambda item: item["criterion_id"])

    identity_material = {"goal_id": goal_id, "claim_id": claim_id, "human_goal": human_goal, "criteria": compiled}
    contract_id = "acceptance:" + hashlib.sha256(json.dumps(identity_material, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
    return {
        "schema_version": "axm.verify.acceptance-contract/0.1",
        "contract_id": contract_id,
        "goal_id": goal_id,
        "claim_id": claim_id,
        "human_goal": human_goal,
        "human_goal_rewritten": False,
        "criterion_count": len(compiled),
        "criteria": compiled,
        "execution_state": "NOT_RUN",
        "decision": None,
        "authority": "NONE",
        "canon": False,
    }
