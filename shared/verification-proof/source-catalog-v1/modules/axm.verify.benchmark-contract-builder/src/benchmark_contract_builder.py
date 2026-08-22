"""Detached AXM Benchmark Contract Builder v0.1.0."""
from __future__ import annotations
import hashlib,json
from typing import Any,Dict,Mapping,Sequence
class BenchmarkContractError(ValueError):pass

def _strings(value:Any,label:str)->list[str]:
    if not isinstance(value,Sequence) or isinstance(value,(str,bytes)) or not value or any(not isinstance(x,str) or not x for x in value):raise BenchmarkContractError(f"{label} must be non-empty strings")
    return list(value)
class BenchmarkContractBuilder:
    def build(self,goal:str,population:str,tasks:Sequence[str],metrics:Sequence[Mapping[str,Any]],environment:Mapping[str,Any],exclusions:Sequence[str],stopping_rules:Sequence[str],valid_conclusions:Sequence[str])->Dict[str,Any]:
        if not isinstance(goal,str) or not goal or not isinstance(population,str) or not population:raise BenchmarkContractError("goal and population required")
        task_list=_strings(tasks,"tasks"); exclusion_list=_strings(exclusions,"exclusions"); stop_list=_strings(stopping_rules,"stopping rules"); conclusion_list=_strings(valid_conclusions,"valid conclusions")
        if len(set(task_list))!=len(task_list):raise BenchmarkContractError("duplicate tasks")
        if not isinstance(environment,Mapping) or not environment:raise BenchmarkContractError("environment required")
        if not isinstance(metrics,Sequence) or isinstance(metrics,(str,bytes)) or not metrics:raise BenchmarkContractError("metrics required")
        normalized=[];names=set()
        for raw in metrics:
            if not isinstance(raw,Mapping):raise BenchmarkContractError("metric mapping required")
            item={k:raw.get(k) for k in ("name","direction","unit","aggregation")}
            if not isinstance(item["name"],str) or not item["name"] or item["name"] in names:raise BenchmarkContractError("unique metric names required")
            if item["direction"] not in {"HIGHER_BETTER","LOWER_BETTER","TARGET"}:raise BenchmarkContractError("invalid metric direction")
            if not isinstance(item["unit"],str) or not item["unit"] or item["aggregation"] not in {"MEAN","MEDIAN","RATE","COUNT","CUSTOM"}:raise BenchmarkContractError("invalid metric unit or aggregation")
            names.add(item["name"]);normalized.append(item)
        core={"goal":goal,"population":population,"tasks":task_list,"metrics":normalized,"environment":dict(environment),"exclusions":exclusion_list,"stopping_rules":stop_list,"valid_conclusions":conclusion_list}
        try:payload=json.dumps(core,sort_keys=True,separators=(",",":"),ensure_ascii=False,allow_nan=False).encode()
        except (TypeError,ValueError) as exc:raise BenchmarkContractError("contract must be deterministic JSON") from exc
        return {"schema_version":"axm.verify.benchmark-contract/0.1","contract_id":"sha256:"+hashlib.sha256(payload).hexdigest(),**core,"universal_score":None,"benchmark_executed":False,"authority":"NONE","canon":False}
