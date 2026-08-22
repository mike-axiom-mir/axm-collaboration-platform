"""Detached AXM Round-Trip and Inverse Oracle v0.1.0."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any,Dict,Sequence
import json,math
class RoundTripOracleError(ValueError):pass
_MISSING=object()
def _text(v,f):
 if not isinstance(v,str) or not v.strip():raise RoundTripOracleError(f"{f} must be a non-empty string")
 return v.strip()
def _canon(v):
 try:return json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False,allow_nan=False)
 except (TypeError,ValueError) as e:raise RoundTripOracleError("values must be canonical JSON") from e
def _resolve(data,path):
 if path=="":return data
 if not isinstance(path,str) or not path.startswith("/"):raise RoundTripOracleError("path must be a JSON Pointer")
 cur=data
 for raw in path.split("/")[1:]:
  key=raw.replace("~1","/").replace("~0","~")
  if isinstance(cur,dict) and key in cur:cur=cur[key]
  elif isinstance(cur,list):
   try:i=int(key)
   except ValueError:return _MISSING
   if i<0 or i>=len(cur):return _MISSING
   cur=cur[i]
  else:return _MISSING
 return cur
@dataclass(frozen=True)
class RoundTripInverseOracle:
 oracle_id:str
 def __post_init__(self):object.__setattr__(self,"oracle_id",_text(self.oracle_id,"oracle_id"))
 def evaluate(self,case_id:str,original:Any,restored:Any,profile:str="CANONICAL_JSON",selected_paths:Sequence[str]=(),absolute_tolerance:float=0.0,forward_id:str|None=None,inverse_id:str|None=None)->Dict[str,Any]:
  case_id=_text(case_id,"case_id");p=_text(profile,"profile").upper();details=[]
  if p=="EXACT":ok=type(original) is type(restored) and original==restored
  elif p=="CANONICAL_JSON":ok=_canon(original)==_canon(restored)
  elif p=="SELECTED_PATHS":
   if not isinstance(selected_paths,(list,tuple)) or not selected_paths:raise RoundTripOracleError("selected_paths required")
   ok=True
   for path in selected_paths:
    a=_resolve(original,path);b=_resolve(restored,path);match=a is not _MISSING and b is not _MISSING and _canon(a)==_canon(b);details.append({"path":path,"state":"PASS" if match else "FAIL"});ok=ok and match
  elif p=="NUMERIC_TOLERANCE":
   if not isinstance(original,(int,float)) or isinstance(original,bool) or not isinstance(restored,(int,float)) or isinstance(restored,bool) or not math.isfinite(original) or not math.isfinite(restored):raise RoundTripOracleError("NUMERIC_TOLERANCE requires finite numbers")
   if not isinstance(absolute_tolerance,(int,float)) or isinstance(absolute_tolerance,bool) or not math.isfinite(absolute_tolerance) or absolute_tolerance<0:raise RoundTripOracleError("invalid absolute_tolerance")
   ok=abs(restored-original)<=absolute_tolerance
  else:raise RoundTripOracleError("unsupported profile")
  return {"schema_version":"axm.verify.roundtrip-oracle-receipt/0.1","oracle_id":self.oracle_id,"case_id":case_id,"profile":p,"forward_id":forward_id,"inverse_id":inverse_id,"verdict_state":"PASS" if ok else "FAIL","details":details,"operations_executed":False,"authority":"NONE","canon":False}
