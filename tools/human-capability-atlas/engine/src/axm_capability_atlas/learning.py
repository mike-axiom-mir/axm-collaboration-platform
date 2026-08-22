from __future__ import annotations

import hashlib


def _dict(value) -> dict:
    return dict(value) if isinstance(value, dict) else {}


def _list(value) -> list:
    return value if isinstance(value, list) else []


def _registry_role(card: dict) -> dict:
    source = _dict(card.get("source_reference"))
    direct = _dict(source.get("registry_role"))
    if direct:
        return direct
    enrichment = _dict(source.get("enrichment"))
    return _dict(enrichment.get("registry_role"))


def _enrichment(card: dict) -> dict:
    source = _dict(card.get("source_reference"))
    return _dict(source.get("enrichment"))


def _dependency_reference_atoms(card: dict) -> list[dict]:
    enrichment = _enrichment(card)
    consumers = [
        str(_dict(item).get("module_id", ""))
        for item in _list(enrichment.get("consumers"))
        if _dict(item).get("module_id")
    ]
    proof = _dict(card.get("source_reference", {})).get("proof_ceiling", {})
    proof = _dict(proof)
    return [
        {
            "kind": "orientation",
            "title": "What this registry reference is",
            "content": (
                f"{card['identity']['human_name']} is recorded as a dependency/reference "
                "consumed by AXM modules, not as an AXM-provided ability."
            ),
        },
        {
            "kind": "consumers",
            "title": "Where AXM consumes it",
            "items": consumers,
        },
        {
            "kind": "boundary",
            "title": "What this does not claim",
            "items": [
                "This reference does not establish that AXM provides the capability.",
                "A registry declaration does not establish runtime behavior.",
                "A dependency/reference is not an instruction to execute or install anything.",
            ],
        },
        {
            "kind": "proof",
            "title": "Evidence ceiling",
            "content": (
                "Declaration is runtime proof: "
                f"{proof.get('declaration_is_runtime_proof', 'UNKNOWN')}; "
                "self-test is human approval: "
                f"{proof.get('selftest_is_human_approval', 'UNKNOWN')}."
            ),
        },
    ]


def _unbound_atoms(card: dict) -> list[dict]:
    return [
        {
            "kind": "orientation",
            "title": "Registry identifier awaiting classification",
            "content": (
                f"{card['identity']['human_name']} currently has neither a declared "
                "provider nor consumer relation in the checked public registry."
            ),
        },
        {
            "kind": "verification",
            "title": "Review before human teaching",
            "items": [
                "Confirm whether this identifier is a provided capability, dependency/reference, historical record, or registry defect.",
                "Do not teach operational use until its role is source-grounded.",
            ],
        },
    ]


def learning_atoms(card: dict) -> list[dict]:
    role = str(_registry_role(card).get("classification", "UNCLASSIFIED"))
    if role == "CONSUMER_ONLY_DEPENDENCY":
        return _dependency_reference_atoms(card)
    if role == "UNBOUND":
        return _unbound_atoms(card)

    return [
        {"kind": "orientation", "title": "What this capability is", "content": card["purpose"]["plain_explanation"]},
        {"kind": "meaning", "title": "Why it matters", "content": card["purpose"]["why_it_matters"]},
        {"kind": "inputs", "title": "What you provide", "items": card["input_profile"]["required_inputs"]},
        {"kind": "outputs", "title": "What you receive", "items": card["output_profile"]["expected_outputs"]},
        {"kind": "guided_use", "title": "Beginner-safe operations", "items": card["learning_profile"]["beginner_safe_operations"]},
        {"kind": "failure", "title": "Common mistakes", "items": card["learning_profile"]["common_mistakes"]},
        {"kind": "repair", "title": "Failure modes and recovery", "items": card["risk_profile"]["failure_modes"]},
        {"kind": "proof", "title": "How use should be verified", "content": f"Current proof status: {card['maturity_profile']['proof_status']}"},
    ]


def course_plan(
    card: dict,
    learner_type: str = "human",
    skill_level: str = "beginner",
    goal: str | None = None,
) -> dict:
    if learner_type not in {"human", "ai", "human_ai_shared"}:
        raise ValueError("Unsupported learner_type")
    valid_skills = {"beginner", "basic", "intermediate", "advanced", "specialist", "unknown"}
    if skill_level not in valid_skills:
        raise ValueError("Unsupported skill_level")

    role = str(_registry_role(card).get("classification", "UNCLASSIFIED"))
    if role == "CONSUMER_ONLY_DEPENDENCY":
        plan_type = "dependency_reference_orientation"
        default_goal = (
            f"Understand what {card['identity']['human_name']} references and where AXM consumes it"
        )
    elif role == "UNBOUND":
        plan_type = "registry_role_review_orientation"
        default_goal = f"Understand why {card['identity']['human_name']} is held for registry-role review"
    else:
        plan_type = "capability_learning"
        default_goal = (
            card["task_profile"]["typical_goals"][0]
            if card["task_profile"]["typical_goals"]
            else f"Understand and safely use {card['identity']['human_name']}"
        )

    goal = goal or default_goal
    digest = hashlib.sha256(
        f"{card['capability_id']}|{learner_type}|{skill_level}|{plan_type}|{goal}".encode()
    ).hexdigest()[:12]

    steps = [{"order": i, **atom} for i, atom in enumerate(learning_atoms(card), start=1)]
    if role not in {"CONSUMER_ONLY_DEPENDENCY", "UNBOUND"} and card.get("knowledge", {}).get("unknowns"):
        steps.insert(
            1,
            {
                "order": 2,
                "kind": "verification",
                "title": "Verify missing capability facts",
                "items": card["knowledge"]["unknowns"],
            },
        )
        for i, step in enumerate(steps, start=1):
            step["order"] = i

    return {
        "course_id": f"course-{digest}",
        "capability_id": card["capability_id"],
        "learner_type": learner_type,
        "skill_level": skill_level,
        "plan_type": plan_type,
        "registry_role": role,
        "goal": goal,
        "steps": steps,
        "unknowns": card.get("knowledge", {}).get("unknowns", []),
    }
