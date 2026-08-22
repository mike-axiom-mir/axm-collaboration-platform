from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any, Iterable
import json

from . import __version__, CONTRACT_VERSION
from .identity import build_identity_report, exact_fingerprint, record_key, semantic_fingerprint


def _dict(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _strings(value: Any) -> list[str]:
    result: list[str] = []
    for item in _list(value):
        if isinstance(item, (str, int, float)):
            text = str(item).strip()
            if text and text not in result:
                result.append(text)
    return sorted(result)


def _fingerprint(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return sha256(encoded.encode("utf-8")).hexdigest()


def _quality_map(quality_report: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    if not quality_report:
        return {}
    return {
        str(item.get("capability_id")): item
        for item in _list(quality_report.get("capabilities"))
        if item.get("capability_id")
    }


def build_registry_snapshot(
    records: Iterable[dict[str, Any]],
    identity_report: dict[str, Any] | None = None,
    quality_report: dict[str, Any] | None = None,
) -> dict[str, Any]:
    records = [dict(record) for record in records]
    identity_report = identity_report or build_identity_report(records)
    by_key = {record_key(record): record for record in records}
    quality = _quality_map(quality_report)
    groups = {
        group["capability_id"]: group
        for group in _list(identity_report.get("identity_groups"))
        if group.get("capability_id")
    }

    capabilities: dict[str, dict[str, Any]] = {}
    dependency_map: dict[str, list[str]] = {}
    for capability_id, selection in sorted(_dict(identity_report.get("canonical_records")).items()):
        record = by_key.get(selection.get("selected_record_key"))
        if not record:
            continue
        relationships = _dict(record.get("relationships"))
        learning = _dict(record.get("learning_profile"))
        dependencies = sorted(set(
            _strings(relationships.get("dependency_capability_ids"))
            + _strings(learning.get("prerequisite_capability_ids"))
        ))
        dependency_map[capability_id] = dependencies

        human_payload = {
            "machine_name": record.get("machine_name"),
            "human_name": record.get("human_name"),
            "description": record.get("description"),
            "why_it_matters": record.get("why_it_matters"),
            "examples": record.get("examples"),
            "category": record.get("category"),
            "tags": record.get("tags"),
        }
        interface_payload = {
            "supported_task_types": record.get("supported_task_types"),
            "typical_goals": record.get("typical_goals"),
            "required_human_actions": record.get("required_human_actions"),
            "required_machine_actions": record.get("required_machine_actions"),
            "collaboration_modes": record.get("collaboration_modes"),
            "inputs": record.get("inputs"),
            "outputs": record.get("outputs"),
            "cost_profile": record.get("cost_profile"),
            "risk_profile": record.get("risk_profile"),
            "maturity_profile": record.get("maturity_profile"),
            "learning_profile": record.get("learning_profile"),
            "interaction_profile": record.get("interaction_profile"),
            "interface_requirements": record.get("interface_requirements"),
            "relationships": record.get("relationships"),
        }
        lifecycle = _dict(record.get("lifecycle_profile"))
        aliases = _strings(record.get("aliases"))
        source_records = []
        for source in _list(_dict(groups.get(capability_id)).get("records")):
            source_records.append({
                "record_key": source.get("record_key", ""),
                "revision": source.get("revision", "unknown"),
                "source_location": source.get("source_location", ""),
                "source_pointer": source.get("source_pointer", ""),
                "source_hash": source.get("source_hash", ""),
                "semantic_fingerprint": source.get("semantic_fingerprint", ""),
            })
        source_records.sort(key=lambda item: (item["source_location"], item["source_pointer"], item["record_key"]))
        quality_item = _dict(quality.get(capability_id))
        enrichment_payload = _dict(record.get("enrichment_context"))
        registry_context = _dict(record.get("registry_context"))
        registry_role = _dict(registry_context.get("registry_role"))
        if not registry_role:
            registry_role = _dict(enrichment_payload.get("registry_role"))
        if registry_role:
            role_classification = registry_role.get("classification", "UNBOUND")
            human_surface = registry_role.get("human_surface", "REVIEW_HOLD")
            provider_backed = bool(registry_role.get("is_provider_backed", False))
        else:
            role_classification = "NON_PUBLIC_CAPABILITY"
            human_surface = "AXM_CAPABILITY"
            provider_backed = True

        capabilities[capability_id] = {
            "capability_id": capability_id,
            "canonical_record_key": record_key(record),
            "revision": str(record.get("revision") or "unknown"),
            "semantic_fingerprint": semantic_fingerprint(record),
            "exact_fingerprint": exact_fingerprint(record),
            "human_content_fingerprint": _fingerprint(human_payload),
            "interface_contract_fingerprint": _fingerprint(interface_payload),
            "relationship_fingerprint": _fingerprint({
                "relationships": relationships,
                "prerequisite_capability_ids": learning.get("prerequisite_capability_ids", []),
            }),
            "lifecycle_fingerprint": _fingerprint(lifecycle),
            "alias_fingerprint": _fingerprint(aliases),
            "aliases": aliases,
            "lifecycle_profile": lifecycle,
            "dependencies": dependencies,
            "source_records": source_records,
            "source_set_fingerprint": _fingerprint(source_records),
            "enrichment_fingerprint": _fingerprint(enrichment_payload),
            "enrichment_status": enrichment_payload.get("status", "none") if enrichment_payload else "none",
            "registry_role_fingerprint": _fingerprint(registry_role),
            "registry_role": role_classification,
            "human_surface": human_surface,
            "provider_backed": provider_backed,
            "identity_classification": _dict(groups.get(capability_id)).get("classification", "single"),
            "quality_status": quality_item.get("status", "unknown"),
            "quality_score": quality_item.get("overall_score", None),
        }

    dependents: dict[str, set[str]] = defaultdict(set)
    for capability_id, dependencies in dependency_map.items():
        for dependency in dependencies:
            if dependency in capabilities:
                dependents[dependency].add(capability_id)
    for capability_id, item in capabilities.items():
        item["direct_dependents"] = sorted(dependents.get(capability_id, set()))

    snapshot_payload = {
        "shared_contract_version": CONTRACT_VERSION,
        "capabilities": capabilities,
    }
    return {
        "module": "AXM Human Capability Atlas",
        "module_version": __version__,
        "shared_contract_version": CONTRACT_VERSION,
        "operation": "capability_registry_snapshot",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "snapshot_hash": _fingerprint(snapshot_payload),
        "summary": {
            "capability_count": len(capabilities),
            "source_record_count": len(records),
            "provider_backed_capability_count": sum(
                item.get("provider_backed") is True for item in capabilities.values()
            ),
            "consumer_only_dependency_reference_count": sum(
                item.get("registry_role") == "CONSUMER_ONLY_DEPENDENCY"
                for item in capabilities.values()
            ),
            "unbound_registry_identifier_count": sum(
                item.get("registry_role") == "UNBOUND"
                for item in capabilities.values()
            ),
            "duplicate_group_count": sum(1 for item in capabilities.values() if item["identity_classification"] != "single"),
            "dependency_edge_count": sum(len(item["dependencies"]) for item in capabilities.values()),
        },
        "capabilities": capabilities,
        "integrity_notes": [
            "Snapshot fingerprints exclude generation time and preserve deterministic comparison.",
            "Canonical selections come from the identity report and do not delete non-canonical source records.",
            "Source-only changes remain distinguishable from semantic capability changes.",
        ],
    }
