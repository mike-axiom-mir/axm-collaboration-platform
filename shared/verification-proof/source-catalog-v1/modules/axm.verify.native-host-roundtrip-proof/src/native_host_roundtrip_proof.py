
"""Detached AXM Native Host Round-Trip Proof v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping

STATES={"PASS","FAIL","UNKNOWN","NOT_RUN"}
class NativeHostProofError(ValueError):pass
class NativeHostRoundtripProof:
    def verify(self,receipt:Mapping[str,Any])->Dict[str,Any]:
        if not isinstance(receipt,Mapping):raise NativeHostProofError("receipt must be a mapping")
        rid=receipt.get("receipt_id");host=receipt.get("host");status=receipt.get("status")
        if not isinstance(rid,str) or not rid or not isinstance(host,Mapping) or not isinstance(host.get("name"),str) or not host.get("name") or status not in STATES:raise NativeHostProofError("invalid receipt identity, host, or status")
        target=receipt.get("target_digest");saved=receipt.get("saved_digest");reopened=receipt.get("reopened_digest")
        if any(not isinstance(x,str) or not x for x in (target,saved,reopened)):raise NativeHostProofError("target, saved, and reopened digests are required")
        inspected=receipt.get("inspected")
        if not isinstance(inspected,bool):raise NativeHostProofError("inspected must be boolean")
        rollback_requested=receipt.get("rollback_requested",False)
        if not isinstance(rollback_requested,bool):raise NativeHostProofError("rollback_requested must be boolean")
        mismatches=[]
        if saved!=target:mismatches.append({"stage":"save","expected":target,"observed":saved})
        if reopened!=saved:mismatches.append({"stage":"reopen","expected":saved,"observed":reopened})
        rollback={"requested":rollback_requested,"status":"NOT_REQUIRED"}
        if rollback_requested:
            rb_status=receipt.get("rollback_status");rb_digest=receipt.get("rollback_digest");pre=receipt.get("pre_change_digest")
            if rb_status not in STATES or not isinstance(rb_digest,str) or not rb_digest or not isinstance(pre,str) or not pre:raise NativeHostProofError("rollback evidence is incomplete")
            rollback={"requested":True,"status":rb_status,"expected":pre,"observed":rb_digest}
            if rb_status=="FAIL" or rb_digest!=pre:mismatches.append({"stage":"rollback","expected":pre,"observed":rb_digest})
        uncertain=[]
        if status in {"UNKNOWN","NOT_RUN"}:uncertain.append({"stage":"roundtrip","status":status})
        if not inspected:uncertain.append({"stage":"native_inspection","status":"NOT_RUN"})
        if rollback_requested and rollback["status"] in {"UNKNOWN","NOT_RUN"}:uncertain.append({"stage":"rollback","status":rollback["status"]})
        verdict="FAIL" if status=="FAIL" or mismatches else ("UNKNOWN" if uncertain else "PASS")
        return {"schema_version":"axm.verify.native-host-roundtrip/0.1","verdict_state":verdict,"receipt_id":rid,"host":dict(host),"mismatches":mismatches,"uncertain_steps":uncertain,"rollback":rollback,"does_not_launch_native_host":True,"caller_supplied_receipt":True,"visual_approval_not_implied":True,"authority":"NONE","canon":False}
