"""Detached AXM Requirement Traceability Graph v0.1.0."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Mapping
import copy
import json

NODE_TYPES = ("GOAL", "REQUIREMENT", "DESIGN", "CHANGED_PATH", "TEST", "EVIDENCE", "FAILURE", "APPROVAL", "RELEASE_DECISION")
RELATIONS = ("DERIVES", "IMPLEMENTS", "CHANGES", "TESTS", "PRODUCES_EVIDENCE_FOR", "EXPOSES_FAILURE_IN", "APPROVES", "INFORMS_RELEASE", "DEPENDS_ON", "REFUTES")

class TraceabilityGraphError(ValueError):
    """The trace graph operation violates the append-only contract."""

class DuplicateTraceIdentityError(TraceabilityGraphError):
    """A node or edge identity already exists."""

class CorruptTraceGraphError(TraceabilityGraphError):
    """Stored graph events are invalid."""

def _text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise TraceabilityGraphError(f"{field} must be a non-empty string")
    return value.strip()

def validate_node(node: Mapping[str, Any]) -> Dict[str, Any]:
    if not isinstance(node, Mapping):
        raise TraceabilityGraphError("node must be an object")
    item = copy.deepcopy(dict(node))
    item["node_id"] = _text(item.get("node_id"), "node_id")
    item["label"] = _text(item.get("label"), "label")
    node_type = _text(item.get("node_type"), "node_type").upper()
    if node_type not in NODE_TYPES:
        raise TraceabilityGraphError(f"unsupported node_type: {node_type}")
    item["node_type"] = node_type
    item.setdefault("metadata", {})
    if not isinstance(item["metadata"], Mapping):
        raise TraceabilityGraphError("metadata must be an object")
    item["metadata"] = copy.deepcopy(dict(item["metadata"]))
    item["schema_version"] = "axm.verify.trace-node/0.1"
    return item

def validate_edge(edge: Mapping[str, Any]) -> Dict[str, Any]:
    if not isinstance(edge, Mapping):
        raise TraceabilityGraphError("edge must be an object")
    item = copy.deepcopy(dict(edge))
    for field in ("edge_id", "from_id", "to_id"):
        item[field] = _text(item.get(field), field)
    relation = _text(item.get("relation"), "relation").upper()
    if relation not in RELATIONS:
        raise TraceabilityGraphError(f"unsupported relation: {relation}")
    item["relation"] = relation
    item.setdefault("metadata", {})
    if not isinstance(item["metadata"], Mapping):
        raise TraceabilityGraphError("metadata must be an object")
    item["metadata"] = copy.deepcopy(dict(item["metadata"]))
    item["schema_version"] = "axm.verify.trace-edge/0.1"
    return item

@dataclass
class RequirementTraceabilityGraph:
    path: Path

    def __init__(self, path: str | Path):
        self.path = Path(path)

    def _load(self) -> tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, Any]]]:
        nodes: Dict[str, Dict[str, Any]] = {}
        edges: Dict[str, Dict[str, Any]] = {}
        if not self.path.exists():
            return nodes, edges
        with self.path.open("r", encoding="utf-8") as handle:
            for line_number, raw in enumerate(handle, 1):
                if not raw.strip():
                    continue
                try:
                    event = json.loads(raw)
                except json.JSONDecodeError as exc:
                    raise CorruptTraceGraphError(f"invalid JSON at line {line_number}") from exc
                kind = event.get("event")
                if kind == "ADD_NODE":
                    item = validate_node(event.get("node"))
                    if item["node_id"] in nodes:
                        raise CorruptTraceGraphError(f"duplicate node at line {line_number}")
                    nodes[item["node_id"]] = item
                elif kind == "ADD_EDGE":
                    item = validate_edge(event.get("edge"))
                    if item["edge_id"] in edges:
                        raise CorruptTraceGraphError(f"duplicate edge at line {line_number}")
                    if item["from_id"] not in nodes or item["to_id"] not in nodes:
                        raise CorruptTraceGraphError(f"missing edge endpoint at line {line_number}")
                    edges[item["edge_id"]] = item
                else:
                    raise CorruptTraceGraphError(f"unsupported event at line {line_number}")
        return nodes, edges

    def _append(self, event: Dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(event, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")

    def add_node(self, node: Mapping[str, Any]) -> Dict[str, Any]:
        item = validate_node(node)
        nodes, _ = self._load()
        if item["node_id"] in nodes:
            raise DuplicateTraceIdentityError(f"node_id already exists: {item['node_id']}")
        self._append({"event": "ADD_NODE", "node": item})
        return copy.deepcopy(item)

    def add_edge(self, edge: Mapping[str, Any]) -> Dict[str, Any]:
        item = validate_edge(edge)
        nodes, edges = self._load()
        if item["edge_id"] in edges:
            raise DuplicateTraceIdentityError(f"edge_id already exists: {item['edge_id']}")
        if item["from_id"] not in nodes or item["to_id"] not in nodes:
            raise TraceabilityGraphError("both edge endpoints must already exist")
        self._append({"event": "ADD_EDGE", "edge": item})
        return copy.deepcopy(item)

    def snapshot(self) -> Dict[str, Any]:
        nodes, edges = self._load()
        return {
            "schema_version": "axm.verify.trace-graph/0.1",
            "nodes": [copy.deepcopy(nodes[key]) for key in sorted(nodes)],
            "edges": [copy.deepcopy(edges[key]) for key in sorted(edges)],
            "node_count": len(nodes),
            "edge_count": len(edges),
            "authority": "NONE",
            "canon": False,
        }

    def trace(self, node_id: str) -> Dict[str, Any]:
        target = _text(node_id, "node_id")
        nodes, edges = self._load()
        if target not in nodes:
            raise TraceabilityGraphError(f"unknown node_id: {target}")
        connected = [copy.deepcopy(edge) for edge in edges.values() if target in {edge["from_id"], edge["to_id"]}]
        connected.sort(key=lambda edge: edge["edge_id"])
        neighbor_ids = sorted({edge["to_id"] if edge["from_id"] == target else edge["from_id"] for edge in connected})
        return {"node": copy.deepcopy(nodes[target]), "edges": connected, "neighbors": [copy.deepcopy(nodes[key]) for key in neighbor_ids]}

    def unlinked_requirements(self) -> list[Dict[str, Any]]:
        nodes, edges = self._load()
        linked = {edge["from_id"] for edge in edges.values()} | {edge["to_id"] for edge in edges.values()}
        return [copy.deepcopy(nodes[key]) for key in sorted(nodes) if nodes[key]["node_type"] == "REQUIREMENT" and key not in linked]
