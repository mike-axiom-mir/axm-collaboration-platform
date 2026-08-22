"""Detached AXM Benchmark Drift and Retirement Monitor v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping

class BenchmarkDriftMonitorError(ValueError): pass

def _text(value: Any, field: str) -> str:
    if not isinstance(value,str) or not value.strip(): raise BenchmarkDriftMonitorError(f"{field} required")
    return value.strip()

def _number(value: Any, field: str, low: float, high: float|None=None) -> float:
    if isinstance(value,bool) or not isinstance(value,(int,float)): raise BenchmarkDriftMonitorError(f"{field} must be numeric")
    value=float(value)
    if value<low or (high is not None and value>high): raise BenchmarkDriftMonitorError(f"{field} out of range")
    return value

def _strings(value: Any, field: str) -> list[str]:
    if not isinstance(value,list) or any(not isinstance(x,str) or not x.strip() for x in value): raise BenchmarkDriftMonitorError(f"{field} must be a string list")
    return [x.strip() for x in value]

class BenchmarkDriftRetirementMonitor:
    def evaluate(self, snapshot: Mapping[str,Any]) -> Dict[str,Any]:
        if not isinstance(snapshot,Mapping): raise BenchmarkDriftMonitorError("snapshot mapping required")
        benchmark_id=_text(snapshot.get("benchmark_id"),"benchmark_id")
        dataset_age=_number(snapshot.get("dataset_age_days"),"dataset_age_days",0)
        max_age=_number(snapshot.get("max_dataset_age_days"),"max_dataset_age_days",0.000001)
        success=_number(snapshot.get("task_success_rate"),"task_success_rate",0,1)
        saturation=_number(snapshot.get("saturation_threshold"),"saturation_threshold",0,1)
        current_env=_text(snapshot.get("environment_fingerprint"),"environment_fingerprint")
        reference_env=_text(snapshot.get("reference_environment_fingerprint"),"reference_environment_fingerprint")
        baseline_valid=snapshot.get("baseline_valid")
        shift=snapshot.get("distribution_shift_detected")
        if not isinstance(baseline_valid,bool) or not isinstance(shift,bool): raise BenchmarkDriftMonitorError("boolean drift fields required")
        assumptions=_strings(snapshot.get("invalidated_assumptions",[]),"invalidated_assumptions")
        evidence=_strings(snapshot.get("evidence_ids",[]),"evidence_ids")
        signals=[]
        if dataset_age>max_age: signals.append({"code":"STALE_DATASET","observed":dataset_age,"threshold":max_age})
        if success>=saturation: signals.append({"code":"SATURATED_TASK","observed":success,"threshold":saturation})
        if current_env!=reference_env: signals.append({"code":"ENVIRONMENT_DRIFT","observed":current_env,"reference":reference_env})
        if not baseline_valid: signals.append({"code":"INVALID_BASELINE"})
        if shift: signals.append({"code":"DISTRIBUTION_SHIFT"})
        if assumptions: signals.append({"code":"INVALIDATED_ASSUMPTIONS","items":assumptions})
        severe={item["code"] for item in signals}&{"INVALID_BASELINE","INVALIDATED_ASSUMPTIONS"}
        recommendation="RETIRE_REVIEW" if severe else ("REVISE_AND_REVALIDATE" if signals else "RETAIN_CURRENT")
        return {"schema_version":"axm.verify.benchmark-drift-retirement/0.1","benchmark_id":benchmark_id,"signals":signals,"signal_count":len(signals),"verdict_state":"PASS" if not signals else "HUMAN_REVIEW","recommendation":recommendation,"evidence_ids":evidence,"action_applied":False,"benchmark_retired":False,"authority":"NONE","canon":False}
