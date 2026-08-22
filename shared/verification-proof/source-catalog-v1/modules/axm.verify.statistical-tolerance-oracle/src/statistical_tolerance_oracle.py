"""Detached AXM Statistical and Tolerance Oracle v0.1.0."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any,Dict,Sequence
import math,statistics
class StatisticalOracleError(ValueError):pass
def _text(v,f):
 if not isinstance(v,str) or not v.strip():raise StatisticalOracleError(f"{f} must be a non-empty string")
 return v.strip()
def _finite(v,f):
 if not isinstance(v,(int,float)) or isinstance(v,bool) or not math.isfinite(v):raise StatisticalOracleError(f"{f} must be a finite number")
 return float(v)
@dataclass(frozen=True)
class StatisticalToleranceOracle:
 oracle_id:str
 target:float
 mode:str="MEAN_WITHIN"
 absolute_tolerance:float|None=None
 relative_tolerance:float|None=None
 min_samples:int=1
 required_proportion:float=1.0
 def __post_init__(self):
  object.__setattr__(self,"oracle_id",_text(self.oracle_id,"oracle_id"));object.__setattr__(self,"target",_finite(self.target,"target"));mode=_text(self.mode,"mode").upper()
  if mode not in {"ALL_WITHIN","MEAN_WITHIN","PROPORTION_WITHIN"}:raise StatisticalOracleError("unsupported mode")
  object.__setattr__(self,"mode",mode)
  if self.absolute_tolerance is None and self.relative_tolerance is None:raise StatisticalOracleError("at least one tolerance is required")
  for field in ("absolute_tolerance","relative_tolerance"):
   v=getattr(self,field)
   if v is not None:
    v=_finite(v,field)
    if v<0:raise StatisticalOracleError(f"{field} must be non-negative")
    object.__setattr__(self,field,v)
  if not isinstance(self.min_samples,int) or isinstance(self.min_samples,bool) or self.min_samples<1:raise StatisticalOracleError("min_samples must be a positive integer")
  rp=_finite(self.required_proportion,"required_proportion")
  if rp<0 or rp>1:raise StatisticalOracleError("required_proportion must be between 0 and 1")
  object.__setattr__(self,"required_proportion",rp)
 def _tolerance(self):
  vals=[]
  if self.absolute_tolerance is not None:vals.append(self.absolute_tolerance)
  if self.relative_tolerance is not None:vals.append(abs(self.target)*self.relative_tolerance)
  return max(vals)
 def evaluate(self,observations:Sequence[float])->Dict[str,Any]:
  if not isinstance(observations,(list,tuple)) or not observations:raise StatisticalOracleError("observations must be non-empty")
  values=[_finite(v,f"observations[{i}]") for i,v in enumerate(observations)];n=len(values);tol=self._tolerance();within=[abs(v-self.target)<=tol for v in values];proportion=sum(within)/n;mean=statistics.fmean(values);stdev=statistics.pstdev(values) if n>1 else 0.0;se=stdev/math.sqrt(n);ci=[mean-1.96*se,mean+1.96*se]
  if n<self.min_samples:verdict="UNKNOWN";reason="INSUFFICIENT_SAMPLE_SIZE"
  else:
   if self.mode=="ALL_WITHIN":ok=all(within)
   elif self.mode=="MEAN_WITHIN":ok=abs(mean-self.target)<=tol
   else:ok=proportion>=self.required_proportion
   verdict="PASS" if ok else "FAIL";reason=None
  return {"schema_version":"axm.verify.statistical-tolerance-receipt/0.1","oracle_id":self.oracle_id,"mode":self.mode,"target":self.target,"effective_tolerance":tol,"sample_count":n,"min_samples":self.min_samples,"mean":mean,"population_stdev":stdev,"standard_error":se,"normal_approximation_95_interval":ci,"within_tolerance_count":sum(within),"within_tolerance_proportion":proportion,"required_proportion":self.required_proportion,"verdict_state":verdict,"reason":reason,"interval_assumption":"NORMAL_APPROXIMATION_DESCRIPTIVE_ONLY","population_representativeness_proven":False,"authority":"NONE","canon":False}
