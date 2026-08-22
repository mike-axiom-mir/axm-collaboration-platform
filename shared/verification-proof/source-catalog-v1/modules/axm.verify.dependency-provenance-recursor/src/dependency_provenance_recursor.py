"""Detached AXM Dependency Provenance Recursor v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping, Sequence

STATES = {"PASS", "FAIL", "UNKNOWN", "NOT_RUN"}

class DependencyProvenanceError(ValueError):
    pass

class DependencyProvenanceRecursor:
    def inspect(self, graph: Mapping[str, Mapping[str, Any]], roots: Sequence[str], max_nodes: int = 1000) -> Dict[str, Any]:
        if not isinstance(graph, Mapping) or not isinstance(roots, Sequence) or isinstance(roots, (str, bytes)):
            raise DependencyProvenanceError("graph and root sequence are required")
        if not roots or any(not isinstance(item, str) or not item for item in roots):
            raise DependencyProvenanceError("at least one non-empty root is required")
        if not isinstance(max_nodes, int) or isinstance(max_nodes, bool) or max_nodes <= 0:
            raise DependencyProvenanceError("max_nodes must be a positive integer")
        failures=[]; uncertainty=[]; cycles=[]; edges=[]; visited=[]; state={}; truncated=False

        def walk(node_id: str, trail: list[str]) -> None:
            nonlocal truncated
            if state.get(node_id) == "DONE":
                return
            if state.get(node_id) == "ACTIVE":
                start = trail.index(node_id) if node_id in trail else 0
                cycle = trail[start:] + [node_id]
                if cycle not in cycles:
                    cycles.append(cycle); failures.append({"type":"dependency_cycle","cycle":cycle})
                return
            if len(visited) >= max_nodes:
                truncated=True
                return
            node=graph.get(node_id)
            if not isinstance(node, Mapping):
                failures.append({"type":"missing_dependency_record","component_id":node_id})
                return
            deps=node.get("dependencies", [])
            att=node.get("attestation_status", "NOT_RUN")
            policy=node.get("policy_status", "NOT_RUN")
            if not isinstance(deps, list) or any(not isinstance(item,str) or not item for item in deps):
                raise DependencyProvenanceError(f"invalid dependencies for {node_id}")
            if att not in STATES or policy not in STATES:
                raise DependencyProvenanceError(f"invalid status for {node_id}")
            state[node_id]="ACTIVE"; visited.append(node_id)
            if att == "FAIL": failures.append({"type":"attestation_failure","component_id":node_id})
            elif att in {"UNKNOWN","NOT_RUN"}: uncertainty.append({"type":"attestation_unverified","component_id":node_id,"status":att})
            if policy == "FAIL": failures.append({"type":"policy_violation","component_id":node_id})
            elif policy in {"UNKNOWN","NOT_RUN"}: uncertainty.append({"type":"policy_unverified","component_id":node_id,"status":policy})
            for dependency in deps:
                edges.append({"from":node_id,"to":dependency})
                walk(dependency, trail+[node_id])
            state[node_id]="DONE"

        for root in roots:
            walk(root, [])
        if truncated:
            uncertainty.append({"type":"node_limit_reached","max_nodes":max_nodes})
        verdict="FAIL" if failures else ("UNKNOWN" if uncertainty else "PASS")
        return {"schema_version":"axm.verify.dependency-provenance-recursion/0.1","verdict_state":verdict,"roots":list(roots),"visited_components":visited,"edges":edges,"cycles":cycles,"failures":failures,"uncertainty":uncertainty,"truncated":truncated,"remote_fetch_performed":False,"attestations_authenticated_by_module":False,"authority":"NONE","canon":False}
