from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Iterable
import re

from . import __version__, CONTRACT_VERSION

_TOKEN = re.compile(r"[A-Za-z0-9]+(?:[_.:-][A-Za-z0-9]+)*")


def tokenize(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        result: list[str] = []
        for item in value:
            result.extend(tokenize(item))
        return result
    if isinstance(value, dict):
        result: list[str] = []
        for key, item in value.items():
            result.extend(tokenize(key))
            result.extend(tokenize(item))
        return result
    text = str(value).casefold()
    tokens: list[str] = []
    for match in _TOKEN.findall(text):
        tokens.append(match)
        for part in re.split(r"[_.:-]+", match):
            if part and part != match:
                tokens.append(part)
    return tokens


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


def _humanization_seed(card: dict[str, Any]) -> dict[str, Any]:
    source = _dict(card.get("source_reference"))
    enrichment = _dict(source.get("enrichment"))
    return _dict(enrichment.get("humanization_seed"))


def _quality_statuses(quality_report: dict[str, Any] | None) -> dict[str, str]:
    if not quality_report:
        return {}
    return {str(item.get("capability_id")): str(item.get("status")) for item in _list(quality_report.get("capabilities"))}


def build_search_index(
    cards: Iterable[dict[str, Any]],
    quality_report: dict[str, Any] | None = None,
    identity_report: dict[str, Any] | None = None,
) -> dict[str, Any]:
    cards = list(cards)
    statuses = _quality_statuses(quality_report)
    aliases_by_capability = _dict(_dict(identity_report or {}).get("aliases")).get("by_capability", {})
    postings: dict[str, dict[str, int]] = defaultdict(dict)
    records: dict[str, dict[str, Any]] = {}

    field_weights = {
        "capability_id": 10,
        "machine_name": 8,
        "human_name": 8,
        "aliases": 7,
        "categories": 5,
        "tags": 5,
        "summary": 4,
        "why": 3,
        "tasks": 3,
        "goals": 3,
        "inputs": 2,
        "outputs": 2,
        "provider_context": 1,
        "wording_candidates": 1,
    }

    for card in cards:
        capability_id = str(card["capability_id"])
        identity = _dict(card.get("identity"))
        purpose = _dict(card.get("purpose"))
        task = _dict(card.get("task_profile"))
        inputs = _dict(card.get("input_profile"))
        outputs = _dict(card.get("output_profile"))
        relationships = _dict(card.get("relationships"))
        registry_role = _registry_role(card)
        if registry_role:
            role_classification = registry_role.get("classification", "UNBOUND")
            human_surface = registry_role.get("human_surface", "REVIEW_HOLD")
            provider_backed = bool(registry_role.get("is_provider_backed", False))
        else:
            role_classification = "NON_PUBLIC_CAPABILITY"
            human_surface = "AXM_CAPABILITY"
            provider_backed = True
        seed = _humanization_seed(card)
        fields = {
            "capability_id": capability_id,
            "machine_name": identity.get("machine_name", ""),
            "human_name": identity.get("human_name", ""),
            "aliases": aliases_by_capability.get(capability_id, []),
            "categories": _list(identity.get("category")),
            "tags": _list(identity.get("tags")),
            "summary": purpose.get("plain_explanation", ""),
            "why": purpose.get("why_it_matters", ""),
            "tasks": _list(task.get("supported_task_types")),
            "goals": _list(task.get("typical_goals")),
            "inputs": _list(inputs.get("input_types")),
            "outputs": _list(outputs.get("output_types")),
            "provider_context": _list(seed.get("providers")),
            "wording_candidates": _list(seed.get("action_candidates")),
        }
        token_reasons: dict[str, list[str]] = defaultdict(list)
        for field, value in fields.items():
            weight = field_weights[field]
            for token in set(tokenize(value)):
                postings[token][capability_id] = postings[token].get(capability_id, 0) + weight
                token_reasons[token].append(field)

        records[capability_id] = {
            "capability_id": capability_id,
            "machine_name": identity.get("machine_name", ""),
            "human_name": identity.get("human_name", ""),
            "aliases": aliases_by_capability.get(capability_id, []),
            "summary": purpose.get("plain_explanation", ""),
            "categories": _list(identity.get("category")),
            "tags": _list(identity.get("tags")),
            "risk_level": _dict(card.get("risk_profile")).get("risk_level", "unknown"),
            "maturity": _dict(card.get("maturity_profile")).get("maturity", "unknown"),
            "availability": _dict(card.get("maturity_profile")).get("availability", "unknown"),
            "skill_level": _dict(card.get("learning_profile")).get("minimum_skill_level", "unknown"),
            "compute_cost": _dict(card.get("cost_profile")).get("compute_cost", "unknown"),
            "quality_status": statuses.get(capability_id, "unknown"),
            "registry_role": role_classification,
            "human_surface": human_surface,
            "provider_backed": provider_backed,
            "task_types": _list(task.get("supported_task_types")),
            "input_types": _list(inputs.get("input_types")),
            "output_types": _list(outputs.get("output_types")),
            "relationships": {
                key: _list(relationships.get(key))
                for key in [
                    "dependency_capability_ids",
                    "related_capability_ids",
                    "alternative_capability_ids",
                    "commonly_combined_capability_ids",
                ]
            },
            "token_fields": {token: sorted(set(names)) for token, names in token_reasons.items()},
        }

    facets: dict[str, dict[str, list[str]]] = {}
    for facet in [
        "risk_level", "maturity", "availability", "skill_level", "compute_cost",
        "quality_status", "registry_role", "human_surface",
    ]:
        values: dict[str, list[str]] = defaultdict(list)
        for capability_id, record in records.items():
            values[str(record.get(facet, "unknown"))].append(capability_id)
        facets[facet] = {key: sorted(value) for key, value in sorted(values.items())}

    return {
        "module": "AXM Human Capability Atlas",
        "module_version": __version__,
        "shared_contract_version": CONTRACT_VERSION,
        "operation": "deterministic_capability_search_index",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "capability_count": len(records),
            "token_count": len(postings),
            "posting_count": sum(len(value) for value in postings.values()),
        },
        "field_weights": field_weights,
        "records": records,
        "postings": {token: dict(sorted(values.items())) for token, values in sorted(postings.items())},
        "facets": facets,
        "integrity_notes": [
            "Search scores use published deterministic field weights.",
            "Aliases are indexed only when identity analysis found their ownership unambiguous.",
            "Search ranking does not alter source truth or capability maturity.",
        ],
    }


def _matches_filters(record: dict[str, Any], filters: dict[str, str] | None) -> bool:
    if not filters:
        return True
    for key, expected in filters.items():
        value = record.get(key)
        if isinstance(value, list):
            if expected not in {str(item) for item in value}:
                return False
        elif str(value) != str(expected):
            return False
    return True


def search_index(index: dict[str, Any], query: str, *, filters: dict[str, str] | None = None, limit: int = 20) -> dict[str, Any]:
    query_tokens = list(dict.fromkeys(tokenize(query)))
    records = _dict(index.get("records"))
    postings = _dict(index.get("postings"))
    scores: dict[str, int] = defaultdict(int)
    reasons: dict[str, list[str]] = defaultdict(list)
    query_folded = query.strip().casefold()

    for token in query_tokens:
        for capability_id, score in _dict(postings.get(token)).items():
            scores[capability_id] += int(score)
            fields = _dict(records.get(capability_id)).get("token_fields", {}).get(token, [])
            reasons[capability_id].append(f"token '{token}' matched {', '.join(fields) if fields else 'indexed fields'} (+{score})")

    for capability_id, record in records.items():
        if query_folded and query_folded == capability_id.casefold():
            scores[capability_id] += 100
            reasons[capability_id].append("exact capability ID match (+100)")
        if query_folded and query_folded == str(record.get("human_name", "")).casefold():
            scores[capability_id] += 80
            reasons[capability_id].append("exact human name match (+80)")
        if query_folded and query_folded in {str(alias).casefold() for alias in _list(record.get("aliases"))}:
            scores[capability_id] += 70
            reasons[capability_id].append("exact verified alias match (+70)")

    ranked = []
    for capability_id, score in scores.items():
        record = _dict(records.get(capability_id))
        if not _matches_filters(record, filters):
            continue
        ranked.append({
            "capability_id": capability_id,
            "human_name": record.get("human_name", ""),
            "summary": record.get("summary", ""),
            "score": score,
            "quality_status": record.get("quality_status", "unknown"),
            "risk_level": record.get("risk_level", "unknown"),
            "registry_role": record.get("registry_role", "UNCLASSIFIED"),
            "human_surface": record.get("human_surface", "UNKNOWN"),
            "reasons": reasons[capability_id],
        })
    ranked.sort(key=lambda item: (-item["score"], item["human_name"].casefold(), item["capability_id"]))
    return {
        "query": query,
        "tokens": query_tokens,
        "filters": filters or {},
        "result_count": len(ranked),
        "results": ranked[: max(0, limit)],
    }


def related_capabilities(index: dict[str, Any], capability_id: str, *, limit: int = 20) -> dict[str, Any]:
    records = _dict(index.get("records"))
    source = _dict(records.get(capability_id))
    if not source:
        raise KeyError(f"Capability not found in search index: {capability_id}")

    explicit: dict[str, str] = {}
    for relation, ids in _dict(source.get("relationships")).items():
        for target in _list(ids):
            explicit[str(target)] = relation

    candidates = []
    for target_id, target in records.items():
        if target_id == capability_id:
            continue
        score = 0
        reasons = []
        if target_id in explicit:
            score += 100
            reasons.append(f"explicit {explicit[target_id]} relationship (+100)")
        shared_categories = sorted(set(_list(source.get("categories"))) & set(_list(target.get("categories"))))
        shared_tags = sorted(set(_list(source.get("tags"))) & set(_list(target.get("tags"))))
        shared_tasks = sorted(set(_list(source.get("task_types"))) & set(_list(target.get("task_types"))))
        shared_inputs = sorted(set(_list(source.get("input_types"))) & set(_list(target.get("input_types"))))
        shared_outputs = sorted(set(_list(source.get("output_types"))) & set(_list(target.get("output_types"))))
        if shared_categories:
            score += 10 * len(shared_categories)
            reasons.append(f"shared categories {shared_categories} (+{10 * len(shared_categories)})")
        if shared_tags:
            score += 6 * len(shared_tags)
            reasons.append(f"shared tags {shared_tags} (+{6 * len(shared_tags)})")
        if shared_tasks:
            score += 3 * len(shared_tasks)
            reasons.append(f"shared task types {shared_tasks} (+{3 * len(shared_tasks)})")
        if shared_inputs:
            score += 2 * len(shared_inputs)
            reasons.append(f"shared input types {shared_inputs} (+{2 * len(shared_inputs)})")
        if shared_outputs:
            score += 2 * len(shared_outputs)
            reasons.append(f"shared output types {shared_outputs} (+{2 * len(shared_outputs)})")
        if score:
            candidates.append({
                "capability_id": target_id,
                "human_name": target.get("human_name", ""),
                "score": score,
                "quality_status": target.get("quality_status", "unknown"),
                "reasons": reasons,
            })
    candidates.sort(key=lambda item: (-item["score"], item["human_name"].casefold(), item["capability_id"]))
    return {
        "capability_id": capability_id,
        "result_count": len(candidates),
        "results": candidates[: max(0, limit)],
    }
