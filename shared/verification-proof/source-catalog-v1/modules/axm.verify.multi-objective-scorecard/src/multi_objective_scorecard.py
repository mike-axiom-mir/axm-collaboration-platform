"""Detached AXM Multi-Objective Evidence Scorecard v0.1.0."""
from __future__ import annotations
from typing import Any,Dict,Mapping
DIMENSIONS=("correctness","safety","performance","usability","cost","privacy","uncertainty")
STATES={"PASS","FAIL","UNKNOWN","NOT_RUN","CONFLICTED","STALE","HUMAN_REVIEW"}
class MultiObjectiveScorecardError(ValueError):pass
class MultiObjectiveEvidenceScorecard:
    def build(self,dimensions:Mapping[str,Mapping[str,Any]])->Dict[str,Any]:
        if not isinstance(dimensions,Mapping):raise MultiObjectiveScorecardError("dimension mapping required")
        forbidden={"overall","overall_score","aggregate","weighted_total"}&set(dimensions)
        if forbidden:raise MultiObjectiveScorecardError("universal aggregation is not accepted")
        rows=[];unresolved=[]
        for name in DIMENSIONS:
            raw=dimensions.get(name)
            if raw is None:
                row={"dimension":name,"verdict_state":"NOT_RUN","value":None,"unit":None,"evidence_ids":[],"limitations":["dimension not supplied"]};unresolved.append(name)
            else:
                if not isinstance(raw,Mapping) or raw.get("verdict_state") not in STATES:raise MultiObjectiveScorecardError(f"invalid {name} dimension")
                evidence=raw.get("evidence_ids",[]);limitations=raw.get("limitations",[])
                if not isinstance(evidence,list) or any(not isinstance(x,str) or not x for x in evidence) or not isinstance(limitations,list) or any(not isinstance(x,str) or not x for x in limitations):raise MultiObjectiveScorecardError("evidence and limitations must be string lists")
                row={"dimension":name,"verdict_state":raw["verdict_state"],"value":raw.get("value"),"unit":raw.get("unit"),"evidence_ids":list(evidence),"limitations":list(limitations)}
                if raw["verdict_state"] not in {"PASS","FAIL"}:unresolved.append(name)
            rows.append(row)
        extra=sorted(set(dimensions)-set(DIMENSIONS))
        if extra:raise MultiObjectiveScorecardError("unknown dimensions: "+", ".join(extra))
        return {"schema_version":"axm.verify.multi-objective-scorecard/0.1","dimensions":rows,"complete":not any(r["verdict_state"]=="NOT_RUN" for r in rows),"unresolved_dimensions":unresolved,"overall_score":None,"overall_verdict":"NOT_COMPUTED","ranking_produced":False,"authority":"NONE","canon":False}
