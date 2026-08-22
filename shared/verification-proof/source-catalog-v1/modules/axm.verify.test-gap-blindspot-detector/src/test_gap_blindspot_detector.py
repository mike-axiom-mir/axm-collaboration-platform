"""Detached AXM Test Gap and Blind-Spot Detector v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping, Sequence

EVIDENCE_STATUSES = {"PASS", "FAIL", "UNKNOWN", "NOT_RUN", "STALE"}
FIXTURE_STATUSES = {"FRESH", "STALE", "UNKNOWN"}

class GapDetectorError(ValueError):
    pass


def _cycles(edges: Sequence[Mapping[str, Any]]) -> list[list[str]]:
    graph: dict[str, list[str]] = {}
    for edge in edges:
        source = edge.get("from_claim") if isinstance(edge, Mapping) else None
        target = edge.get("to_claim") if isinstance(edge, Mapping) else None
        if not isinstance(source, str) or not source.strip() or not isinstance(target, str) or not target.strip():
            raise GapDetectorError("dependency edges require non-empty from_claim and to_claim")
        graph.setdefault(source, []).append(target)
        graph.setdefault(target, [])
    found: list[list[str]] = []
    active: list[str] = []
    active_set: set[str] = set()
    visited: set[str] = set()
    def visit(node: str) -> None:
        if node in active_set:
            start = active.index(node)
            cycle = active[start:] + [node]
            if cycle not in found:
                found.append(cycle)
            return
        if node in visited:
            return
        active.append(node); active_set.add(node)
        for target in graph.get(node, []):
            visit(target)
        active.pop(); active_set.remove(node); visited.add(node)
    for node in sorted(graph):
        visit(node)
    return found

class TestGapBlindspotDetector:
    def analyze(self, requirements: Sequence[Mapping[str, Any]], evidence: Sequence[Mapping[str, Any]], fixtures: Sequence[Mapping[str, Any]] = (), proof_dependencies: Sequence[Mapping[str, Any]] = ()) -> Dict[str, Any]:
        if not requirements:
            raise GapDetectorError("requirements must not be empty")
        reqs: dict[str, dict[str, Any]] = {}
        for raw in requirements:
            rid = raw.get("requirement_id") if isinstance(raw, Mapping) else None
            if not isinstance(rid, str) or not rid.strip() or rid in reqs:
                raise GapDetectorError("requirement_id must be unique and non-empty")
            required = raw.get("required_evidence", [])
            risks = raw.get("risk_boundaries", [])
            if not isinstance(required, list) or any(not isinstance(x, str) or not x for x in required):
                raise GapDetectorError("required_evidence must be a list of non-empty strings")
            if not isinstance(risks, list) or any(not isinstance(x, str) or not x for x in risks):
                raise GapDetectorError("risk_boundaries must be a list of non-empty strings")
            reqs[rid] = {**dict(raw), "required_evidence": sorted(set(required)), "risk_boundaries": sorted(set(risks))}
        by_req: dict[str, list[dict[str, Any]]] = {rid: [] for rid in reqs}
        for raw in evidence:
            rid = raw.get("requirement_id") if isinstance(raw, Mapping) else None
            status = raw.get("status") if isinstance(raw, Mapping) else None
            kind = raw.get("evidence_type") if isinstance(raw, Mapping) else None
            if rid not in reqs:
                raise GapDetectorError("evidence references unknown requirement")
            if status not in EVIDENCE_STATUSES or not isinstance(kind, str) or not kind:
                raise GapDetectorError("invalid evidence record")
            by_req[rid].append(dict(raw))
        stale_fixtures=[]
        fixture_ids=set()
        for raw in fixtures:
            fid=raw.get("fixture_id") if isinstance(raw,Mapping) else None; status=raw.get("status") if isinstance(raw,Mapping) else None
            if not isinstance(fid,str) or not fid or fid in fixture_ids or status not in FIXTURE_STATUSES:
                raise GapDetectorError("invalid or duplicate fixture")
            fixture_ids.add(fid)
            if status != "FRESH": stale_fixtures.append({"fixture_id":fid,"status":status})
        requirement_gaps=[]
        for rid in sorted(reqs):
            req=reqs[rid]; rows=by_req[rid]
            passed_types={row["evidence_type"] for row in rows if row["status"]=="PASS"}
            passed_risks={row.get("risk_boundary_id") for row in rows if row["status"]=="PASS" and row.get("risk_boundary_id")}
            missing=sorted(set(req["required_evidence"])-passed_types)
            uncovered=sorted(set(req["risk_boundaries"])-passed_risks)
            native_missing=bool(req.get("needs_native_evidence")) and "native" not in passed_types
            unknown=[{"evidence_type":row["evidence_type"],"status":row["status"]} for row in rows if row["status"] in {"UNKNOWN","NOT_RUN","STALE"}]
            if not rows or missing or uncovered or native_missing or unknown:
                requirement_gaps.append({"requirement_id":rid,"untested":not rows,"missing_evidence":missing,"uncovered_risk_boundaries":uncovered,"native_evidence_missing":native_missing,"uncertain_evidence":unknown})
        cycles=_cycles(proof_dependencies)
        verdict="FAIL" if requirement_gaps or stale_fixtures or cycles else "PASS"
        return {"schema_version":"axm.verify.test-gap-report/0.1","verdict_state":verdict,"requirement_gaps":requirement_gaps,"stale_or_unknown_fixtures":stale_fixtures,"circular_proof_dependencies":cycles,"input_completeness_proven":False,"evidence_truth_proven":False,"gap_free_is_not_correctness":True,"authority":"NONE","canon":False}
