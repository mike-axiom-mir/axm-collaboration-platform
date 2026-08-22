from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import re
from typing import Any

from .canonical_json import canonical_sha256
from .constants import (
    CONTRACT_VERSION,
    UNKNOWN_TEXT,
    DEFAULT_COST_PROFILE,
    DEFAULT_RISK_PROFILE,
    DEFAULT_MATURITY_PROFILE,
)


def _hash_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _title_from_machine(machine_name: str) -> str:
    words = re.sub(r"[_\-.]+", " ", machine_name).strip().split()
    return " ".join(
        word.upper() if len(word) <= 3 and word.isupper() else word.capitalize()
        for word in words
    )


def _list(value) -> list:
    return value if isinstance(value, list) else []


def _dict(value) -> dict:
    return value if isinstance(value, dict) else {}


def _evidence_reference(source_ref: dict[str, Any], field: str = "") -> dict[str, Any]:
    return {
        "source_location": source_ref.get("source_location", ""),
        "source_hash": source_ref.get("source_hash", ""),
        "source_pointer": source_ref.get("source_pointer", ""),
        "field": field,
    }


def _shared_field_path(path: str) -> str:
    mapping = {
        "/machine_name": "/identity/machine_name",
        "/human_name": "/identity/human_name",
        "/description": "/purpose/plain_explanation",
        "/why_it_matters": "/purpose/why_it_matters",
        "/examples": "/purpose/example_uses",
    }
    return mapping.get(path, path)


def _inference(
    *,
    field: str,
    value: Any,
    rule: str,
    reasoning: str,
    source_basis: Any,
    confidence: float,
    evidence_reference: Any,
    origin: str = "atlas",
) -> dict[str, Any]:
    return {
        "field": field,
        "value": value,
        "rule": rule,
        "reasoning": reasoning,
        "source_basis": source_basis,
        "confidence": float(max(0.0, min(1.0, confidence))),
        "evidence_reference": evidence_reference,
        "origin": origin,
    }


def _known_or_unknown(value, pointer: str, states: dict, unknowns: list[str]):
    if value not in (None, "", [], {}):
        states[pointer] = "known"
        return value
    states[pointer] = "unknown"
    unknowns.append(pointer)
    return UNKNOWN_TEXT


def _state_from_explicit(value: Any) -> str:
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"unknown", "unverified"}:
            return "unknown"
        if normalized in {"not_applicable", "not applicable", "n/a"}:
            return "not_applicable"
    return "known"


def _mark_profile(
    source_profile: dict[str, Any],
    prefix: str,
    keys: list[str],
    states: dict[str, str],
    unknowns: list[str],
) -> None:
    for key in keys:
        pointer = f"{prefix}/{key}"
        if key in source_profile:
            state = _state_from_explicit(source_profile.get(key))
            states.setdefault(pointer, state)
            if state == "unknown":
                unknowns.append(pointer)
        else:
            states.setdefault(pointer, "unknown")
            unknowns.append(pointer)


def _normalize_adapter_inference(
    raw: dict[str, Any],
    source_ref: dict[str, Any],
    detection_confidence: float,
) -> dict[str, Any]:
    field = _shared_field_path(str(raw.get("field", "")))
    rule = str(raw.get("rule", "source_adapter_inference"))
    source_field = raw.get("source_field")
    source_pointer = raw.get("source_pointer")
    basis = {
        "source_field": source_field or "",
        "source_pointer": source_pointer or source_ref.get("source_pointer", ""),
        "adapter_rule": rule,
    }
    return _inference(
        field=field,
        value=raw.get("value"),
        rule=rule,
        reasoning=(
            f"Source adapter deterministically derived {field or 'a normalized field'} "
            f"using rule {rule!r}; this derivation does not create new technical capability."
        ),
        source_basis=basis,
        confidence=float(raw.get("confidence", detection_confidence)),
        evidence_reference=_evidence_reference(
            source_ref,
            str(source_field or source_pointer or ""),
        ),
        origin="source_adapter",
    )


def build_card(source: dict, source_path: str | Path | None = None) -> dict:
    states: dict[str, str] = {}
    inferences: list[dict] = []
    unknowns: list[str] = []
    conflicts: list[dict] = []

    p = Path(source_path) if source_path else None
    source_ref = _dict(source.get("source_reference"))
    source_hash = source_ref.get("source_hash") or (
        _hash_file(p) if p and p.exists() else ""
    )
    source_location = source_ref.get("source_location") or (str(p) if p else "")
    source_ref = {
        **source_ref,
        "source_type": source_ref.get("source_type", "manifest"),
        "source_location": source_location,
        "source_hash": source_hash,
        "last_verified_at": source_ref.get("last_verified_at")
        or datetime.now(timezone.utc).isoformat(),
        "confidence": float(source_ref.get("confidence", 1.0 if p else 0.8)),
    }

    enrichment = _dict(source.get("enrichment_context"))
    if enrichment:
        source_ref["enrichment"] = enrichment
        source_ref["enrichment_hash"] = enrichment.get("enrichment_hash") or canonical_sha256(enrichment)
        source_ref["enrichment_catalog_hash"] = enrichment.get("catalog_hash", source_ref.get("enrichment_catalog_hash", ""))
        source_ref["enrichment_source_seal_hash"] = enrichment.get("source_seal_hash", source_ref.get("enrichment_source_seal_hash", ""))
        source_ref["enrichment_sources"] = _list(enrichment.get("evidence_sources"))

    machine_name = source["machine_name"]
    states["/identity/machine_name"] = "known"

    human_name = source.get("human_name")
    if human_name:
        states["/identity/human_name"] = "known"
    else:
        human_name = _title_from_machine(machine_name)
        states["/identity/human_name"] = "inferred"
        inferences.append(
            _inference(
                field="/identity/human_name",
                value=human_name,
                rule="title_from_machine_name",
                reasoning=(
                    "No human_name was declared. A display-only human label was "
                    "deterministically derived from machine_name for readability. "
                    "This does not rename the technical capability."
                ),
                source_basis={"field": "/machine_name", "value": machine_name},
                confidence=0.65,
                evidence_reference=_evidence_reference(source_ref, "/machine_name"),
            )
        )

    states["/capability_id"] = "known"
    revision_value = source.get("revision")
    if revision_value in (None, ""):
        states["/capability_revision"] = "unknown"
        unknowns.append("/capability_revision")
    else:
        states["/capability_revision"] = "known"

    adapter_trace = _dict(source.get("adapter_trace"))
    detection_confidence = float(
        adapter_trace.get("detection_confidence", source_ref.get("confidence", 0.5))
    )
    for raw_inference in _list(adapter_trace.get("inferences")):
        if not isinstance(raw_inference, dict):
            continue
        normalized = _normalize_adapter_inference(
            raw_inference, source_ref, detection_confidence
        )
        inferences.append(normalized)
        if normalized["field"]:
            states[normalized["field"]] = "inferred"

    description = _known_or_unknown(
        source.get("description"),
        "/purpose/plain_explanation",
        states,
        unknowns,
    )
    why = _known_or_unknown(
        source.get("why_it_matters"),
        "/purpose/why_it_matters",
        states,
        unknowns,
    )

    examples = _list(source.get("examples"))
    states["/purpose/example_uses"] = "known" if examples else "unknown"
    if not examples:
        unknowns.append("/purpose/example_uses")

    inputs = _dict(source.get("inputs"))
    outputs = _dict(source.get("outputs"))
    source_cost = _dict(source.get("cost_profile"))
    source_risk = _dict(source.get("risk_profile"))
    source_maturity = _dict(source.get("maturity_profile"))
    learning = _dict(source.get("learning_profile"))
    interaction = _dict(source.get("interaction_profile"))
    interface = _dict(source.get("interface_requirements"))
    relationships = _dict(source.get("relationships"))

    cost = {**deepcopy(DEFAULT_COST_PROFILE), **source_cost}
    risk = {**deepcopy(DEFAULT_RISK_PROFILE), **source_risk}
    maturity = {**deepcopy(DEFAULT_MATURITY_PROFILE), **source_maturity}

    _mark_profile(
        inputs,
        "/input_profile",
        ["input_types", "required_inputs", "optional_inputs", "input_constraints"],
        states,
        unknowns,
    )
    _mark_profile(
        outputs,
        "/output_profile",
        ["output_types", "expected_outputs", "output_constraints", "preview_available"],
        states,
        unknowns,
    )
    _mark_profile(
        source_cost,
        "/cost_profile",
        list(DEFAULT_COST_PROFILE),
        states,
        unknowns,
    )
    _mark_profile(
        source_risk,
        "/risk_profile",
        list(DEFAULT_RISK_PROFILE),
        states,
        unknowns,
    )
    _mark_profile(
        source_maturity,
        "/maturity_profile",
        list(DEFAULT_MATURITY_PROFILE),
        states,
        unknowns,
    )
    _mark_profile(
        learning,
        "/learning_profile",
        [
            "minimum_skill_level",
            "prerequisite_capability_ids",
            "recommended_learning_steps",
            "beginner_safe_operations",
            "advanced_operations",
            "common_mistakes",
        ],
        states,
        unknowns,
    )
    _mark_profile(
        interaction,
        "/interaction_profile",
        [
            "interaction_complexity",
            "interaction_frequency",
            "precision_requirement",
            "feedback_requirement",
            "preferred_input_methods",
            "preferred_output_methods",
            "accessibility_considerations",
        ],
        states,
        unknowns,
    )
    _mark_profile(
        interface,
        "/interface_requirements",
        [
            "required_interface_features",
            "optional_interface_features",
            "unsafe_interface_patterns",
            "beginner_layer_constraints",
            "advanced_layer_requirements",
        ],
        states,
        unknowns,
    )
    _mark_profile(
        relationships,
        "/relationships",
        [
            "dependency_capability_ids",
            "related_capability_ids",
            "alternative_capability_ids",
            "commonly_combined_capability_ids",
        ],
        states,
        unknowns,
    )

    for top_key, pointer in [
        ("supported_task_types", "/task_profile/supported_task_types"),
        ("typical_goals", "/task_profile/typical_goals"),
        ("required_human_actions", "/task_profile/required_human_actions"),
        ("required_machine_actions", "/task_profile/required_machine_actions"),
        ("collaboration_modes", "/task_profile/collaboration_modes"),
    ]:
        if top_key in source:
            states.setdefault(pointer, "known")
        else:
            states.setdefault(pointer, "unknown")
            unknowns.append(pointer)

    # Provider/module enrichment is contextual evidence. It is intentionally
    # carried inside source_reference rather than silently promoted into
    # capability-specific input/output/relationship claims.
    if enrichment:
        enrichment_status = str(enrichment.get("status", "PARTIAL"))
        enrichment_pointer = "/source_reference/enrichment"
        if enrichment_status == "VERIFIED":
            states[enrichment_pointer] = "known"
        elif enrichment_status == "CONFLICTED":
            states[enrichment_pointer] = "conflicted"
            conflicts.append({
                "field": enrichment_pointer,
                "declared": "provider/consumer registry relation",
                "observed": "provider/module contract mismatch",
                "evidence_reference": {
                    "enrichment_hash": enrichment.get("enrichment_hash", ""),
                    "catalog_hash": enrichment.get("catalog_hash", ""),
                },
            })
        else:
            states[enrichment_pointer] = "unknown"
            unknowns.append(enrichment_pointer)

    # Preserve explicit source-vs-observation conflicts.
    for evidence in _list(source.get("observed_evidence")):
        if not isinstance(evidence, dict):
            continue
        field = evidence.get("field")
        observed = evidence.get("observed")
        declared = evidence.get("declared")
        if field and declared != observed:
            states[str(field)] = "conflicted"
            conflicts.append(
                {
                    "field": field,
                    "declared": declared,
                    "observed": observed,
                    "evidence_reference": evidence.get("evidence_reference", ""),
                }
            )
            if field in unknowns:
                unknowns.remove(field)

    card = {
        "contract_version": CONTRACT_VERSION,
        "capability_id": source["capability_id"],
        "capability_revision": str(source.get("revision") or "unknown"),
        "source_reference": source_ref,
        "identity": {
            "machine_name": machine_name,
            "human_name": human_name,
            "category": _list(source.get("category")),
            "tags": _list(source.get("tags")),
        },
        "purpose": {
            "plain_explanation": description,
            "why_it_matters": why,
            "example_uses": examples,
        },
        "task_profile": {
            "supported_task_types": _list(source.get("supported_task_types")),
            "typical_goals": _list(source.get("typical_goals")),
            "required_human_actions": _list(source.get("required_human_actions")),
            "required_machine_actions": _list(source.get("required_machine_actions")),
            "collaboration_modes": _list(source.get("collaboration_modes")),
        },
        "input_profile": {
            "input_types": _list(inputs.get("input_types")),
            "required_inputs": _list(inputs.get("required_inputs")),
            "optional_inputs": _list(inputs.get("optional_inputs")),
            "input_constraints": _list(inputs.get("input_constraints")),
        },
        "output_profile": {
            "output_types": _list(outputs.get("output_types")),
            "expected_outputs": _list(outputs.get("expected_outputs")),
            "output_constraints": _list(outputs.get("output_constraints")),
            "preview_available": outputs.get("preview_available", "UNKNOWN"),
        },
        "cost_profile": cost,
        "risk_profile": risk,
        "maturity_profile": maturity,
        "learning_profile": {
            "minimum_skill_level": learning.get("minimum_skill_level", "unknown"),
            "prerequisite_capability_ids": _list(
                learning.get("prerequisite_capability_ids")
            ),
            "recommended_learning_steps": _list(
                learning.get("recommended_learning_steps")
            ),
            "beginner_safe_operations": _list(
                learning.get("beginner_safe_operations")
            ),
            "advanced_operations": _list(learning.get("advanced_operations")),
            "common_mistakes": _list(learning.get("common_mistakes")),
        },
        "interaction_profile": {
            "interaction_complexity": interaction.get(
                "interaction_complexity", "unknown"
            ),
            "interaction_frequency": interaction.get(
                "interaction_frequency", "unknown"
            ),
            "precision_requirement": interaction.get(
                "precision_requirement", "unknown"
            ),
            "feedback_requirement": interaction.get(
                "feedback_requirement", "unknown"
            ),
            "preferred_input_methods": _list(
                interaction.get("preferred_input_methods")
            ),
            "preferred_output_methods": _list(
                interaction.get("preferred_output_methods")
            ),
            "accessibility_considerations": _list(
                interaction.get("accessibility_considerations")
            ),
        },
        "interface_requirements": {
            "required_interface_features": _list(
                interface.get("required_interface_features")
            ),
            "optional_interface_features": _list(
                interface.get("optional_interface_features")
            ),
            "unsafe_interface_patterns": _list(
                interface.get("unsafe_interface_patterns")
            ),
            "beginner_layer_constraints": _list(
                interface.get("beginner_layer_constraints")
            ),
            "advanced_layer_requirements": _list(
                interface.get("advanced_layer_requirements")
            ),
        },
        "relationships": {
            "dependency_capability_ids": _list(
                relationships.get("dependency_capability_ids")
            ),
            "related_capability_ids": _list(
                relationships.get("related_capability_ids")
            ),
            "alternative_capability_ids": _list(
                relationships.get("alternative_capability_ids")
            ),
            "commonly_combined_capability_ids": _list(
                relationships.get("commonly_combined_capability_ids")
            ),
        },
        "knowledge": {
            "field_states": dict(sorted(states.items())),
            "inferences": inferences,
            "unknowns": sorted(set(unknowns)),
            "conflicts": conflicts,
        },
    }
    return card
