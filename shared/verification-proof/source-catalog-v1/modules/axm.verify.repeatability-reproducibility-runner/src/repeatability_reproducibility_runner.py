"""Detached AXM Repeatability and Reproducibility Runner v0.1.0."""
from __future__ import annotations
import math,statistics
from collections import defaultdict
from typing import Any,Dict,Mapping,Sequence
class RepeatabilityError(ValueError):pass
class RepeatabilityReproducibilityRunner:
    def assess(self,runs:Sequence[Mapping[str,Any]],tolerance:float)->Dict[str,Any]:
        if not isinstance(runs,Sequence) or isinstance(runs,(str,bytes)) or not runs:raise RepeatabilityError("non-empty run records required")
        if isinstance(tolerance,bool) or not isinstance(tolerance,(int,float)) or tolerance<0 or not math.isfinite(tolerance):raise RepeatabilityError("valid tolerance required")
        groups=defaultdict(list);errors=[];ids=set()
        for raw in runs:
            if not isinstance(raw,Mapping):raise RepeatabilityError("run mapping required")
            rid=raw.get("run_id");setup=raw.get("setup_id");status=raw.get("status");value=raw.get("value")
            if not isinstance(rid,str) or not rid or rid in ids or not isinstance(setup,str) or not setup or status not in {"PASS","FAIL"}:raise RepeatabilityError("valid unique run identity, setup, and status required")
            ids.add(rid)
            if status=="FAIL":errors.append(rid);continue
            if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):raise RepeatabilityError("PASS run needs finite numeric value")
            groups[setup].append(float(value))
        per={};repeatability_unknown=False
        for setup,vals in sorted(groups.items()):
            spread=max(vals)-min(vals);state="UNKNOWN" if len(vals)<2 else ("PASS" if spread<=tolerance else "FAIL")
            if state=="UNKNOWN":repeatability_unknown=True
            per[setup]={"n":len(vals),"mean":statistics.fmean(vals),"spread":spread,"repeatability":state}
        means=[x["mean"] for x in per.values()];between=max(means)-min(means) if means else None
        reproducibility="UNKNOWN" if len(means)<2 else ("PASS" if between<=tolerance else "FAIL")
        overall="FAIL" if errors or any(x["repeatability"]=="FAIL" for x in per.values()) or reproducibility=="FAIL" else ("UNKNOWN" if repeatability_unknown or reproducibility=="UNKNOWN" else "PASS")
        return {"schema_version":"axm.verify.repeatability-reproducibility/0.1","verdict_state":overall,"tolerance":float(tolerance),"per_setup":per,"between_setup_mean_spread":between,"reproducibility":reproducibility,"failed_run_ids":errors,"evaluation_executed":False,"external_independence_proven":False,"authority":"NONE","canon":False}
