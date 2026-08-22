"""Detached AXM Combinatorial Interaction Matrix Generator v0.1.0."""
from __future__ import annotations
from itertools import combinations, product
import json
from typing import Any, Dict, Mapping, Sequence

class InteractionMatrixError(ValueError):pass
def canonical(value:Any)->str:return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False)
class CombinatorialInteractionMatrixGenerator:
    def generate(self,factors:Mapping[str,Sequence[Any]],*,strength:int=2,max_cases:int=100,product_ceiling:int=10000)->Dict[str,Any]:
        if not isinstance(factors,Mapping) or len(factors)<2:raise InteractionMatrixError("at least two factors required")
        if isinstance(strength,bool) or not isinstance(strength,int) or not 2<=strength<=len(factors):raise InteractionMatrixError("invalid interaction strength")
        if isinstance(max_cases,bool) or not isinstance(max_cases,int) or max_cases<1:raise InteractionMatrixError("max_cases must be positive")
        names=sorted(factors);values=[];product_size=1
        for name in names:
            vals=factors[name]
            if not isinstance(name,str) or not name or isinstance(vals,(str,bytes)) or not vals:raise InteractionMatrixError("factor values must be non-empty sequences")
            keys=[canonical(x) for x in vals]
            if len(set(keys))!=len(keys):raise InteractionMatrixError("duplicate factor values")
            values.append(list(vals));product_size*=len(vals)
        if product_size>product_ceiling:raise InteractionMatrixError("cartesian product exceeds ceiling")
        candidates=[]
        for combo in product(*values):
            row=dict(zip(names,combo));interactions=set()
            for group in combinations(names,strength):interactions.add(tuple((name,canonical(row[name])) for name in group))
            candidates.append((canonical(row),row,interactions))
        universe=set().union(*(x[2] for x in candidates));uncovered=set(universe);selected=[]
        while uncovered and len(selected)<max_cases:
            best=max(candidates,key=lambda x:(len(x[2]&uncovered),-len(x[0]),x[0]))
            gain=best[2]&uncovered
            if not gain:break
            selected.append(best[1]);uncovered-=gain;candidates.remove(best)
        ratio=1.0 if not universe else (len(universe)-len(uncovered))/len(universe)
        return {"schema_version":"axm.verify.combinatorial-matrix/0.1","strength":strength,"cases":selected,"case_count":len(selected),"interaction_count":len(universe),"covered_interaction_count":len(universe)-len(uncovered),"coverage_ratio":ratio,"uncovered_interactions":[list(item) for item in sorted(uncovered)],"complete":not uncovered,"brute_force_output":False,"target_executed":False,"authority":"NONE","canon":False}
