"""Detached AXM Formal Model Checker Adapter v0.1.0."""
from __future__ import annotations
from hashlib import sha256
from typing import Any, Dict, Mapping, Sequence
import json

class FormalAdapterError(ValueError): pass

def _canonical(value): return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False,allow_nan=False).encode()
def _text(value,name):
    if not isinstance(value,str) or not value.strip(): raise FormalAdapterError(f"{name} must be non-empty")
    return value.strip()

class FormalModelCheckerAdapter:
    def create_request(self, *, model: str, properties: Sequence[str], assumptions: Sequence[str], bounds: Mapping[str,int], tool_name: str, tool_version: str) -> Dict[str,Any]:
        model=_text(model,"model");props=[_text(x,"property") for x in properties]
        if not props: raise FormalAdapterError("at least one property required")
        clean_bounds={}
        for key,value in sorted(bounds.items()):
            if isinstance(value,bool) or not isinstance(value,int) or value<0: raise FormalAdapterError("bounds must be non-negative integers")
            clean_bounds[_text(key,"bound name")]=value
        request={"schema_version":"axm.verify.formal-model-request/0.1","model":model,"model_sha256":sha256(model.encode()).hexdigest(),"properties":props,"assumptions":[_text(x,"assumption") for x in assumptions],"bounds":clean_bounds,"tool":{"name":_text(tool_name,"tool_name"),"version":_text(tool_version,"tool_version")},"checker_executed_by_adapter":False}
        request["request_sha256"]=sha256(_canonical(request)).hexdigest();return request
    def normalize_result(self, request: Mapping[str,Any], raw_result: Mapping[str,Any]) -> Dict[str,Any]:
        status=raw_result.get("status")
        if status not in {"VERIFIED","COUNTEREXAMPLE","UNKNOWN","ERROR"}: raise FormalAdapterError("unsupported result status")
        counterexample=raw_result.get("counterexample")
        if status=="COUNTEREXAMPLE" and counterexample is None: raise FormalAdapterError("counterexample trace required")
        verdict={"VERIFIED":"PASS","COUNTEREXAMPLE":"FAIL","UNKNOWN":"UNKNOWN","ERROR":"UNKNOWN"}[status]
        return {"schema_version":"axm.verify.formal-model-result-receipt/0.1","request_sha256":request.get("request_sha256"),"tool":request.get("tool"),"properties":request.get("properties"),"assumptions":request.get("assumptions"),"bounds":request.get("bounds"),"tool_status":status,"verdict_state":verdict,"counterexample":counterexample,"diagnostics":raw_result.get("diagnostics",[]),"raw_result_sha256":sha256(_canonical(dict(raw_result))).hexdigest(),"result_source":"CALLER_SUPPLIED","bounded_scope_only":True,"authority":"NONE","canon":False}
