"""Detached AXM Differential Oracle v0.1.0."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any,Dict,Mapping,Sequence
import hashlib,json
class DifferentialOracleError(ValueError):pass
def _text(v,f):
 if not isinstance(v,str) or not v.strip():raise DifferentialOracleError(f"{f} must be a non-empty string")
 return v.strip()
def _canon(v):
 try:return json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False,allow_nan=False)
 except (TypeError,ValueError) as e:raise DifferentialOracleError("outputs must be canonical JSON") from e
@dataclass(frozen=True)
class DifferentialOracle:
 oracle_id:str
 def __post_init__(self):object.__setattr__(self,"oracle_id",_text(self.oracle_id,"oracle_id"))
 def evaluate(self,implementations:Sequence[str],cases:Sequence[Mapping[str,Any]])->Dict[str,Any]:
  if not isinstance(implementations,(list,tuple)) or len(implementations)<2:raise DifferentialOracleError("at least two implementations required")
  ids=[]
  for i,x in enumerate(implementations):
   t=_text(x,f"implementations[{i}]")
   if t in ids:raise DifferentialOracleError(f"duplicate implementation: {t}")
   ids.append(t)
  if not isinstance(cases,(list,tuple)) or not cases:raise DifferentialOracleError("cases must be non-empty")
  seen=set();results=[]
  for c in cases:
   if not isinstance(c,Mapping):raise DifferentialOracleError("case must be an object")
   cid=_text(c.get("case_id"),"case_id")
   if cid in seen:raise DifferentialOracleError(f"duplicate case_id: {cid}")
   seen.add(cid);outputs=c.get("outputs")
   if not isinstance(outputs,Mapping):raise DifferentialOracleError("outputs must be an object")
   missing=[x for x in ids if x not in outputs]
   clusters={}
   for impl in ids:
    if impl in outputs:
     canonical=_canon(outputs[impl]);digest=hashlib.sha256(canonical.encode()).hexdigest();clusters.setdefault(digest,[]).append(impl)
   cluster_list=[{"output_sha256":k,"implementations":sorted(v)} for k,v in sorted(clusters.items())]
   state="UNKNOWN" if missing else ("AGREEMENT" if len(cluster_list)==1 else "DISAGREEMENT")
   results.append({"case_id":cid,"state":state,"missing_implementations":missing,"clusters":cluster_list})
  states={x["state"] for x in results};overall="DISAGREEMENT" if "DISAGREEMENT" in states else ("UNKNOWN" if "UNKNOWN" in states else "AGREEMENT")
  return {"schema_version":"axm.verify.differential-oracle-receipt/0.1","oracle_id":self.oracle_id,"implementations":ids,"state":overall,"cases":results,"winner":None,"majority_means_truth":False,"authority":"NONE","canon":False}
