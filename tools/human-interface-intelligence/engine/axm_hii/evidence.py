from __future__ import annotations

from typing import Any


def evidence_report(capability: dict[str, Any]) -> dict[str, Any]:
    facts = [
        f"Declared task types: {', '.join(capability['task_profile']['supported_task_types']) or 'none'}.",
        f"Declared input types: {', '.join(capability['input_profile']['input_types']) or 'none'}.",
        f"Declared output types: {', '.join(capability['output_profile']['output_types']) or 'none'}.",
        f"Risk level: {capability['risk_profile']['risk_level']}.",
        f"Reversibility: {capability['risk_profile']['reversibility']}.",
        f"Proof status: {capability['maturity_profile']['proof_status']}.",
    ]
    inferences: list[str] = []
    unknowns: list[str] = []
    conflicts: list[str] = []
    sources = [capability["source_reference"]]
    for annotation in capability.get("evidence_annotations", []):
        path = annotation["path"].lstrip("/").replace("/", ".")
        state = annotation["state"]
        if state == "INFERRED":
            inferences.append(f"{path}: {annotation['reasoning']}")
        elif state == "UNKNOWN":
            unknowns.append(path)
        elif state == "CONFLICTED":
            conflicts.append(f"{path}: {annotation['reasoning']}")
        sources.extend(annotation.get("source_basis", []))

    deduped_sources: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for source in sources:
        key = (source.get("source_type", ""), source.get("source_location", ""), source.get("source_hash", ""))
        if key not in seen:
            seen.add(key)
            deduped_sources.append(source)

    return {
        "facts_used": facts,
        "inferences_used": inferences,
        "unknowns": unknowns,
        "conflicts": conflicts,
        "source_references": deduped_sources,
    }
