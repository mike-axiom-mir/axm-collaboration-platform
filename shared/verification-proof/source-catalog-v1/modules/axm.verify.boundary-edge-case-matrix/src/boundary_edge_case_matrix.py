"""Detached AXM Boundary and Edge-Case Matrix Generator v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping

TYPES={"integer","number","string","sequence","boolean"}
class BoundaryMatrixError(ValueError):pass
class BoundaryEdgeCaseMatrixGenerator:
    def generate(self,fields:Mapping[str,Mapping[str,Any]],*,max_cases:int=200)->Dict[str,Any]:
        if not isinstance(fields,Mapping) or not fields:raise BoundaryMatrixError("fields must be non-empty mapping")
        if isinstance(max_cases,bool) or not isinstance(max_cases,int) or max_cases<1:raise BoundaryMatrixError("max_cases must be positive")
        cases=[]
        def add(field,kind,value=None,present=True):
            if len(cases)<max_cases:cases.append({"case_id":f"{field}:{kind}","field":field,"case_kind":kind,"present":present,**({"value":value} if present else {})})
        for field,spec in fields.items():
            if not isinstance(field,str) or not field or not isinstance(spec,Mapping) or spec.get("type") not in TYPES:raise BoundaryMatrixError("invalid field or type")
            kind=spec["type"]
            if kind in {"integer","number"}:
                minimum=spec.get("minimum");maximum=spec.get("maximum")
                if not isinstance(minimum,(int,float)) or isinstance(minimum,bool) or not isinstance(maximum,(int,float)) or isinstance(maximum,bool) or minimum>maximum:raise BoundaryMatrixError("numeric fields require valid minimum and maximum")
                add(field,"minimum",minimum);add(field,"maximum",maximum)
                if minimum<=0<=maximum:add(field,"zero",0)
                add(field,"below_minimum",minimum-1);add(field,"overflow",maximum+1)
            elif kind=="string":
                minimum=spec.get("min_length",0);maximum=spec.get("max_length")
                if not isinstance(minimum,int) or isinstance(minimum,bool) or not isinstance(maximum,int) or isinstance(maximum,bool) or minimum<0 or maximum<minimum:raise BoundaryMatrixError("string lengths invalid")
                add(field,"empty","");add(field,"minimum","x"*minimum);add(field,"maximum","x"*maximum);add(field,"overflow","x"*(maximum+1));add(field,"truncation",("x"*maximum)[:-1]);add(field,"corruption","x\x00y")
            elif kind=="sequence":
                minimum=spec.get("min_items",0);maximum=spec.get("max_items")
                if not isinstance(minimum,int) or isinstance(minimum,bool) or not isinstance(maximum,int) or isinstance(maximum,bool) or minimum<0 or maximum<minimum:raise BoundaryMatrixError("sequence sizes invalid")
                add(field,"empty",[]);add(field,"minimum",list(range(minimum)));add(field,"maximum",list(range(maximum)));add(field,"overflow",list(range(maximum+1)));add(field,"duplication",[1,1]);add(field,"invalid_order",[2,1])
            else:
                add(field,"false",False);add(field,"true",True)
            if spec.get("nullable"):add(field,"null",None)
            if not spec.get("required",True):add(field,"missing",present=False)
        possible_more = len(cases) >= max_cases
        categories=sorted({item["case_kind"] for item in cases})
        return {"schema_version":"axm.verify.boundary-matrix/0.1","cases":cases,"generated_case_count":len(cases),"truncated":possible_more,"covered_case_kinds":categories,"target_executed":False,"generated_cases_require_domain_review":True,"authority":"NONE","canon":False}
