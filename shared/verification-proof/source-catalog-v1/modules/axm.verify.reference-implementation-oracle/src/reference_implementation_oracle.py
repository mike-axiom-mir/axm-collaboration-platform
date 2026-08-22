"""Detached AXM Reference Implementation Oracle v0.1.0."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any,Dict,Mapping,Sequence
import json,math
class ReferenceOracleError(ValueError):pass
def _text(v,f):
 if not isinstance(v,str) or not v.strip():raise ReferenceOracleError(f"{f} must be a non-empty string")
 return v.strip()
def _canon(v):
 try:return json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False,allow_nan=False)
 except (TypeError,ValueError) as e:raise ReferenceOracleError("case values must be canonical JSON") from e
@dataclass(frozen=True)
class ReferenceImplementationOracle:
 oracle_id:str
 profile:str="CANONICAL_JSON"
 absolute_tolerance:float=0.0
 def __post_init__(self):
  object.__setattr__(self,"oracle_id",_text(self.oracle_id,"oracle_id"));p=_text(self.profile,"profile").upper()
  if p not in {"EXACT","CANONICAL_JSON","NUMERIC_TOLERANCE"}:raise ReferenceOracleError("unsupported profile")
  if not isinstance(self.absolute_tolerance,(int,float)) or isinstance(self.absolute_tolerance,bool) or not math.isfinite(self.absolute_tolerance) or self.absolute_tolerance<0:raise ReferenceOracleError("absolute_tolerance must be finite and non-negative")
  object.__setattr__(self,"profile",p)
 def evaluate(self,reference_identity:str,candidate_identity:str,scope_id:str,cases:Sequence[Mapping[str,Any]])->Dict[str,Any]:
  reference_identity=_text(reference_identity,"reference_identity");candidate_identity=_text(candidate_identity,"candidate_identity");scope_id=_text(scope_id,"scope_id")
  if reference_identity==candidate_identity:raise ReferenceOracleError("reference and candidate identities must differ")
  if not isinstance(cases,(list,tuple)) or not cases:raise ReferenceOracleError("cases must be non-empty")
  seen=set();results=[]
  for i,c in enumerate(cases):
   if not isinstance(c,Mapping):raise ReferenceOracleError(f"cases[{i}] must be an object")
   cid=_text(c.get("case_id"),"case_id")
   if cid in seen:raise ReferenceOracleError(f"duplicate case_id: {cid}")
   seen.add(cid);r=c.get("reference_output");a=c.get("candidate_output")
   if self.profile=="EXACT":match=type(r) is type(a) and r==a
   elif self.profile=="CANONICAL_JSON":match=_canon(r)==_canon(a)
   else:
    if not isinstance(r,(int,float)) or isinstance(r,bool) or not isinstance(a,(int,float)) or isinstance(a,bool) or not math.isfinite(r) or not math.isfinite(a):raise ReferenceOracleError("NUMERIC_TOLERANCE requires finite numbers")
    match=abs(a-r)<=self.absolute_tolerance
   results.append({"case_id":cid,"state":"PASS" if match else "FAIL"})
  verdict="PASS" if all(x["state"]=="PASS" for x in results) else "FAIL"
  return {"schema_version":"axm.verify.reference-oracle-receipt/0.1","oracle_id":self.oracle_id,"reference_identity":reference_identity,"candidate_identity":candidate_identity,"scope_id":scope_id,"profile":self.profile,"absolute_tolerance":self.absolute_tolerance,"verdict_state":verdict,"cases":results,"reference_trust_proven":False,"authority":"NONE","canon":False}
