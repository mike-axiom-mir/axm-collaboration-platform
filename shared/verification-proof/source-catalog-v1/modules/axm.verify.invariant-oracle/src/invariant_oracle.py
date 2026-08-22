"""Detached AXM Invariant Oracle v0.1.0."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any,Dict,Mapping,Sequence
class InvariantOracleError(ValueError):pass
_MISSING=object()
def _text(v,f):
 if not isinstance(v,str) or not v.strip():raise InvariantOracleError(f"{f} must be a non-empty string")
 return v.strip()
def _resolve(data,path):
 if path=="":return data
 if not isinstance(path,str) or not path.startswith("/"):raise InvariantOracleError("path must be a JSON Pointer")
 cur=data
 for raw in path.split("/")[1:]:
  key=raw.replace("~1","/").replace("~0","~")
  if isinstance(cur,dict):
   if key not in cur:return _MISSING
   cur=cur[key]
  elif isinstance(cur,list):
   try:i=int(key)
   except ValueError:return _MISSING
   if i<0 or i>=len(cur):return _MISSING
   cur=cur[i]
  else:return _MISSING
 return cur
@dataclass(frozen=True)
class InvariantOracle:
 oracle_id:str
 def __post_init__(self):object.__setattr__(self,"oracle_id",_text(self.oracle_id,"oracle_id"))
 def evaluate(self,state:Any,invariants:Sequence[Mapping[str,Any]])->Dict[str,Any]:
  if not isinstance(invariants,(list,tuple)) or not invariants:raise InvariantOracleError("invariants must be a non-empty list")
  seen=set();results=[]
  for i,inv in enumerate(invariants):
   if not isinstance(inv,Mapping):raise InvariantOracleError(f"invariants[{i}] must be an object")
   iid=_text(inv.get("invariant_id"),"invariant_id")
   if iid in seen:raise InvariantOracleError(f"duplicate invariant_id: {iid}")
   seen.add(iid);op=_text(inv.get("operator"),"operator").upper();path=inv.get("path","");value=_resolve(state,path)
   detail=None
   if op=="EXISTS":status="PASS" if value is not _MISSING else "FAIL"
   elif value is _MISSING:status="UNKNOWN";detail="PATH_MISSING"
   elif op=="EQUALS":status="PASS" if type(value) is type(inv.get("expected")) and value==inv.get("expected") else "FAIL"
   elif op=="TYPE_IS":
    name=_text(inv.get("expected_type"),"expected_type").lower();types={"string":str,"integer":int,"number":(int,float),"boolean":bool,"object":dict,"array":list,"null":type(None)}
    if name not in types:raise InvariantOracleError("unsupported expected_type")
    ok=isinstance(value,types[name]) and not (name in {"integer","number"} and isinstance(value,bool));status="PASS" if ok else "FAIL"
   elif op in {"MIN","MAX"}:
    expected=inv.get("expected");
    if not isinstance(value,(int,float)) or isinstance(value,bool) or not isinstance(expected,(int,float)) or isinstance(expected,bool):status="FAIL";detail="NON_NUMERIC"
    else:status="PASS" if (value>=expected if op=="MIN" else value<=expected) else "FAIL"
   elif op=="NONEMPTY":status="PASS" if hasattr(value,"__len__") and len(value)>0 else "FAIL"
   elif op=="UNIQUE":status="PASS" if isinstance(value,list) and len({repr(x) for x in value})==len(value) else "FAIL"
   elif op=="CONTAINS":
    expected=inv.get("expected");status="PASS" if ((isinstance(value,(list,str,dict)) and expected in value)) else "FAIL"
   else:raise InvariantOracleError(f"unsupported operator: {op}")
   results.append({"invariant_id":iid,"operator":op,"path":path,"state":status,"detail":detail})
  states={x["state"] for x in results};overall="FAIL" if "FAIL" in states else ("UNKNOWN" if "UNKNOWN" in states else "PASS")
  return {"schema_version":"axm.verify.invariant-oracle-receipt/0.1","oracle_id":self.oracle_id,"verdict_state":overall,"results":results,"checked_state_only":True,"authority":"NONE","canon":False}
