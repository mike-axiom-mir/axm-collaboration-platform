"""Detached AXM Statistical Confidence and Uncertainty Reporter v0.1.0."""
from __future__ import annotations
import math,statistics
from typing import Any,Dict,Sequence
class StatisticalConfidenceError(ValueError):pass

def _clean(values:Sequence[Any])->tuple[list[float],int]:
    if not isinstance(values,Sequence) or isinstance(values,(str,bytes)):raise StatisticalConfidenceError("sample sequence required")
    clean=[];missing=0
    for x in values:
        if x is None:missing+=1;continue
        if isinstance(x,bool) or not isinstance(x,(int,float)) or not math.isfinite(x):raise StatisticalConfidenceError("finite numbers or None required")
        clean.append(float(x))
    return clean,missing
def _quartiles(values:list[float])->tuple[float,float]:
    s=sorted(values);n=len(s)
    if n<4:return (min(s),max(s))
    mid=n//2;lower=s[:mid];upper=s[mid+(n%2):];return statistics.median(lower),statistics.median(upper)
def _summary(values:list[float],missing:int,z:float)->Dict[str,Any]:
    if not values:return {"n":0,"missing":missing,"mean":None,"median":None,"variance":None,"stddev":None,"standard_error":None,"normal_approx_interval":None,"outlier_indices":[]}
    mean=statistics.fmean(values);variance=statistics.variance(values) if len(values)>1 else None;std=math.sqrt(variance) if variance is not None else None;se=std/math.sqrt(len(values)) if std is not None else None;interval=[mean-z*se,mean+z*se] if se is not None else None
    q1,q3=_quartiles(values);iqr=q3-q1;lo=q1-1.5*iqr;hi=q3+1.5*iqr;out=[i for i,x in enumerate(values) if x<lo or x>hi]
    return {"n":len(values),"missing":missing,"mean":mean,"median":statistics.median(values),"variance":variance,"stddev":std,"standard_error":se,"normal_approx_interval":interval,"outlier_indices":out}
class StatisticalConfidenceReporter:
    def report(self,candidate_samples:Sequence[Any],baseline_samples:Sequence[Any]|None=None,z_value:float=1.96)->Dict[str,Any]:
        if isinstance(z_value,bool) or not isinstance(z_value,(int,float)) or not math.isfinite(z_value) or z_value<=0:raise StatisticalConfidenceError("positive finite z value required")
        c,cm=_clean(candidate_samples);b,bm=_clean(baseline_samples or [])
        cs=_summary(c,cm,float(z_value));bs=_summary(b,bm,float(z_value)) if baseline_samples is not None else None
        effect=None
        if bs and c and b:
            raw=cs["mean"]-bs["mean"];pooled=None
            if len(c)>1 and len(b)>1:
                pv=((len(c)-1)*cs["variance"]+(len(b)-1)*bs["variance"])/(len(c)+len(b)-2);pooled=raw/math.sqrt(pv) if pv>0 else None
            effect={"raw_mean_difference":raw,"standardized_mean_difference":pooled}
        enough=cs["n"]>=2 and (baseline_samples is None or (bs and bs["n"]>=2))
        return {"schema_version":"axm.verify.statistical-confidence-report/0.1","verdict_state":"PASS" if enough else "UNKNOWN","candidate":cs,"baseline":bs,"effect_size":effect,"z_value":float(z_value),"outlier_policy":"FLAG_ONLY","assumptions":["independent observations not proven","normal approximation used for mean interval","outliers retained"],"false_precision_avoided":True,"authority":"NONE","canon":False}
