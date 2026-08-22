"""Detached AXM Constraint and Solver Proof Adapter v0.1.0."""
from __future__ import annotations
from hashlib import sha256
from typing import Any, Dict, Mapping, Sequence
import json

class ConstraintAdapterError(ValueError): pass

def _canonical(x):return json.dumps(x,sort_keys=True,separators=(",",":"),ensure_ascii=False,allow_nan=False).encode()
def _text(x,n):
    if not isinstance(x,str) or not x.strip():raise ConstraintAdapterError(f"{n} must be non-empty")
    return x.strip()

class ConstraintProofAdapter:
    def create_obligation(self, *, obligation_id:str, logic:str, constraints:Sequence[str], assumptions:Sequence[str]=(), expected:str, solver_name:str, solver_version:str, require_model:bool=False)->Dict[str,Any]:
        if expected not in {"SAT","UNSAT"}:raise ConstraintAdapterError("expected must be SAT or UNSAT")
        items=[_text(x,"constraint") for x in constraints]
        if not items:raise ConstraintAdapterError("at least one constraint required")
        obligation={"schema_version":"axm.verify.constraint-obligation/0.1","obligation_id":_text(obligation_id,"obligation_id"),"logic":_text(logic,"logic"),"constraints":items,"assumptions":[_text(x,"assumption") for x in assumptions],"expected":expected,"require_model":bool(require_model),"solver":{"name":_text(solver_name,"solver_name"),"version":_text(solver_version,"solver_version")},"solver_executed_by_adapter":False}
        obligation["obligation_sha256"]=sha256(_canonical(obligation)).hexdigest();return obligation
    def normalize_result(self, obligation:Mapping[str,Any], raw_result:Mapping[str,Any])->Dict[str,Any]:
        actual=raw_result.get("status")
        if actual not in {"SAT","UNSAT","UNKNOWN","ERROR"}:raise ConstraintAdapterError("unsupported solver status")
        if actual=="SAT" and obligation.get("require_model") and raw_result.get("model") is None:raise ConstraintAdapterError("SAT model required")
        if actual in {"UNKNOWN","ERROR"}:verdict="UNKNOWN"
        else:verdict="PASS" if actual==obligation.get("expected") else "FAIL"
        return {"schema_version":"axm.verify.constraint-result-receipt/0.1","obligation_sha256":obligation.get("obligation_sha256"),"solver":obligation.get("solver"),"expected":obligation.get("expected"),"actual":actual,"verdict_state":verdict,"model":raw_result.get("model"),"unsat_core":raw_result.get("unsat_core"),"diagnostics":raw_result.get("diagnostics",[]),"raw_result_sha256":sha256(_canonical(dict(raw_result))).hexdigest(),"result_source":"CALLER_SUPPLIED","authority":"NONE","canon":False}
