"""Detached AXM Benchmark Environment Normalizer v0.1.0."""
from __future__ import annotations
import hashlib,json,math
from typing import Any,Dict,Mapping,Sequence
class BenchmarkEnvironmentError(ValueError):pass
DEFAULT_FIELDS=("hardware","software","load","temperature","cache_state","network","randomness","warmup")
def _clean(value:Any,secrets:set[str],path:str="")->Any:
    if value is None or isinstance(value,(str,bool,int)):return value
    if isinstance(value,float):
        if not math.isfinite(value):raise BenchmarkEnvironmentError("non-finite number")
        return value
    if isinstance(value,Mapping):
        out={}
        for k in sorted(value):
            if not isinstance(k,str):raise BenchmarkEnvironmentError("string keys required")
            out[k]="[REDACTED]" if k.lower() in secrets else _clean(value[k],secrets,path+"/"+k)
        return out
    if isinstance(value,Sequence) and not isinstance(value,(str,bytes)):return [_clean(x,secrets,path) for x in value]
    raise BenchmarkEnvironmentError("environment must be deterministic JSON")
class BenchmarkEnvironmentNormalizer:
    def normalize(self,profile:Mapping[str,Any],required_fields:Sequence[str]=DEFAULT_FIELDS,secret_keys:Sequence[str]=("token","password","secret","api_key"))->Dict[str,Any]:
        if not isinstance(profile,Mapping):raise BenchmarkEnvironmentError("profile mapping required")
        if not isinstance(required_fields,Sequence) or isinstance(required_fields,(str,bytes)) or any(not isinstance(x,str) or not x for x in required_fields):raise BenchmarkEnvironmentError("valid required fields needed")
        secrets={x.lower() for x in secret_keys if isinstance(x,str)};normalized=_clean(profile,secrets);missing=sorted(set(required_fields)-set(normalized));unknown=sorted(k for k,v in normalized.items() if v in (None,"",{},[]))
        payload=json.dumps(normalized,sort_keys=True,separators=(",",":"),ensure_ascii=False,allow_nan=False).encode()
        return {"schema_version":"axm.verify.benchmark-environment/0.1","verdict_state":"UNKNOWN" if missing or unknown else "PASS","normalized_profile":normalized,"profile_sha256":hashlib.sha256(payload).hexdigest(),"missing_fields":missing,"unknown_fields":unknown,"host_environment_changed":False,"conditions_controlled":False,"authority":"NONE","canon":False}
