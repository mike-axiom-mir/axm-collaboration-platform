"""Detached AXM Metric Gaming and Goodhart Warning v0.1.0."""
from __future__ import annotations
import math
from typing import Any,Dict,Mapping,Sequence
class MetricGamingError(ValueError):pass
class MetricGamingWarning:
    def assess(self,goal:str,metrics:Sequence[Mapping[str,Any]],guardrails:Sequence[str],optimization_pressure:str="MEDIUM")->Dict[str,Any]:
        if not isinstance(goal,str) or not goal:raise MetricGamingError("goal required")
        if optimization_pressure not in {"LOW","MEDIUM","HIGH"}:raise MetricGamingError("invalid optimization pressure")
        if not isinstance(metrics,Sequence) or isinstance(metrics,(str,bytes)) or not metrics:raise MetricGamingError("metrics required")
        if not isinstance(guardrails,Sequence) or isinstance(guardrails,(str,bytes)) or any(not isinstance(x,str) or not x for x in guardrails):raise MetricGamingError("guardrails must be strings")
        warnings=[];names=set();weights=[]
        for raw in metrics:
            if not isinstance(raw,Mapping):raise MetricGamingError("metric mapping required")
            name=raw.get("name");proxy=raw.get("proxy_for");weight=raw.get("weight",0.0)
            if not isinstance(name,str) or not name or name in names:raise MetricGamingError("unique metric names required")
            if not isinstance(proxy,str) or not proxy:raise MetricGamingError("proxy target required")
            if isinstance(weight,bool) or not isinstance(weight,(int,float)) or weight<0 or not math.isfinite(weight):raise MetricGamingError("valid metric weight required")
            names.add(name);weights.append(float(weight))
            if proxy.strip().lower()!=goal.strip().lower() and not raw.get("direct_goal_link",False):warnings.append({"type":"PROXY_GOAL_GAP","metric":name,"proxy_for":proxy})
            if optimization_pressure=="HIGH" and raw.get("bounded") is not True:warnings.append({"type":"UNBOUNDED_HIGH_PRESSURE_METRIC","metric":name})
            if raw.get("threshold") is not None and raw.get("continuous_review") is not True:warnings.append({"type":"THRESHOLD_CLIFF_RISK","metric":name})
        total=sum(weights);max_share=max(weights)/total if total>0 else None
        if len(metrics)==1 or (max_share is not None and max_share>=0.8):warnings.append({"type":"METRIC_CONCENTRATION","max_weight_share":max_share})
        if not guardrails:warnings.append({"type":"NO_GUARDRAILS"})
        risk="HIGH" if any(w["type"] in {"NO_GUARDRAILS","UNBOUNDED_HIGH_PRESSURE_METRIC"} for w in warnings) and len(warnings)>=2 else ("MEDIUM" if warnings else "LOW")
        return {"schema_version":"axm.verify.metric-gaming-warning/0.1","verdict_state":"HUMAN_REVIEW" if warnings else "UNKNOWN","goal":goal,"warnings":warnings,"risk_level":risk,"guardrails":list(guardrails),"optimization_pressure":optimization_pressure,"gaming_observed":False,"goal_quality_proven":False,"authority":"NONE","canon":False}
