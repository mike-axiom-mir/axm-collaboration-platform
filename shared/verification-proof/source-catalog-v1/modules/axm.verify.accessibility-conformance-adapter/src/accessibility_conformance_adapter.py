"""Detached AXM Accessibility Conformance Adapter v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping, Sequence

TYPES={"machine","keyboard","screen_reader","device","human"};STATES={"PASS","FAIL","UNKNOWN","NOT_RUN","STALE"}
class AccessibilityAdapterError(ValueError):pass
class AccessibilityConformanceAdapter:
    def evaluate(self,claims:Sequence[Mapping[str,Any]],evidence:Sequence[Mapping[str,Any]])->Dict[str,Any]:
        if not claims:raise AccessibilityAdapterError("claims must not be empty")
        claim_map={}
        for raw in claims:
            cid=raw.get("claim_id") if isinstance(raw,Mapping) else None;required=raw.get("required_evidence") if isinstance(raw,Mapping) else None
            if not isinstance(cid,str) or not cid or cid in claim_map or not isinstance(required,list) or not required or any(x not in TYPES for x in required):raise AccessibilityAdapterError("invalid or duplicate claim")
            claim_map[cid]={**dict(raw),"required_evidence":sorted(set(required))}
        seats={cid:{} for cid in claim_map}
        for raw in evidence:
            cid=raw.get("claim_id") if isinstance(raw,Mapping) else None;kind=raw.get("evidence_type") if isinstance(raw,Mapping) else None;status=raw.get("status") if isinstance(raw,Mapping) else None
            if cid not in claim_map or kind not in TYPES or status not in STATES or kind in seats[cid]:raise AccessibilityAdapterError("invalid, duplicate, or unknown evidence seat")
            seats[cid][kind]=dict(raw)
        reports=[];states=[]
        for cid in sorted(claim_map):
            required=claim_map[cid]["required_evidence"];rows=seats[cid]
            failures=[kind for kind in required if rows.get(kind,{}).get("status")=="FAIL"]
            missing=[kind for kind in required if kind not in rows]
            uncertain=[kind for kind in required if rows.get(kind,{}).get("status") in {"UNKNOWN","NOT_RUN","STALE"}]
            nonhuman=[kind for kind in required if kind!="human"]
            nonhuman_pass=all(rows.get(kind,{}).get("status")=="PASS" for kind in nonhuman)
            human_pending="human" in required and rows.get("human",{}).get("status")!="PASS"
            if failures:state="FAIL"
            elif human_pending and nonhuman_pass and all(kind=="human" for kind in missing+uncertain):state="HUMAN_REVIEW"
            elif missing or uncertain:state="UNKNOWN"
            else:state="PASS"
            states.append(state);reports.append({"claim_id":cid,"verdict_state":state,"required_evidence":required,"evidence_seats":rows,"missing":missing,"uncertain":uncertain,"failures":failures})
        overall="FAIL" if "FAIL" in states else ("UNKNOWN" if "UNKNOWN" in states else ("HUMAN_REVIEW" if "HUMAN_REVIEW" in states else "PASS"))
        return {"schema_version":"axm.verify.accessibility-conformance/0.1","verdict_state":overall,"claims":reports,"not_a_certification":True,"evidence_truth_reverified":False,"human_evidence_replaced":False,"authority":"NONE","canon":False}
