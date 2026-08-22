"""Detached AXM Filesystem and Environment Variance Matrix v0.1.0."""
from __future__ import annotations
from itertools import product
from typing import Any, Dict, Mapping, Sequence
import hashlib,json,math
class VarianceMatrixError(ValueError):pass
def _text(v:Any,f:str)->str:
 if not isinstance(v,str) or not v.strip():raise VarianceMatrixError(f"{f} must be non-empty")
 return v.strip()
class FilesystemEnvironmentVarianceMatrix:
 def __init__(self,matrix_id:str,dimensions:Mapping[str,Sequence[str]],strategy:str="BOUNDARY_COVERAGE",max_cases:int=256):
  self.matrix_id=_text(matrix_id,"matrix_id");self.strategy=_text(strategy,"strategy").upper()
  if self.strategy not in {"FULL_CARTESIAN","BOUNDARY_COVERAGE"}:raise VarianceMatrixError("unknown strategy")
  if isinstance(max_cases,bool) or not isinstance(max_cases,int) or max_cases<1:raise VarianceMatrixError("max_cases must be positive")
  if not isinstance(dimensions,Mapping) or not dimensions:raise VarianceMatrixError("dimensions must be non-empty")
  out={}
  for k,values in dimensions.items():
   key=_text(k,"dimension name")
   if not isinstance(values,(list,tuple)) or not values:raise VarianceMatrixError("empty dimension")
   vals=tuple(_text(x,key) for x in values)
   if len(vals)!=len(set(vals)):raise VarianceMatrixError("duplicate dimension value")
   out[key]=vals
  self.dimensions=dict(sorted(out.items()));self.max_cases=max_cases
 def _scenario(self,values:Dict[str,str])->Dict[str,Any]:
  canonical=json.dumps(values,sort_keys=True,separators=(",",":")).encode();sid=hashlib.sha256(canonical).hexdigest()[:16]
  return {"scenario_id":f"{self.matrix_id}:{sid}","values":values}
 def compile(self)->Dict[str,Any]:
  names=list(self.dimensions);defaults={k:self.dimensions[k][0] for k in names};cases=[]
  if self.strategy=="FULL_CARTESIAN":
   count=math.prod(len(self.dimensions[k]) for k in names)
   if count>self.max_cases:raise VarianceMatrixError("matrix exceeds max_cases")
   cases=[self._scenario(dict(zip(names,vals))) for vals in product(*(self.dimensions[k] for k in names))]
  else:
   raw=[defaults.copy()]
   for name in names:
    for value in self.dimensions[name][1:]:
     c=defaults.copy();c[name]=value;raw.append(c)
   if len(raw)>self.max_cases:raise VarianceMatrixError("boundary coverage requires more than max_cases")
   cases=[self._scenario(x) for x in raw]
  coverage={k:sorted({c["values"][k] for c in cases}) for k in names}
  return {"schema_version":"axm.verify.filesystem-environment-variance-matrix/0.1","matrix_id":self.matrix_id,"strategy":self.strategy,"case_count":len(cases),"max_cases":self.max_cases,"cases":cases,"value_coverage":coverage,"host_filesystem_mutated":False,"host_environment_mutated":False,"executed":False,"authority":"NONE","canon":False}
