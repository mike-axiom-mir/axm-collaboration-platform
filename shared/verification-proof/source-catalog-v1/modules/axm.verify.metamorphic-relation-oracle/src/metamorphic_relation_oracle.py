"""Detached AXM Metamorphic Relation Oracle v0.1.0."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any,Dict,Mapping,Sequence
import json,math
class MetamorphicOracleError(ValueError):pass
def _text(v,f):
 if not isinstance(v,str) or not v.strip():raise MetamorphicOracleError(f"{f} must be a non-empty string")
 return v.strip()
def _canon(v):
 try:return json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False,allow_nan=False)
 except (TypeError,ValueError) as e:raise MetamorphicOracleError("values must be canonical JSON") from e
def _num(v):return isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)
@dataclass(frozen=True)
class MetamorphicRelationOracle:
 oracle_id:str
 def __post_init__(self):object.__setattr__(self,"oracle_id",_text(self.oracle_id,"oracle_id"))
 def evaluate(self,cases:Sequence[Mapping[str,Any]])->Dict[str,Any]:
  if not isinstance(cases,(list,tuple)) or not cases:raise MetamorphicOracleError("cases must be non-empty")
  seen=set();results=[]
  for c in cases:
   if not isinstance(c,Mapping):raise MetamorphicOracleError("case must be an object")
   cid=_text(c.get("case_id"),"case_id")
   if cid in seen:raise MetamorphicOracleError(f"duplicate case_id: {cid}")
   seen.add(cid);rel=c.get("relation")
   if not isinstance(rel,Mapping):raise MetamorphicOracleError("relation must be an object")
   op=_text(rel.get("operator"),"operator").upper();b=c.get("base_output");t=c.get("transformed_output")
   if op=="EQUAL":ok=_canon(b)==_canon(t)
   elif op=="NOT_EQUAL":ok=_canon(b)!=_canon(t)
   elif op in {"MONOTONIC_NON_DECREASING","MONOTONIC_NON_INCREASING"}:
    if not _num(b) or not _num(t):raise MetamorphicOracleError("monotonic relations require finite numbers")
    ok=t>=b if op.endswith("DECREASING") else t<=b
   elif op=="SCALE_BY":
    factor=rel.get("factor");tol=rel.get("absolute_tolerance",0)
    if not _num(b) or not _num(t) or not _num(factor) or not _num(tol) or tol<0:raise MetamorphicOracleError("SCALE_BY requires finite numeric values")
    ok=abs(t-b*factor)<=tol
   elif op=="PERMUTATION_INVARIANT":
    if not isinstance(b,list) or not isinstance(t,list):raise MetamorphicOracleError("PERMUTATION_INVARIANT requires lists")
    ok=sorted(_canon(x) for x in b)==sorted(_canon(x) for x in t)
   elif op=="SUBSET":
    if not isinstance(b,list) or not isinstance(t,list):raise MetamorphicOracleError("SUBSET requires lists")
    base={_canon(x) for x in b};trans={_canon(x) for x in t};ok=trans.issubset(base)
   elif op=="LENGTH_DELTA":
    delta=rel.get("delta")
    if not isinstance(delta,int) or isinstance(delta,bool) or not hasattr(b,"__len__") or not hasattr(t,"__len__"):raise MetamorphicOracleError("LENGTH_DELTA requires sized values and integer delta")
    ok=len(t)-len(b)==delta
   else:raise MetamorphicOracleError(f"unsupported relation: {op}")
   results.append({"case_id":cid,"operator":op,"state":"PASS" if ok else "FAIL"})
  verdict="PASS" if all(x["state"]=="PASS" for x in results) else "FAIL"
  return {"schema_version":"axm.verify.metamorphic-oracle-receipt/0.1","oracle_id":self.oracle_id,"verdict_state":verdict,"cases":results,"transformation_executed":False,"authority":"NONE","canon":False}
