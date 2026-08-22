"""Detached AXM Continuous Recertification Scheduler v0.1.0."""
from __future__ import annotations
from datetime import datetime
from typing import Any,Dict,Mapping
CATEGORIES={"code","dependency","data","environment","hardware","policy","standards"}
class RecertificationSchedulerError(ValueError):pass

def _dt(v:Any,field:str)->datetime:
    if not isinstance(v,str) or not v:raise RecertificationSchedulerError(f"{field} required")
    try:return datetime.fromisoformat(v.replace("Z","+00:00"))
    except ValueError as exc:raise RecertificationSchedulerError(f"invalid {field}") from exc
class ContinuousRecertificationScheduler:
    def plan(self,proofs:list[Mapping[str,Any]],change_events:list[Mapping[str,Any]],now:str)->Dict[str,Any]:
        if not isinstance(proofs,list) or not isinstance(change_events,list):raise RecertificationSchedulerError("proof and change lists required")
        current=_dt(now,"now");events=[]
        for e in change_events:
            if not isinstance(e,Mapping) or e.get("category") not in CATEGORIES or not isinstance(e.get("subject_id"),str) or not e["subject_id"]:raise RecertificationSchedulerError("invalid change event")
            _dt(e.get("occurred_at"),"occurred_at");events.append((e["category"],e["subject_id"]))
        due=[];seen=set();future=[]
        for p in proofs:
            if not isinstance(p,Mapping) or not isinstance(p.get("proof_id"),str) or not p["proof_id"]:raise RecertificationSchedulerError("invalid proof")
            pid=p["proof_id"]
            if pid in seen:raise RecertificationSchedulerError("duplicate proof_id")
            seen.add(pid);reasons=[];expires=p.get("expires_at")
            if expires is not None:
                exp=_dt(expires,"expires_at")
                if exp<=current:reasons.append("EXPIRY_DUE")
                else:future.append((exp,expires))
            deps=p.get("dependencies",{})
            if not isinstance(deps,Mapping) or any(k not in CATEGORIES or not isinstance(v,list) or any(not isinstance(x,str) or not x for x in v) for k,v in deps.items()):raise RecertificationSchedulerError("invalid dependencies")
            for category,subject in events:
                if subject in deps.get(category,[]):reasons.append(f"INVALIDATED:{category}:{subject}")
            if p.get("verdict_state")=="STALE":reasons.append("ALREADY_STALE")
            if reasons:due.append({"proof_id":pid,"reasons":sorted(set(reasons)),"priority":0 if any(r.startswith("INVALIDATED") for r in reasons) else 1})
        due.sort(key=lambda x:(x["priority"],x["proof_id"]));next_expiry=min(future)[1] if future else None
        return {"schema_version":"axm.verify.recertification-plan/0.1","due_proofs":due,"due_count":len(due),"next_expiry":next_expiry,"execution_applied":False,"schedule_persisted":False,"authority":"NONE","canon":False}
