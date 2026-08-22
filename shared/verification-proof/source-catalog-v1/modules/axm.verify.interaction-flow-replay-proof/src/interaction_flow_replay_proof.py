"""Detached AXM Interaction Flow Replay Proof v0.1.0."""
from __future__ import annotations
import hashlib,json
from typing import Any, Dict, Mapping, Sequence

STATES={"PASS","FAIL","UNKNOWN","NOT_RUN"}
class InteractionReplayError(ValueError):pass
def canonical(value:Any)->str:return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False)
class InteractionFlowReplayProof:
    def verify(self,flow_id:str,steps:Sequence[Mapping[str,Any]],max_steps:int=100)->Dict[str,Any]:
        if not isinstance(flow_id,str) or not flow_id or not steps:raise InteractionReplayError("flow_id and steps are required")
        if not isinstance(max_steps,int) or max_steps<=0 or len(steps)>max_steps:raise InteractionReplayError("step ceiling exceeded or invalid")
        normalized=[];mismatches=[];uncertain=[];seen=set()
        for expected,raw in enumerate(steps):
            idx=raw.get("index") if isinstance(raw,Mapping) else None;status=raw.get("status") if isinstance(raw,Mapping) else None;action=raw.get("action") if isinstance(raw,Mapping) else None
            if idx!=expected or idx in seen or status not in STATES or not isinstance(action,str) or not action:raise InteractionReplayError("invalid, duplicate, or non-contiguous step")
            seen.add(idx);row=dict(raw);normalized.append(row)
            if status=="FAIL":mismatches.append({"index":idx,"type":"reported_failure"})
            elif status in {"UNKNOWN","NOT_RUN"}:uncertain.append({"index":idx,"status":status})
            for key in ("state_before","state_after","output"):
                expected_key="expected_"+key;observed_key="observed_"+key
                if expected_key in row and canonical(row.get(expected_key))!=canonical(row.get(observed_key)):
                    mismatches.append({"index":idx,"type":key,"expected":row.get(expected_key),"observed":row.get(observed_key)})
            for key in ("error","recovery"):
                expected_key=key+"_expected";observed_key=key+"_observed"
                if expected_key in row and bool(row.get(expected_key))!=bool(row.get(observed_key)):
                    mismatches.append({"index":idx,"type":key,"expected":bool(row.get(expected_key)),"observed":bool(row.get(observed_key))})
        for left,right in zip(normalized,normalized[1:]):
            if "observed_state_after" in left and "observed_state_before" in right and canonical(left["observed_state_after"])!=canonical(right["observed_state_before"]):
                mismatches.append({"index":right["index"],"type":"state_chain","previous_after":left["observed_state_after"],"next_before":right["observed_state_before"]})
        verdict="FAIL" if mismatches else ("UNKNOWN" if uncertain else "PASS")
        digest=hashlib.sha256(canonical({"flow_id":flow_id,"steps":normalized}).encode()).hexdigest()
        return {"schema_version":"axm.verify.interaction-replay-proof/0.1","verdict_state":verdict,"flow_id":flow_id,"sequence_sha256":digest,"step_count":len(normalized),"mismatches":mismatches,"uncertain_steps":uncertain,"observations_are_caller_supplied":True,"interaction_executed":False,"authority":"NONE","canon":False}
