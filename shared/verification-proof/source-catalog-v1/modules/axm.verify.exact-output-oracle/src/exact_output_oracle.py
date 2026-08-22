"""Detached AXM Exact Expected-Output Oracle v0.1.0."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict
import base64,binascii,hashlib,json
class ExactOutputError(ValueError): pass
def _text(v,f):
 if not isinstance(v,str) or not v.strip(): raise ExactOutputError(f"{f} must be a non-empty string")
 return v.strip()
def _canonical(v):
 try:return json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False).encode()
 except (TypeError,ValueError) as e: raise ExactOutputError("value must be canonical JSON") from e
def _first_diff(a:bytes,b:bytes):
 for i,(x,y) in enumerate(zip(a,b)):
  if x!=y:return i
 return min(len(a),len(b)) if len(a)!=len(b) else None
@dataclass(frozen=True)
class ExactOutputOracle:
 oracle_id:str
 mode:str
 def __post_init__(self):
  object.__setattr__(self,"oracle_id",_text(self.oracle_id,"oracle_id")); mode=_text(self.mode,"mode").upper()
  if mode not in {"SCALAR","TEXT","CANONICAL_JSON","BYTES_BASE64","STATE_TRANSITION"}: raise ExactOutputError("unsupported mode")
  object.__setattr__(self,"mode",mode)
 def evaluate(self,case_id:str,expected:Any,actual:Any)->Dict[str,Any]:
  case_id=_text(case_id,"case_id")
  if self.mode=="SCALAR":
   allowed=(str,int,float,bool,type(None))
   if not isinstance(expected,allowed) or not isinstance(actual,allowed): raise ExactOutputError("SCALAR requires JSON scalar values")
   match=type(expected) is type(actual) and expected==actual; eb=_canonical(expected);ab=_canonical(actual)
  elif self.mode=="TEXT":
   if not isinstance(expected,str) or not isinstance(actual,str): raise ExactOutputError("TEXT requires strings")
   eb=expected.encode();ab=actual.encode();match=eb==ab
  elif self.mode=="BYTES_BASE64":
   if not isinstance(expected,str) or not isinstance(actual,str): raise ExactOutputError("BYTES_BASE64 requires strings")
   try:eb=base64.b64decode(expected,validate=True);ab=base64.b64decode(actual,validate=True)
   except (binascii.Error,ValueError) as e: raise ExactOutputError("invalid base64") from e
   match=eb==ab
  elif self.mode=="STATE_TRANSITION":
   for value in (expected,actual):
    if not isinstance(value,dict) or set(value)!={"before","event","after"}: raise ExactOutputError("STATE_TRANSITION requires before, event, and after")
   eb=_canonical(expected);ab=_canonical(actual);match=eb==ab
  else:
   eb=_canonical(expected);ab=_canonical(actual);match=eb==ab
  return {"schema_version":"axm.verify.exact-output-receipt/0.1","oracle_id":self.oracle_id,"case_id":case_id,"mode":self.mode,"verdict_state":"PASS" if match else "FAIL","exact_match":match,"expected_sha256":hashlib.sha256(eb).hexdigest(),"actual_sha256":hashlib.sha256(ab).hexdigest(),"expected_bytes":len(eb),"actual_bytes":len(ab),"first_difference_offset":_first_diff(eb,ab),"authority":"NONE","canon":False}
