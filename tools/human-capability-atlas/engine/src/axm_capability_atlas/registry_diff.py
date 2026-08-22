from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any

from . import __version__, CONTRACT_VERSION


def _dict(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, dict) else {}


def _transitive_dependents(snapshot: dict[str, Any], seeds: set[str]) -> list[str]:
    capabilities = _dict(snapshot.get("capabilities"))
    reverse: dict[str, set[str]] = defaultdict(set)
    for capability_id, item in capabilities.items():
        for dependency in item.get("dependencies", []):
            reverse[str(dependency)].add(str(capability_id))
    seen: set[str] = set()
    queue = deque(sorted(seeds))
    while queue:
        current = queue.popleft()
        for dependent in sorted(reverse.get(current, set())):
            if dependent not in seen and dependent not in seeds:
                seen.add(dependent)
                queue.append(dependent)
    return sorted(seen)


def compare_registry_snapshots(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    before_caps = _dict(before.get("capabilities"))
    after_caps = _dict(after.get("capabilities"))
    before_ids = set(before_caps)
    after_ids = set(after_caps)
    added = sorted(after_ids - before_ids)
    removed = sorted(before_ids - after_ids)
    common = sorted(before_ids & after_ids)

    changes: list[dict[str, Any]] = []
    unchanged: list[str] = []
    category_counts: dict[str, int] = defaultdict(int)
    id_reuse_risks: list[dict[str, Any]] = []

    for capability_id in common:
        old = _dict(before_caps[capability_id])
        new = _dict(after_caps[capability_id])
        categories: list[str] = []
        if old.get("revision") != new.get("revision"):
            categories.append("revision_changed")
        if old.get("semantic_fingerprint") != new.get("semantic_fingerprint"):
            categories.append("semantic_changed")
        if old.get("human_content_fingerprint") != new.get("human_content_fingerprint"):
            categories.append("human_content_changed")
        if old.get("interface_contract_fingerprint") != new.get("interface_contract_fingerprint"):
            categories.append("interface_contract_changed")
        if old.get("relationship_fingerprint") != new.get("relationship_fingerprint"):
            categories.append("relationships_changed")
        if old.get("lifecycle_fingerprint") != new.get("lifecycle_fingerprint"):
            categories.append("lifecycle_changed")
        if old.get("alias_fingerprint") != new.get("alias_fingerprint"):
            categories.append("aliases_changed")
        if old.get("source_set_fingerprint") != new.get("source_set_fingerprint"):
            categories.append("source_set_changed")
        if old.get("enrichment_fingerprint") != new.get("enrichment_fingerprint"):
            categories.append("enrichment_context_changed")
        if old.get("registry_role_fingerprint") != new.get("registry_role_fingerprint"):
            categories.append("registry_role_changed")
        if old.get("quality_status") != new.get("quality_status") or old.get("quality_score") != new.get("quality_score"):
            categories.append("quality_changed")

        if not categories:
            unchanged.append(capability_id)
            continue
        for category in categories:
            category_counts[category] += 1
        reuse_risk = (
            "semantic_changed" in categories
            and old.get("revision") == new.get("revision")
        )
        if reuse_risk:
            id_reuse_risks.append({
                "capability_id": capability_id,
                "revision": new.get("revision", "unknown"),
                "reason": "Semantic content changed while the declared revision remained the same.",
            })
        changes.append({
            "capability_id": capability_id,
            "categories": categories,
            "before_revision": old.get("revision", "unknown"),
            "after_revision": new.get("revision", "unknown"),
            "before_quality_status": old.get("quality_status", "unknown"),
            "after_quality_status": new.get("quality_status", "unknown"),
            "id_reuse_risk": reuse_risk,
        })

    changed_ids = {item["capability_id"] for item in changes}
    semantic_changed = {item["capability_id"] for item in changes if "semantic_changed" in item["categories"]}
    human_changed = {item["capability_id"] for item in changes if "human_content_changed" in item["categories"]}
    interface_changed = {item["capability_id"] for item in changes if "interface_contract_changed" in item["categories"]}
    relationship_changed = {item["capability_id"] for item in changes if "relationships_changed" in item["categories"]}
    enrichment_changed = {item["capability_id"] for item in changes if "enrichment_context_changed" in item["categories"]}
    registry_role_changed = {item["capability_id"] for item in changes if "registry_role_changed" in item["categories"]}
    identity_changed = {
        item["capability_id"]
        for item in changes
        if any(category in item["categories"] for category in ["revision_changed", "lifecycle_changed", "aliases_changed"])
    }
    source_only = sorted(
        item["capability_id"]
        for item in changes
        if set(item["categories"]) <= {"source_set_changed"}
    )

    affected_after = _transitive_dependents(after, semantic_changed | interface_changed | relationship_changed | set(added))
    affected_before = _transitive_dependents(before, set(removed))
    affected_dependents = sorted(set(affected_after) | set(affected_before))

    rebuild_cards = sorted(
        set(added) | semantic_changed | human_changed | enrichment_changed | registry_role_changed
    )
    rebuild_learning = sorted(set(added) | semantic_changed | relationship_changed | set(affected_dependents))
    rerun_interface = sorted(
        set(added) | set(removed) | semantic_changed | interface_changed
        | relationship_changed | enrichment_changed | registry_role_changed
        | set(affected_dependents)
    )
    rerun_identity = bool(added or removed or identity_changed)
    rerun_graph = bool(added or removed or relationship_changed or identity_changed)

    return {
        "module": "AXM Human Capability Atlas",
        "module_version": __version__,
        "shared_contract_version": CONTRACT_VERSION,
        "operation": "capability_registry_diff",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "before_snapshot_hash": before.get("snapshot_hash", ""),
        "after_snapshot_hash": after.get("snapshot_hash", ""),
        "summary": {
            "before_capability_count": len(before_ids),
            "after_capability_count": len(after_ids),
            "added_count": len(added),
            "removed_count": len(removed),
            "changed_count": len(changes),
            "unchanged_count": len(unchanged),
            "source_only_change_count": len(source_only),
            "id_reuse_risk_count": len(id_reuse_risks),
            "affected_dependent_count": len(affected_dependents),
        },
        "category_counts": dict(sorted(category_counts.items())),
        "added": added,
        "removed": removed,
        "changed": changes,
        "unchanged": unchanged,
        "source_only_changes": source_only,
        "id_reuse_risks": id_reuse_risks,
        "impact": {
            "affected_dependents": affected_dependents,
            "affected_from_changed_or_added": affected_after,
            "affected_from_removed": affected_before,
        },
        "rebuild_plan": {
            "rebuild_capability_cards": rebuild_cards,
            "rebuild_learning_outputs": rebuild_learning,
            "rerun_human_interface_intelligence": rerun_interface,
            "remove_generated_outputs": removed,
            "rerun_identity_analysis": rerun_identity,
            "rerun_relationship_graph": rerun_graph,
            "manual_id_reuse_review": [item["capability_id"] for item in id_reuse_risks],
            "no_rebuild_needed_for_source_only_changes": source_only,
        },
        "integrity_notes": [
            "The diff produces a plan only and performs no file deletion, merge, or local mutation.",
            "Semantic changes under an unchanged revision are flagged as possible stable-ID reuse or missing version updates.",
            "Dependent capabilities are included so downstream courses and interface recommendations can be rechecked.",
            "Provenance-only changes are separated from capability meaning changes.",
            "Provider-backed vs consumer-only registry-role changes are tracked explicitly because they change human presentation and coverage scope.",
        ],
    }
