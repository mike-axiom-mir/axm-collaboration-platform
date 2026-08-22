"""Detached AXM Performance Budget Verifier v0.1.0."""
from __future__ import annotations
import math
from statistics import mean
from typing import Any, Dict, Mapping, Sequence

STATES={"PASS","FAIL","UNKNOWN","NOT_RUN","STALE"};AGG={"mean","p95","max","min"};DIR={"max","min"}
class PerformanceBudgetError(ValueError):pass
def aggregate(samples:list[float],kind:str)->float:
    if kind=="mean":return float(mean(samples))
    if kind=="max":return float(max(samples))
    if kind=="min":return float(min(samples))
    ordered=sorted(samples);return float(ordered[max(0,math.ceil(0.95*len(ordered))-1)])
class PerformanceBudgetVerifier:
    def verify(self,budgets:Sequence[Mapping[str,Any]],observations:Sequence[Mapping[str,Any]])->Dict[str,Any]:
        if not budgets:raise PerformanceBudgetError("budgets must not be empty")
        budget_map={}
        for raw in budgets:
            key=(raw.get("workload_id"),raw.get("metric")) if isinstance(raw,Mapping) else (None,None);direction=raw.get("direction") if isinstance(raw,Mapping) else None;aggregation=raw.get("aggregation") if isinstance(raw,Mapping) else None;threshold=raw.get("threshold") if isinstance(raw,Mapping) else None
            if not all(isinstance(x,str) and x for x in key) or key in budget_map or direction not in DIR or aggregation not in AGG or not isinstance(threshold,(int,float)) or not isinstance(raw.get("unit"),str) or not raw.get("unit"):raise PerformanceBudgetError("invalid or duplicate budget")
            budget_map[key]=dict(raw)
        obs={}
        for raw in observations:
            key=(raw.get("workload_id"),raw.get("metric")) if isinstance(raw,Mapping) else (None,None);status=raw.get("status") if isinstance(raw,Mapping) else None;samples=raw.get("samples") if isinstance(raw,Mapping) else None
            if key in obs or status not in STATES or not isinstance(samples,list) or (status=="PASS" and (not samples or any(not isinstance(x,(int,float)) for x in samples))):raise PerformanceBudgetError("invalid or duplicate observation")
            obs[key]=dict(raw)
        results=[];failures=[];unknown=[]
        for key,budget in sorted(budget_map.items()):
            row=obs.get(key)
            if row is None:results.append({"workload_id":key[0],"metric":key[1],"verdict_state":"UNKNOWN","reason":"missing_observation"});unknown.append(key);continue
            if row.get("unit")!=budget["unit"]:results.append({"workload_id":key[0],"metric":key[1],"verdict_state":"FAIL","reason":"unit_mismatch"});failures.append(key);continue
            if row["status"]=="FAIL":results.append({"workload_id":key[0],"metric":key[1],"verdict_state":"FAIL","reason":"reported_failure"});failures.append(key);continue
            if row["status"] in {"UNKNOWN","NOT_RUN","STALE"}:results.append({"workload_id":key[0],"metric":key[1],"verdict_state":"UNKNOWN","reason":row["status"]});unknown.append(key);continue
            value=aggregate([float(x) for x in row["samples"]],budget["aggregation"]);ok=value<=budget["threshold"] if budget["direction"]=="max" else value>=budget["threshold"]
            state="PASS" if ok else "FAIL";results.append({"workload_id":key[0],"metric":key[1],"verdict_state":state,"observed":value,"threshold":budget["threshold"],"unit":budget["unit"],"aggregation":budget["aggregation"],"direction":budget["direction"]})
            if not ok:failures.append(key)
        verdict="FAIL" if failures else ("UNKNOWN" if unknown else "PASS")
        return {"schema_version":"axm.verify.performance-budget/0.1","verdict_state":verdict,"results":results,"failures":[list(x) for x in failures],"unknown":[list(x) for x in unknown],"does_not_generate_load":True,"samples_are_caller_supplied":True,"environment_control_proven":False,"authority":"NONE","canon":False}
