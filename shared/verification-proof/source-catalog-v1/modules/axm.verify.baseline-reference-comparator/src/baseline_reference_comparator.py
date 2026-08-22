"""Detached AXM Baseline and Reference Comparator v0.1.0."""
from __future__ import annotations
import math,statistics
from typing import Any,Dict,Mapping,Sequence
class BaselineComparisonError(ValueError):pass

def _values(record:Mapping[str,Any],label:str)->list[float]:
    if not isinstance(record,Mapping) or not isinstance(record.get("name"),str) or not record.get("name") or not isinstance(record.get("version"),str) or not record.get("version"):raise BaselineComparisonError(f"{label} identity required")
    raw=record.get("samples")
    if not isinstance(raw,Sequence) or isinstance(raw,(str,bytes)) or not raw:raise BaselineComparisonError(f"{label} samples required")
    vals=[]
    for x in raw:
        if isinstance(x,bool) or not isinstance(x,(int,float)) or not math.isfinite(x):raise BaselineComparisonError("finite numeric samples required")
        vals.append(float(x))
    return vals
class BaselineReferenceComparator:
    def compare(self,candidate:Mapping[str,Any],baseline:Mapping[str,Any],direction:str,practical_threshold:float=0.0)->Dict[str,Any]:
        if direction not in {"HIGHER_BETTER","LOWER_BETTER"}:raise BaselineComparisonError("invalid direction")
        if isinstance(practical_threshold,bool) or not isinstance(practical_threshold,(int,float)) or practical_threshold<0 or not math.isfinite(practical_threshold):raise BaselineComparisonError("invalid practical threshold")
        c=_values(candidate,"candidate");b=_values(baseline,"baseline");cm=statistics.fmean(c);bm=statistics.fmean(b);raw=cm-bm;signed=raw if direction=="HIGHER_BETTER" else -raw
        significance="POSITIVE" if signed>practical_threshold else ("NEGATIVE" if signed < -practical_threshold else "NEGLIGIBLE")
        verdict="PASS" if significance=="POSITIVE" else ("FAIL" if significance=="NEGATIVE" else "UNKNOWN")
        cr=(min(c),max(c));br=(min(b),max(b));overlap=not (cr[1]<br[0] or br[1]<cr[0])
        return {"schema_version":"axm.verify.baseline-reference-comparison/0.1","verdict_state":verdict,"candidate":{"name":candidate["name"],"version":candidate["version"],"configuration":candidate.get("configuration"),"n":len(c),"mean":cm,"range":list(cr)},"baseline":{"name":baseline["name"],"version":baseline["version"],"configuration":baseline.get("configuration"),"n":len(b),"mean":bm,"range":list(br)},"direction":direction,"raw_difference":raw,"signed_improvement":signed,"relative_difference":None if bm==0 else raw/abs(bm),"practical_threshold":float(practical_threshold),"practical_significance":significance,"ranges_overlap":overlap,"uncertainty_retained":True,"universal_superiority":False,"authority":"NONE","canon":False}
