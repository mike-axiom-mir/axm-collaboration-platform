"""Detached AXM Resource, Thermal, and Battery Proof v0.1.0."""
from __future__ import annotations
from statistics import mean
from typing import Any, Dict, Mapping, Sequence

AGG={"mean","max","min"};DIR={"max","min"}
class ResourceProofError(ValueError):pass
class ResourceThermalBatteryProof:
    def verify(self,hardware:Mapping[str,Any],workload:Mapping[str,Any],thresholds:Sequence[Mapping[str,Any]],samples:Sequence[Mapping[str,Any]])->Dict[str,Any]:
        hid=hardware.get("hardware_id") if isinstance(hardware,Mapping) else None;wid=workload.get("workload_id") if isinstance(workload,Mapping) else None;required=workload.get("required_duration_s") if isinstance(workload,Mapping) else None
        if not isinstance(hid,str) or not hid or not isinstance(wid,str) or not wid or not isinstance(required,(int,float)) or required<=0:raise ResourceProofError("hardware, workload, and positive duration are required")
        if len(samples)<2:raise ResourceProofError("at least two samples are required")
        normalized=[];last=None
        for raw in samples:
            ts=raw.get("timestamp_s") if isinstance(raw,Mapping) else None;metrics=raw.get("metrics") if isinstance(raw,Mapping) else None
            if not isinstance(ts,(int,float)) or (last is not None and ts<=last) or not isinstance(metrics,Mapping) or any(not isinstance(v,(int,float)) for v in metrics.values()):raise ResourceProofError("invalid or unordered sample")
            last=ts;normalized.append({"timestamp_s":float(ts),"metrics":dict(metrics)})
        threshold_map={}
        for raw in thresholds:
            metric=raw.get("metric") if isinstance(raw,Mapping) else None
            if not isinstance(metric,str) or not metric or metric in threshold_map or raw.get("aggregation") not in AGG or raw.get("direction") not in DIR or not isinstance(raw.get("threshold"),(int,float)):raise ResourceProofError("invalid or duplicate threshold")
            threshold_map[metric]=dict(raw)
        duration=normalized[-1]["timestamp_s"]-normalized[0]["timestamp_s"]
        values:dict[str,list[float]]={}
        for row in normalized:
            for metric,value in row["metrics"].items():values.setdefault(metric,[]).append(float(value))
        if "battery_percent" in values and duration>0:
            values["battery_drain_per_hour"]=[max(0.0,(values["battery_percent"][0]-values["battery_percent"][-1])*3600.0/duration)]
        results=[];failures=[];unknown=[]
        for metric,rule in sorted(threshold_map.items()):
            series=values.get(metric)
            if not series:results.append({"metric":metric,"verdict_state":"UNKNOWN","reason":"missing_metric"});unknown.append(metric);continue
            observed=float(mean(series)) if rule["aggregation"]=="mean" else float(max(series) if rule["aggregation"]=="max" else min(series))
            ok=observed<=rule["threshold"] if rule["direction"]=="max" else observed>=rule["threshold"]
            state="PASS" if ok else "FAIL";results.append({"metric":metric,"verdict_state":state,"observed":observed,"threshold":rule["threshold"],"aggregation":rule["aggregation"],"direction":rule["direction"],"unit":rule.get("unit")})
            if not ok:failures.append(metric)
        coverage_complete=duration>=required
        verdict="FAIL" if failures else ("UNKNOWN" if unknown or not coverage_complete else "PASS")
        return {"schema_version":"axm.verify.resource-thermal-battery/0.1","verdict_state":verdict,"hardware":dict(hardware),"workload":dict(workload),"observed_duration_s":duration,"required_duration_s":required,"coverage_complete":coverage_complete,"results":results,"failures":failures,"unknown":unknown,"does_not_read_sensors":True,"samples_are_caller_supplied":True,"hardware_identity_attested":False,"authority":"NONE","canon":False}
