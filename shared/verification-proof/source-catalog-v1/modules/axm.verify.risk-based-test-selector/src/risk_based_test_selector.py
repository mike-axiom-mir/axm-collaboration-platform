"""Detached AXM Risk-Based Test Selector v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping, Sequence

DIMENSIONS=("impact","likelihood","change_size","authority","irreversibility","data_sensitivity","prior_failures")
DEFAULT_WEIGHTS={"impact":3.0,"likelihood":2.0,"change_size":1.0,"authority":2.0,"irreversibility":3.0,"data_sensitivity":3.0,"prior_failures":2.0}
class RiskSelectionError(ValueError):pass
class RiskBasedTestSelector:
    def select(self,tests:Sequence[Mapping[str,Any]],*,max_tests:int, max_cost:float|None=None, weights:Mapping[str,float]|None=None)->Dict[str,Any]:
        if not tests:raise RiskSelectionError("tests must not be empty")
        if isinstance(max_tests,bool) or not isinstance(max_tests,int) or max_tests<1:raise RiskSelectionError("max_tests must be positive")
        if max_cost is not None and (isinstance(max_cost,bool) or not isinstance(max_cost,(int,float)) or max_cost<=0):raise RiskSelectionError("max_cost must be positive")
        applied=dict(DEFAULT_WEIGHTS)
        if weights is not None:
            if not isinstance(weights,Mapping) or set(weights)-set(DIMENSIONS):raise RiskSelectionError("unknown weight")
            for key,value in weights.items():
                if isinstance(value,bool) or not isinstance(value,(int,float)) or value<0:raise RiskSelectionError("weights must be non-negative")
                applied[key]=float(value)
        items=[];seen=set()
        for raw in tests:
            tid=raw.get("test_id") if isinstance(raw,Mapping) else None
            if not isinstance(tid,str) or not tid.strip() or tid in seen:raise RiskSelectionError("test_id must be unique and non-empty")
            dims={}
            for dim in DIMENSIONS:
                value=raw.get(dim,0)
                if isinstance(value,bool) or not isinstance(value,(int,float)) or not 0<=value<=5:raise RiskSelectionError("risk dimensions must be from 0 to 5")
                dims[dim]=float(value)
            cost=raw.get("cost",1.0)
            if isinstance(cost,bool) or not isinstance(cost,(int,float)) or cost<=0:raise RiskSelectionError("cost must be positive")
            score=sum(dims[key]*applied[key] for key in DIMENSIONS)
            items.append({"test_id":tid,"score":score,"cost":float(cost),"mandatory":bool(raw.get("mandatory",False)),"dimensions":dims});seen.add(tid)
        mandatory=sorted((item for item in items if item["mandatory"]),key=lambda x:x["test_id"])
        if len(mandatory)>max_tests or (max_cost is not None and sum(x["cost"] for x in mandatory)>max_cost):raise RiskSelectionError("mandatory tests exceed declared ceilings")
        selected=list(mandatory);selected_ids={x["test_id"] for x in selected};cost=sum(x["cost"] for x in selected)
        ranked=sorted((x for x in items if not x["mandatory"]),key=lambda x:(-x["score"],x["cost"],x["test_id"]))
        exclusions=[]
        for item in ranked:
            if len(selected)>=max_tests:exclusions.append({"test_id":item["test_id"],"reason":"TEST_LIMIT"});continue
            if max_cost is not None and cost+item["cost"]>max_cost:exclusions.append({"test_id":item["test_id"],"reason":"COST_LIMIT"});continue
            selected.append(item);selected_ids.add(item["test_id"]);cost+=item["cost"]
        return {"schema_version":"axm.verify.risk-test-selection/0.1","selected":selected,"excluded":exclusions,"total_selected_cost":cost,"max_tests":max_tests,"max_cost":max_cost,"weights":applied,"tests_executed":False,"selection_is_not_approval":True,"authority":"NONE","canon":False}
