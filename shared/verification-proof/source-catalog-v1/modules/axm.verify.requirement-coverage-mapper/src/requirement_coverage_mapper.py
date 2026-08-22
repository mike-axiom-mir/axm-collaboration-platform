"""Detached AXM Requirement Coverage Mapper v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping, Sequence

CATEGORIES={"positive","negative","boundary","recovery","human_review"}
VERDICTS={"PASS","FAIL","UNKNOWN","NOT_RUN","CONFLICTED","STALE","HUMAN_REVIEW"}
class RequirementCoverageError(ValueError):pass
class RequirementCoverageMapper:
    def map(self,requirements:Sequence[Mapping[str,Any]],evidence:Sequence[Mapping[str,Any]])->Dict[str,Any]:
        if not requirements:raise RequirementCoverageError("requirements must not be empty")
        reqs={}
        for raw in requirements:
            rid=raw.get("requirement_id") if isinstance(raw,Mapping) else None
            cats=raw.get("required_evidence",[]) if isinstance(raw,Mapping) else []
            if not isinstance(rid,str) or not rid.strip() or rid in reqs:raise RequirementCoverageError("requirement_id must be unique and non-empty")
            if isinstance(cats,(str,bytes)) or not set(cats)<=CATEGORIES:raise RequirementCoverageError("unsupported evidence category")
            reqs[rid]=set(cats)
        seen=set();grouped={rid:[] for rid in reqs}
        for raw in evidence:
            eid=raw.get("evidence_id") if isinstance(raw,Mapping) else None
            rid=raw.get("requirement_id") if isinstance(raw,Mapping) else None
            cat=raw.get("category") if isinstance(raw,Mapping) else None
            verdict=raw.get("verdict_state") if isinstance(raw,Mapping) else None
            if not isinstance(eid,str) or not eid.strip() or eid in seen:raise RequirementCoverageError("evidence_id must be unique and non-empty")
            if rid not in reqs or cat not in CATEGORIES or verdict not in VERDICTS:raise RequirementCoverageError("invalid evidence reference, category, or verdict")
            grouped[rid].append({"evidence_id":eid,"category":cat,"verdict_state":verdict});seen.add(eid)
        results={};overall=[]
        for rid,required in reqs.items():
            categories={}
            for cat in sorted(required):
                receipts=[item for item in grouped[rid] if item["category"]==cat]
                states={item["verdict_state"] for item in receipts}
                if not receipts:state="MISSING"
                elif "FAIL" in states or "CONFLICTED" in states:state="FAIL"
                elif cat=="human_review" and states & {"PASS","HUMAN_REVIEW"}:state="PASS" if "PASS" in states else "HUMAN_REVIEW"
                elif "PASS" in states:state="PASS"
                else:state="UNKNOWN"
                categories[cat]={"state":state,"evidence_ids":[item["evidence_id"] for item in receipts]}
            states={item["state"] for item in categories.values()}
            state="FAIL" if states & {"FAIL","MISSING"} else ("UNKNOWN" if states & {"UNKNOWN","HUMAN_REVIEW"} else "PASS")
            results[rid]={"state":state,"categories":categories};overall.append(state)
        verdict="FAIL" if "FAIL" in overall else ("UNKNOWN" if "UNKNOWN" in overall else "PASS")
        return {"schema_version":"axm.verify.requirement-coverage/0.1","verdict_state":verdict,"requirements":results,"coverage_does_not_replace_requirement_correctness":True,"authority":"NONE","canon":False}
