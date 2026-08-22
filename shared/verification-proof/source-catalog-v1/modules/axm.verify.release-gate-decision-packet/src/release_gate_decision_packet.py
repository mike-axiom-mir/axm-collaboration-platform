"""Detached AXM Release Gate Decision Packet v0.1.0."""
from __future__ import annotations
from typing import Any,Dict,Mapping
STATES={"PASS","FAIL","UNKNOWN","NOT_RUN","CONFLICTED","STALE","HUMAN_REVIEW"}
class ReleaseGatePacketError(ValueError):pass

def _strings(v:Any,f:str)->list[str]:
    if not isinstance(v,list) or any(not isinstance(x,str) or not x for x in v):raise ReleaseGatePacketError(f"{f} must be string list")
    return list(v)
class ReleaseGateDecisionPacketBuilder:
    def assemble(self,request:Mapping[str,Any])->Dict[str,Any]:
        if not isinstance(request,Mapping):raise ReleaseGatePacketError("request mapping required")
        artifact=request.get("artifact")
        if not isinstance(artifact,Mapping) or not isinstance(artifact.get("artifact_id"),str) or not artifact["artifact_id"] or not isinstance(artifact.get("digest"),str) or not artifact["digest"]:raise ReleaseGatePacketError("exact artifact identity required")
        required=_strings(request.get("required_receipt_ids",[]),"required_receipt_ids");receipts=request.get("receipts",[])
        if not isinstance(receipts,list):raise ReleaseGatePacketError("receipts list required")
        by_id={};normalized=[]
        for r in receipts:
            if not isinstance(r,Mapping) or not isinstance(r.get("receipt_id"),str) or not r["receipt_id"] or r.get("verdict_state") not in STATES or not isinstance(r.get("fresh"),bool):raise ReleaseGatePacketError("invalid receipt")
            if r["receipt_id"] in by_id:raise ReleaseGatePacketError("duplicate receipt id")
            item={"receipt_id":r["receipt_id"],"verdict_state":r["verdict_state"],"fresh":r["fresh"]};by_id[item["receipt_id"]]=item;normalized.append(item)
        missing=sorted(r for r in required if r not in by_id or by_id[r]["verdict_state"]!="PASS" or not by_id[r]["fresh"])
        conflicts=_strings(request.get("unresolved_conflicts",[]),"unresolved_conflicts");failed=_strings(request.get("failed_checks",[]),"failed_checks");limitations=_strings(request.get("limitations",[]),"limitations");required_roles=_strings(request.get("required_approval_roles",[]),"required_approval_roles")
        approvals=request.get("approvals",[])
        if not isinstance(approvals,list) or any(not isinstance(a,Mapping) or not isinstance(a.get("role"),str) or a.get("decision") not in {"APPROVE","REJECT","ABSTAIN"} for a in approvals):raise ReleaseGatePacketError("invalid approvals")
        approved_roles={a["role"] for a in approvals if a["decision"]=="APPROVE"};missing_roles=sorted(set(required_roles)-approved_roles)
        rollback=request.get("rollback_plan")
        rollback_ready=isinstance(rollback,Mapping) and isinstance(rollback.get("plan_id"),str) and bool(rollback["plan_id"]) and rollback.get("verified") is True
        blockers=[]
        if missing:blockers.append({"code":"MISSING_OR_UNACCEPTABLE_RECEIPTS","items":missing})
        if conflicts:blockers.append({"code":"UNRESOLVED_CONFLICTS","items":conflicts})
        if failed:blockers.append({"code":"FAILED_CHECKS","items":failed})
        if missing_roles:blockers.append({"code":"MISSING_APPROVAL_ROLES","items":missing_roles})
        if not rollback_ready:blockers.append({"code":"ROLLBACK_NOT_VERIFIED"})
        return {"schema_version":"axm.verify.release-gate-decision-packet/0.1","artifact":{"artifact_id":artifact["artifact_id"],"digest":artifact["digest"]},"receipts":sorted(normalized,key=lambda x:x["receipt_id"]),"limitations":limitations,"approvals":approvals,"rollback_plan":rollback,"blocking_reasons":blockers,"packet_state":"READY_FOR_MERGE_GATE_REVIEW" if not blockers else "BLOCKED","merge_gate_decision":"NOT_MADE","release_applied":False,"authority":"NONE","canon":False}
