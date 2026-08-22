from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
import json

from . import __version__, CONTRACT_VERSION
from .identity import build_identity_report, normalized_id, record_key


def _dict(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    if value in (None, "", [], {}):
        return []
    return value if isinstance(value, list) else [value]


def _strings(value: Any) -> list[str]:
    result: list[str] = []
    for item in _list(value):
        if isinstance(item, (str, int, float)):
            text = str(item).strip()
            if text and text not in result:
                result.append(text)
    return result


def _tarjan(nodes: list[str], adjacency: dict[str, set[str]]) -> list[list[str]]:
    index = 0
    stack: list[str] = []
    on_stack: set[str] = set()
    indices: dict[str, int] = {}
    low: dict[str, int] = {}
    components: list[list[str]] = []

    def strongconnect(node: str) -> None:
        nonlocal index
        indices[node] = index
        low[node] = index
        index += 1
        stack.append(node)
        on_stack.add(node)

        for target in sorted(adjacency.get(node, set())):
            if target not in indices:
                strongconnect(target)
                low[node] = min(low[node], low[target])
            elif target in on_stack:
                low[node] = min(low[node], indices[target])

        if low[node] == indices[node]:
            component: list[str] = []
            while True:
                target = stack.pop()
                on_stack.remove(target)
                component.append(target)
                if target == node:
                    break
            if len(component) > 1 or node in adjacency.get(node, set()):
                components.append(sorted(component))

    for node in sorted(nodes):
        if node not in indices:
            strongconnect(node)
    return sorted(components, key=lambda item: (len(item), item))


def _topological(nodes: list[str], adjacency: dict[str, set[str]]) -> tuple[list[str], list[str]]:
    # Edges are capability -> dependency. For a learning/build order, dependencies come first.
    reverse: dict[str, set[str]] = defaultdict(set)
    dependency_count = {node: 0 for node in nodes}
    for node in nodes:
        for dependency in adjacency.get(node, set()):
            if dependency in dependency_count and dependency != node:
                dependency_count[node] += 1
                reverse[dependency].add(node)
    queue = deque(sorted(node for node, count in dependency_count.items() if count == 0))
    order: list[str] = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for dependent in sorted(reverse.get(node, set())):
            dependency_count[dependent] -= 1
            if dependency_count[dependent] == 0:
                queue.append(dependent)
    blocked = sorted(node for node, count in dependency_count.items() if count > 0)
    return order, blocked


def build_capability_graph(
    records: Iterable[dict[str, Any]],
    identity_report: dict[str, Any] | None = None,
) -> dict[str, Any]:
    records = [dict(record) for record in records]
    identity_report = identity_report or build_identity_report(records)
    by_key = {record_key(record): record for record in records}
    canonical: dict[str, dict[str, Any]] = {}
    for capability_id, selection in identity_report["canonical_records"].items():
        selected = by_key.get(selection["selected_record_key"])
        if selected is not None:
            canonical[capability_id] = selected

    exact_ids = set(canonical)
    normalized_unique: dict[str, str] = {}
    normalized_collisions = identity_report.get("normalized_id_collisions", {})
    for capability_id in exact_ids:
        key = normalized_id(capability_id)
        if key not in normalized_collisions:
            normalized_unique[key] = capability_id
    aliases = identity_report.get("aliases", {}).get("resolved", {})

    def resolve(reference: str) -> tuple[str | None, str]:
        if reference in exact_ids:
            return reference, "exact"
        key = normalized_id(reference)
        if key in aliases:
            return aliases[key], "alias"
        if key in normalized_unique:
            return normalized_unique[key], "normalized_id"
        return None, "unresolved"

    nodes: list[dict[str, Any]] = []
    lifecycle_status: dict[str, str] = {}
    for capability_id in sorted(canonical):
        record = canonical[capability_id]
        lifecycle = _dict(record.get("lifecycle_profile"))
        status = str(lifecycle.get("status", "unknown")).lower()
        lifecycle_status[capability_id] = status
        nodes.append(
            {
                "capability_id": capability_id,
                "revision": str(record.get("revision") or "unknown"),
                "machine_name": record.get("machine_name", ""),
                "human_name": record.get("human_name", ""),
                "lifecycle_status": status,
                "canonical_record_key": record_key(record),
            }
        )

    relation_fields = {
        "dependency": ("relationships", "dependency_capability_ids"),
        "related": ("relationships", "related_capability_ids"),
        "alternative": ("relationships", "alternative_capability_ids"),
        "combined": ("relationships", "commonly_combined_capability_ids"),
        "prerequisite": ("learning_profile", "prerequisite_capability_ids"),
    }
    edges: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []
    self_references: list[dict[str, Any]] = []
    deprecated_targets: list[dict[str, Any]] = []
    adjacency: dict[str, set[str]] = defaultdict(set)

    seen_edges: set[tuple[str, str, str]] = set()
    for source, record in canonical.items():
        for edge_type, (profile_name, field_name) in relation_fields.items():
            for raw_target in _strings(_dict(record.get(profile_name)).get(field_name)):
                target, resolution = resolve(raw_target)
                if target is None:
                    unresolved.append(
                        {
                            "source": source,
                            "reference": raw_target,
                            "edge_type": edge_type,
                            "field": f"/{profile_name}/{field_name}",
                        }
                    )
                    continue
                item = {
                    "source": source,
                    "target": target,
                    "edge_type": edge_type,
                    "declared_reference": raw_target,
                    "resolution": resolution,
                }
                key = (source, target, edge_type)
                if key not in seen_edges:
                    seen_edges.add(key)
                    edges.append(item)
                if source == target:
                    self_references.append(item)
                if lifecycle_status.get(target) in {"deprecated", "replaced", "retired"}:
                    deprecated_targets.append({**item, "target_lifecycle_status": lifecycle_status[target]})
                if edge_type in {"dependency", "prerequisite"}:
                    adjacency[source].add(target)

    for link in identity_report.get("lifecycle", {}).get("replacement_links", []):
        source = link.get("from")
        target = link.get("to")
        if source in exact_ids and target in exact_ids:
            key = (source, target, "replacement")
            if key not in seen_edges:
                seen_edges.add(key)
                edges.append(
                    {
                        "source": source,
                        "target": target,
                        "edge_type": "replacement",
                        "declared_reference": target,
                        "resolution": "identity_report",
                    }
                )

    node_ids = sorted(exact_ids)
    cycles = _tarjan(node_ids, adjacency)
    topological_order, topological_blocked = _topological(node_ids, adjacency)

    incoming: dict[str, set[str]] = defaultdict(set)
    outgoing: dict[str, set[str]] = defaultdict(set)
    dependents: dict[str, set[str]] = defaultdict(set)
    for edge in edges:
        source, target = edge["source"], edge["target"]
        outgoing[source].add(target)
        incoming[target].add(source)
        if edge["edge_type"] in {"dependency", "prerequisite"}:
            dependents[target].add(source)

    isolated = sorted(node for node in node_ids if not incoming[node] and not outgoing[node])
    roots = sorted(node for node in node_ids if not adjacency.get(node))
    highest_impact = sorted(
        (
            {"capability_id": node, "direct_dependent_count": len(dependents[node])}
            for node in node_ids
        ),
        key=lambda item: (-item["direct_dependent_count"], item["capability_id"]),
    )

    edge_type_counts: dict[str, int] = defaultdict(int)
    for edge in edges:
        edge_type_counts[edge["edge_type"]] += 1

    return {
        "module": "AXM Human Capability Atlas",
        "module_version": __version__,
        "shared_contract_version": CONTRACT_VERSION,
        "operation": "capability_relationship_graph",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "unresolved_reference_count": len(unresolved),
            "self_reference_count": len(self_references),
            "dependency_cycle_count": len(cycles),
            "cycle_node_count": len({node for cycle in cycles for node in cycle}),
            "deprecated_target_reference_count": len(deprecated_targets),
            "isolated_node_count": len(isolated),
            "topological_blocked_count": len(topological_blocked),
        },
        "edge_type_counts": dict(sorted(edge_type_counts.items())),
        "nodes": nodes,
        "edges": sorted(edges, key=lambda item: (item["source"], item["edge_type"], item["target"])),
        "integrity": {
            "unresolved_references": unresolved,
            "self_references": self_references,
            "dependency_cycles": cycles,
            "deprecated_target_references": deprecated_targets,
        },
        "navigation": {
            "dependency_roots": roots,
            "topological_order": topological_order,
            "topological_blocked": topological_blocked,
            "isolated_capabilities": isolated,
            "highest_direct_impact": highest_impact,
            "dependents": {key: sorted(value) for key, value in sorted(dependents.items()) if value},
        },
        "integrity_notes": [
            "Dependency and prerequisite cycles are reported, not automatically broken.",
            "Alias resolution is used only when the identity report found one unambiguous target.",
            "Missing references remain explicit and are never synthesized as capability records.",
            "Canonical source selection is a read-only analysis proposal.",
        ],
    }


def save_analysis(records: list[dict[str, Any]], output_dir: str | Path) -> tuple[dict[str, Any], dict[str, Any]]:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    identity = build_identity_report(records)
    graph = build_capability_graph(records, identity)
    (output / "identity_report.json").write_text(json.dumps(identity, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (output / "capability_graph.json").write_text(json.dumps(graph, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return identity, graph
