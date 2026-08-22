from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from . import __version__, CONTRACT_VERSION


def _dict(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _registry_role(card: dict[str, Any]) -> dict[str, Any]:
    source = _dict(card.get("source_reference"))
    direct = _dict(source.get("registry_role"))
    if direct:
        return direct
    enrichment = _dict(source.get("enrichment"))
    return _dict(enrichment.get("registry_role"))


def _present(value: Any) -> bool:
    if value in (None, "", [], {}):
        return False
    if isinstance(value, str) and value.strip().upper().startswith("UNKNOWN"):
        return False
    return True


def _ratio(checks: list[tuple[str, bool]]) -> tuple[int, list[str], list[str]]:
    passed = [name for name, ok in checks if ok]
    missing = [name for name, ok in checks if not ok]
    score = round(100 * len(passed) / len(checks)) if checks else 100
    return score, passed, missing


def _graph_context(graph: dict[str, Any] | None) -> tuple[dict[str, int], dict[str, int], dict[str, str]]:
    unresolved: Counter[str] = Counter()
    cycles: Counter[str] = Counter()
    lifecycle: dict[str, str] = {}
    if not graph:
        return unresolved, cycles, lifecycle
    for item in _dict(graph.get("integrity")).get("unresolved_references", []):
        source = item.get("source")
        if source:
            unresolved[str(source)] += 1
    for cycle in _dict(graph.get("integrity")).get("dependency_cycles", []):
        for capability_id in cycle:
            cycles[str(capability_id)] += 1
    for node in _list(graph.get("nodes")):
        capability_id = node.get("capability_id")
        if capability_id:
            lifecycle[str(capability_id)] = str(node.get("lifecycle_status", "unknown"))
    return unresolved, cycles, lifecycle


def audit_card(card: dict[str, Any], graph: dict[str, Any] | None = None) -> dict[str, Any]:
    capability_id = str(card.get("capability_id", ""))
    source = _dict(card.get("source_reference"))
    purpose = _dict(card.get("purpose"))
    interaction = _dict(card.get("interaction_profile"))
    interface = _dict(card.get("interface_requirements"))
    learning = _dict(card.get("learning_profile"))
    risk = _dict(card.get("risk_profile"))
    maturity = _dict(card.get("maturity_profile"))
    knowledge = _dict(card.get("knowledge"))
    field_states = _dict(knowledge.get("field_states"))
    registry_role = _registry_role(card)
    if registry_role:
        role_classification = str(registry_role.get("classification", "UNBOUND"))
        human_surface = str(registry_role.get("human_surface", "REVIEW_HOLD"))
        provider_backed = bool(registry_role.get("is_provider_backed", False))
    else:
        # The provider/consumer split is specific to generated public-registry
        # rows. Ordinary source declarations remain capabilities by default.
        role_classification = "NON_PUBLIC_CAPABILITY"
        human_surface = "AXM_CAPABILITY"
        provider_backed = True
    unresolved, cycles, lifecycle = _graph_context(graph)

    source_checks = [
        ("source location", _present(source.get("source_location"))),
        ("source hash", _present(source.get("source_hash"))),
        ("verification timestamp", _present(source.get("last_verified_at"))),
        ("source confidence", isinstance(source.get("confidence"), (int, float)) and float(source.get("confidence", 0)) > 0),
    ]
    explanation_checks = [
        ("plain explanation", _present(purpose.get("plain_explanation"))),
        ("human value explanation", _present(purpose.get("why_it_matters"))),
        ("example use", bool(_list(purpose.get("example_uses")))),
    ]
    interface_checks = [
        ("interaction complexity", interaction.get("interaction_complexity") not in (None, "", "unknown")),
        ("feedback requirement", interaction.get("feedback_requirement") not in (None, "", "unknown")),
        ("input method or interface feature", bool(_list(interaction.get("preferred_input_methods")) or _list(interface.get("required_interface_features")) or _list(interface.get("optional_interface_features")))),
        ("beginner or advanced interface guidance", bool(_list(interface.get("beginner_layer_constraints")) or _list(interface.get("advanced_layer_requirements")))),
    ]
    learning_checks = [
        ("minimum skill level", learning.get("minimum_skill_level") not in (None, "", "unknown")),
        ("learning steps", bool(_list(learning.get("recommended_learning_steps")))),
        ("beginner or advanced operations", bool(_list(learning.get("beginner_safe_operations")) or _list(learning.get("advanced_operations")))),
        ("common mistakes", bool(_list(learning.get("common_mistakes")))),
    ]
    safety_checks = [
        ("risk level", risk.get("risk_level") not in (None, "", "unknown")),
        ("reversibility", risk.get("reversibility") not in (None, "", "unknown")),
        ("privacy sensitivity", risk.get("privacy_sensitivity") not in (None, "", "unknown")),
        ("failure modes", bool(_list(risk.get("failure_modes")))),
    ]
    high_risk = risk.get("risk_level") in {"high", "critical"}
    confirmation_known = field_states.get("/risk_profile/human_confirmation_required") == "known"
    reversibility_known = field_states.get("/risk_profile/reversibility") == "known"
    if high_risk:
        safety_checks.append(("high-risk human confirmation", confirmation_known and risk.get("human_confirmation_required") is True))

    evidence_checks = [
        ("availability", maturity.get("availability") not in (None, "", "unknown")),
        ("maturity", maturity.get("maturity") not in (None, "", "unknown")),
        (
            "proof beyond declaration-only",
            maturity.get("proof_status")
            not in (
                None,
                "",
                "unknown",
                "unverified",
                "declared",
                "declared_not_runtime_proof",
            ),
        ),
        ("limitations field present", isinstance(maturity.get("known_limitations"), list)),
    ]
    relationship_checks = [
        ("no unresolved relationship references", unresolved[capability_id] == 0),
        ("not inside dependency cycle", cycles[capability_id] == 0),
    ]

    categories = {}
    for name, checks in [
        ("source_integrity", source_checks),
        ("human_explanation", explanation_checks),
        ("interface_readiness", interface_checks),
        ("learning_readiness", learning_checks),
        ("safety_readiness", safety_checks),
        ("evidence_readiness", evidence_checks),
        ("relationship_integrity", relationship_checks),
    ]:
        score, passed, missing = _ratio(checks)
        categories[name] = {"score": score, "passed": passed, "missing": missing}

    weights = {
        "source_integrity": 0.15,
        "human_explanation": 0.20,
        "interface_readiness": 0.15,
        "learning_readiness": 0.15,
        "safety_readiness": 0.15,
        "evidence_readiness": 0.10,
        "relationship_integrity": 0.10,
    }
    overall = round(sum(categories[name]["score"] * weight for name, weight in weights.items()))

    blockers: list[str] = []
    warnings: list[str] = []
    conflicts = _list(knowledge.get("conflicts"))
    if conflicts:
        blockers.append("Unresolved source conflicts are present.")
    enrichment_status = str(source.get("enrichment_status", ""))
    if enrichment_status == "CONFLICTED":
        blockers.append("Provider/module enrichment conflicts with declared registry or contract evidence.")
    elif enrichment_status == "PARTIAL":
        warnings.append("Provider/module enrichment is partial or contains unresolved joins.")
    if categories["source_integrity"]["score"] < 75:
        blockers.append("Source provenance is incomplete.")
    if not _present(purpose.get("plain_explanation")):
        blockers.append("No verified plain explanation exists.")
    if high_risk and (not confirmation_known or risk.get("human_confirmation_required") is not True):
        blockers.append("High-risk capability lacks verified required human confirmation.")
    if high_risk and (not reversibility_known or risk.get("reversibility") in (None, "", "unknown")):
        blockers.append("High-risk capability has unknown or unverified reversibility.")
    if unresolved[capability_id]:
        warnings.append(f"{unresolved[capability_id]} relationship reference(s) are unresolved.")
    if cycles[capability_id]:
        warnings.append("Capability participates in a dependency or prerequisite cycle.")
    if lifecycle.get(capability_id) in {"deprecated", "replaced", "retired"}:
        warnings.append(f"Lifecycle status is {lifecycle[capability_id]}.")
    if role_classification == "CONSUMER_ONLY_DEPENDENCY":
        warnings.append(
            "Registry role is consumer-only dependency/reference; do not present as an AXM-provided ability."
        )
    elif role_classification == "UNBOUND":
        blockers.append(
            "Registry identifier has neither a declared provider nor consumer relation."
        )

    availability = maturity.get("availability", "unknown")
    if availability == "unavailable":
        status = "unavailable"
    elif blockers:
        status = "blocked"
    elif overall >= 75 and categories["interface_readiness"]["score"] >= 50 and categories["learning_readiness"]["score"] >= 50 and categories["safety_readiness"]["score"] >= 60:
        status = "usable"
    elif overall >= 50:
        status = "conditional"
    else:
        status = "not_ready"

    return {
        "capability_id": capability_id,
        "human_name": _dict(card.get("identity")).get("human_name", ""),
        "status": status,
        "overall_score": overall,
        "categories": categories,
        "blockers": blockers,
        "warnings": warnings,
        "unknown_count": len(_list(knowledge.get("unknowns"))),
        "conflict_count": len(conflicts),
        "lifecycle_status": lifecycle.get(capability_id, "unknown"),
        "registry_role": role_classification,
        "human_surface": human_surface,
        "provider_backed": provider_backed,
    }


def build_quality_report(cards: Iterable[dict[str, Any]], graph: dict[str, Any] | None = None) -> dict[str, Any]:
    audits = [audit_card(card, graph) for card in cards]
    status_counts = Counter(item["status"] for item in audits)

    def count_at_least(category: str, threshold: int) -> int:
        return sum(item["categories"][category]["score"] >= threshold for item in audits)

    total = len(audits)
    usable = status_counts.get("usable", 0)
    all_record_coverage = round((usable / total) * 100, 2) if total else 0.0

    provider_backed_audits = [item for item in audits if item.get("provider_backed") is True]
    provider_backed_count = len(provider_backed_audits)
    provider_backed_usable = sum(item.get("status") == "usable" for item in provider_backed_audits)
    provider_backed_coverage = (
        round((provider_backed_usable / provider_backed_count) * 100, 2)
        if provider_backed_count
        else 0.0
    )
    dependency_reference_count = sum(
        item.get("registry_role") == "CONSUMER_ONLY_DEPENDENCY"
        for item in audits
    )
    provided_and_consumed_count = sum(
        item.get("registry_role") == "PROVIDED_AND_CONSUMED"
        for item in audits
    )
    provided_only_count = sum(
        item.get("registry_role") == "PROVIDED_ONLY"
        for item in audits
    )
    unbound_count = sum(item.get("registry_role") == "UNBOUND" for item in audits)
    return {
        "module": "AXM Human Capability Atlas",
        "module_version": __version__,
        "shared_contract_version": CONTRACT_VERSION,
        "operation": "human_usability_coverage_audit",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "registry_identifier_count": total,
            "capability_count": provider_backed_count,
            "provider_backed_capability_count": provider_backed_count,
            "provided_only_count": provided_only_count,
            "provided_and_consumed_count": provided_and_consumed_count,
            "consumer_only_dependency_reference_count": dependency_reference_count,
            "unbound_registry_identifier_count": unbound_count,
            "usable_count": provider_backed_usable,
            "all_record_usable_count": usable,
            "conditional_count": status_counts.get("conditional", 0),
            "blocked_count": status_counts.get("blocked", 0),
            "not_ready_count": status_counts.get("not_ready", 0),
            "unavailable_count": status_counts.get("unavailable", 0),
            "source_integrity_ready_count": count_at_least("source_integrity", 75),
            "human_explanation_ready_count": count_at_least("human_explanation", 67),
            "interface_ready_count": count_at_least("interface_readiness", 50),
            "learning_ready_count": count_at_least("learning_readiness", 50),
            "safety_ready_count": count_at_least("safety_readiness", 60),
            "relationship_integrity_ready_count": count_at_least("relationship_integrity", 100),
            "usable_capability_coverage_percent": provider_backed_coverage,
            "all_registry_record_usable_percent": all_record_coverage,
            "coverage_scope": "provider_backed_registry_identifiers_only",
        },
        "formula": {
            "usable_capability_coverage": "provider_backed_usable_count / provider_backed_capability_count * 100",
            "coverage_scope": "consumer-only dependencies/references are retained but excluded from the AXM-provided human capability denominator",
            "overall_score_weights": {
                "source_integrity": 15,
                "human_explanation": 20,
                "interface_readiness": 15,
                "learning_readiness": 15,
                "safety_readiness": 15,
                "evidence_readiness": 10,
                "relationship_integrity": 10,
            },
            "important_note": "Scores summarize explicit checks; blockers remain visible and cannot be averaged away.",
        },
        "status_counts": dict(sorted(status_counts.items())),
        "capabilities": sorted(audits, key=lambda item: (item["status"], item["overall_score"], item["capability_id"])),
        "integrity_notes": [
            "A registry identifier is not counted as an AXM-provided capability merely because it exists.",
            "Consumer-only dependencies/references remain searchable and auditable but are excluded from provider-backed human capability coverage.",
            "Unresolved conflicts, missing source provenance, and unsafe high-risk exposure act as explicit blockers.",
            "The audit is deterministic and does not rewrite capability declarations or cards.",
        ],
    }


def load_cards(path: str | Path) -> list[dict[str, Any]]:
    root = Path(path)
    if root.is_file():
        value = load_json(root)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict) and item.get("capability_id")]
        if isinstance(value, dict) and value.get("capability_id"):
            return [value]
        raise ValueError(f"No Capability Card found in {root}")
    if not root.exists():
        raise FileNotFoundError(f"Card path not found: {root}")
    paths = sorted(root.rglob("capability_card.json"))
    cards = []
    for item in paths:
        value = load_json(item)
        if isinstance(value, dict) and value.get("capability_id"):
            cards.append(value)
    return cards
