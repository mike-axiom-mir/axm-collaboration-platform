from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any, Iterable
import re
import json

from . import __version__, CONTRACT_VERSION
from .io import load_json

_LIFECYCLE_INACTIVE = {"deprecated", "replaced", "retired"}
_PROOF_RANK = {
    "unverified": 0,
    "declared": 1,
    "declared_not_runtime_proof": 1,
    "demonstrated": 2,
    "tested": 3,
    "independently_verified": 4,
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _dict(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    if value in (None, "", [], {}):
        return []
    if isinstance(value, list):
        return value
    return [value]


def _string_list(value: Any) -> list[str]:
    result: list[str] = []
    for item in _list(value):
        if isinstance(item, (str, int, float)):
            text = str(item).strip()
            if text and text not in result:
                result.append(text)
    return result


def normalized_id(value: str) -> str:
    """Case-insensitive comparison key; never used to silently rewrite the original ID."""
    return re.sub(r"\s+", "", value.strip()).casefold()


def record_key(record: dict[str, Any]) -> str:
    ref = _dict(record.get("source_reference"))
    raw = "|".join(
        [
            str(record.get("capability_id", "")),
            str(record.get("revision", "unknown")),
            str(ref.get("source_location", "")),
            str(ref.get("source_pointer", "")),
            str(ref.get("source_line", "")),
            str(ref.get("source_hash", "")),
        ]
    )
    return sha256(raw.encode("utf-8")).hexdigest()[:16]


def _stable_payload(record: dict[str, Any], *, include_revision: bool = False) -> dict[str, Any]:
    excluded = {"source_reference", "adapter_trace", "enrichment_context"}
    if not include_revision:
        excluded.add("revision")
    return {key: value for key, value in record.items() if key not in excluded}


def semantic_fingerprint(record: dict[str, Any]) -> str:
    payload = _stable_payload(record, include_revision=False)
    encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return sha256(encoded.encode("utf-8")).hexdigest()


def exact_fingerprint(record: dict[str, Any]) -> str:
    payload = _stable_payload(record, include_revision=True)
    encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return sha256(encoded.encode("utf-8")).hexdigest()


def _version_key(value: Any) -> tuple[int, ...]:
    if value in (None, "", "unknown"):
        return ()
    text = str(value).strip().lower().lstrip("v")
    numeric = re.findall(r"\d+", text)
    return tuple(int(part) for part in numeric[:8])


def _leaf_count(value: Any) -> int:
    if value in (None, "", [], {}):
        return 0
    if isinstance(value, dict):
        return sum(_leaf_count(item) for item in value.values())
    if isinstance(value, list):
        return sum(_leaf_count(item) for item in value)
    return 1


def _candidate_score(record: dict[str, Any]) -> dict[str, Any]:
    ref = _dict(record.get("source_reference"))
    maturity = _dict(record.get("maturity_profile"))
    lifecycle = _dict(record.get("lifecycle_profile"))
    confidence = float(ref.get("confidence", 0.0) or 0.0)
    proof = str(maturity.get("proof_status", "unverified"))
    revision_key = _version_key(record.get("revision"))
    completeness = _leaf_count(_stable_payload(record, include_revision=True))
    lifecycle_status = str(lifecycle.get("status", "unknown")).lower()
    active_bonus = 0 if lifecycle_status in _LIFECYCLE_INACTIVE else 1
    components = {
        "active_lifecycle": active_bonus,
        "source_confidence": round(confidence, 6),
        "proof_rank": _PROOF_RANK.get(proof, 0),
        "revision_key": list(revision_key),
        "completeness": completeness,
    }
    sort_key = (
        active_bonus,
        confidence,
        _PROOF_RANK.get(proof, 0),
        revision_key,
        completeness,
        str(ref.get("source_location", "")),
        str(ref.get("source_pointer", "")),
    )
    return {"components": components, "sort_key": sort_key}


def _classification(records: list[dict[str, Any]]) -> tuple[str, list[str]]:
    if len(records) == 1:
        return "single", ["Only one declaration uses this exact capability ID."]

    exact = {exact_fingerprint(record) for record in records}
    semantic = {semantic_fingerprint(record) for record in records}
    revisions = {str(record.get("revision") or "unknown") for record in records}

    if len(exact) == 1:
        return "exact_duplicate", ["Multiple source records are byte-equivalent after provenance fields are excluded."]
    if len(semantic) == 1 and len(revisions) > 1:
        return "revision_only", ["The declarations have equivalent semantic content but different revision labels."]
    if len(revisions) > 1 and all(value != "unknown" for value in revisions):
        return "revision_family", ["The same stable ID has multiple explicit revisions with differing content."]
    if len(revisions) == 1:
        return "conflicting_duplicate", ["The same stable ID and revision have materially different declarations."]
    return "ambiguous_duplicate", ["Multiple materially different declarations share an ID without sufficient revision evidence."]


def _source_summary(record: dict[str, Any]) -> dict[str, Any]:
    ref = _dict(record.get("source_reference"))
    lifecycle = _dict(record.get("lifecycle_profile"))
    return {
        "record_key": record_key(record),
        "capability_id": record.get("capability_id"),
        "revision": str(record.get("revision") or "unknown"),
        "machine_name": record.get("machine_name"),
        "source_location": ref.get("source_location", ""),
        "source_pointer": ref.get("source_pointer", ""),
        "source_hash": ref.get("source_hash", ""),
        "source_confidence": float(ref.get("confidence", 0.0) or 0.0),
        "semantic_fingerprint": semantic_fingerprint(record),
        "exact_fingerprint": exact_fingerprint(record),
        "aliases": _string_list(record.get("aliases")),
        "lifecycle_status": lifecycle.get("status", "unknown"),
    }


def _select_canonical(records: list[dict[str, Any]]) -> dict[str, Any]:
    ranked: list[tuple[tuple[Any, ...], dict[str, Any], dict[str, Any]]] = []
    for record in records:
        score = _candidate_score(record)
        ranked.append((score["sort_key"], record, score["components"]))
    ranked.sort(key=lambda item: item[0], reverse=True)
    selected = ranked[0]
    return {
        "selected_record_key": record_key(selected[1]),
        "selected_capability_id": selected[1].get("capability_id"),
        "selected_revision": str(selected[1].get("revision") or "unknown"),
        "selection_policy": "active lifecycle, source confidence, proof rank, revision, completeness, deterministic source tie-break",
        "score_components": selected[2],
        "ranked_candidates": [
            {
                "record_key": record_key(record),
                "revision": str(record.get("revision") or "unknown"),
                "score_components": components,
            }
            for _, record, components in ranked
        ],
        "automatic_merge_performed": False,
    }


def build_identity_report(records: Iterable[dict[str, Any]]) -> dict[str, Any]:
    records = [dict(record) for record in records]
    by_id: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_normalized_id: dict[str, set[str]] = defaultdict(set)
    by_record_key: dict[str, dict[str, Any]] = {}

    for record in records:
        capability_id = str(record.get("capability_id", "")).strip()
        if not capability_id:
            continue
        by_id[capability_id].append(record)
        by_normalized_id[normalized_id(capability_id)].add(capability_id)
        by_record_key[record_key(record)] = record

    groups: list[dict[str, Any]] = []
    canonical_records: dict[str, dict[str, Any]] = {}
    classification_counts: dict[str, int] = defaultdict(int)
    for capability_id in sorted(by_id):
        group_records = by_id[capability_id]
        classification, reasons = _classification(group_records)
        classification_counts[classification] += 1
        selection = _select_canonical(group_records)
        canonical_records[capability_id] = selection
        groups.append(
            {
                "capability_id": capability_id,
                "classification": classification,
                "reasons": reasons,
                "record_count": len(group_records),
                "records": [_source_summary(record) for record in group_records],
                "canonical_selection": selection,
                "review_required": classification in {"conflicting_duplicate", "ambiguous_duplicate"},
            }
        )

    normalized_id_collisions = {
        key: sorted(values)
        for key, values in by_normalized_id.items()
        if len(values) > 1
    }

    alias_targets: dict[str, set[str]] = defaultdict(set)
    aliases_by_capability: dict[str, list[str]] = {}
    for capability_id, group_records in by_id.items():
        values: list[str] = []
        for record in group_records:
            for alias in _string_list(record.get("aliases")):
                if alias not in values:
                    values.append(alias)
                alias_targets[normalized_id(alias)].add(capability_id)
        aliases_by_capability[capability_id] = sorted(values)

    resolved_aliases: dict[str, str] = {}
    alias_collisions: dict[str, list[str]] = {}
    alias_shadowing: list[dict[str, Any]] = []
    canonical_id_keys = {normalized_id(capability_id): capability_id for capability_id in by_id}
    for alias_key, targets in sorted(alias_targets.items()):
        if len(targets) == 1:
            target = next(iter(targets))
            shadowed = canonical_id_keys.get(alias_key)
            if shadowed and shadowed != target:
                alias_shadowing.append({"alias_key": alias_key, "alias_target": target, "canonical_id": shadowed})
            else:
                resolved_aliases[alias_key] = target
        else:
            alias_collisions[alias_key] = sorted(targets)

    lifecycle_records: list[dict[str, Any]] = []
    replacement_links: list[dict[str, str]] = []
    broken_links: list[dict[str, str]] = []
    known_ids = set(by_id)
    all_reference_keys = {normalized_id(item): item for item in known_ids}
    all_reference_keys.update({alias: target for alias, target in resolved_aliases.items()})

    def resolve(value: str) -> str | None:
        if value in known_ids:
            return value
        return all_reference_keys.get(normalized_id(value))

    for capability_id, selection in canonical_records.items():
        selected_record = by_record_key[selection["selected_record_key"]]
        profile = _dict(selected_record.get("lifecycle_profile"))
        status = str(profile.get("status", "unknown")).lower()
        replaces = _string_list(profile.get("replaces"))
        replaced_by = _string_list(profile.get("replaced_by"))
        lifecycle_records.append(
            {
                "capability_id": capability_id,
                "status": status,
                "replaces": replaces,
                "replaced_by": replaced_by,
                "deprecated_since": profile.get("deprecated_since", ""),
                "reason": profile.get("reason", ""),
            }
        )
        for target in replaces:
            resolved = resolve(target)
            if resolved:
                replacement_links.append({"from": resolved, "to": capability_id, "declared_by": capability_id, "mode": "replaces"})
            else:
                broken_links.append({"source": capability_id, "target": target, "field": "replaces"})
        for target in replaced_by:
            resolved = resolve(target)
            if resolved:
                replacement_links.append({"from": capability_id, "to": resolved, "declared_by": capability_id, "mode": "replaced_by"})
            else:
                broken_links.append({"source": capability_id, "target": target, "field": "replaced_by"})

    unique_links = {
        (item["from"], item["to"]): item
        for item in replacement_links
        if item["from"] != item["to"]
    }
    self_replacements = [item for item in replacement_links if item["from"] == item["to"]]

    reciprocal_mismatches: list[dict[str, Any]] = []
    lifecycle_by_id = {item["capability_id"]: item for item in lifecycle_records}
    for (source, target), link in sorted(unique_links.items()):
        target_record = lifecycle_by_id.get(target, {})
        source_record = lifecycle_by_id.get(source, {})
        source_points = target in source_record.get("replaced_by", [])
        target_points = source in target_record.get("replaces", [])
        if not (source_points and target_points):
            reciprocal_mismatches.append(
                {
                    "from": source,
                    "to": target,
                    "source_declares_replaced_by": source_points,
                    "target_declares_replaces": target_points,
                    "severity": "warning",
                }
            )

    report = {
        "module": "AXM Human Capability Atlas",
        "module_version": __version__,
        "shared_contract_version": CONTRACT_VERSION,
        "operation": "capability_identity_resolution",
        "generated_at": utc_now(),
        "input_record_count": len(records),
        "summary": {
            "unique_capability_id_count": len(by_id),
            "duplicate_id_group_count": len([group for group in groups if group["record_count"] > 1]),
            "exact_duplicate_group_count": classification_counts.get("exact_duplicate", 0),
            "revision_group_count": classification_counts.get("revision_family", 0) + classification_counts.get("revision_only", 0),
            "conflict_group_count": classification_counts.get("conflicting_duplicate", 0) + classification_counts.get("ambiguous_duplicate", 0),
            "normalized_id_collision_count": len(normalized_id_collisions),
            "resolved_alias_count": len(resolved_aliases),
            "alias_collision_count": len(alias_collisions),
            "alias_shadowing_count": len(alias_shadowing),
            "inactive_lifecycle_count": len([item for item in lifecycle_records if item["status"] in _LIFECYCLE_INACTIVE]),
            "replacement_link_count": len(unique_links),
            "broken_lifecycle_link_count": len(broken_links),
            "self_replacement_count": len(self_replacements),
        },
        "canonical_records": canonical_records,
        "identity_groups": groups,
        "normalized_id_collisions": normalized_id_collisions,
        "aliases": {
            "by_capability": aliases_by_capability,
            "resolved": resolved_aliases,
            "collisions": alias_collisions,
            "shadowing": alias_shadowing,
        },
        "lifecycle": {
            "records": lifecycle_records,
            "replacement_links": list(unique_links.values()),
            "broken_links": broken_links,
            "self_replacements": self_replacements,
            "reciprocal_mismatches": reciprocal_mismatches,
        },
        "integrity_notes": [
            "Original capability IDs are preserved exactly; normalized keys are comparison-only.",
            "Canonical selections are deterministic proposals and never delete or merge source records.",
            "Conflicting and ambiguous duplicate groups require human or steward review.",
            "Aliases with multiple targets or canonical-ID shadowing are withheld from automatic resolution.",
        ],
    }
    return report


def load_normalized_records(path: str | Path) -> list[dict[str, Any]]:
    root = Path(path)
    if root.is_file():
        value = load_json(root)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            return [value]
        raise ValueError(f"Unsupported JSON root in {root}")

    if not root.exists():
        raise FileNotFoundError(f"Analysis path not found: {root}")
    normalized = root / "normalized_sources"
    scan_root = normalized if normalized.is_dir() else root
    records: list[dict[str, Any]] = []
    for item in sorted(scan_root.glob("*.json")):
        value = load_json(item)
        if isinstance(value, dict) and value.get("capability_id"):
            records.append(value)
    return records
