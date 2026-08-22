"""Detached AXM Verification Profile Registry v0.1.0."""
from __future__ import annotations
from copy import deepcopy
from hashlib import sha256
from typing import Any, Dict, Mapping
import json
STATES={"PASS","FAIL","UNKNOWN","NOT_RUN","CONFLICTED","STALE","HUMAN_REVIEW"}
class VerificationProfileError(ValueError):pass

def _strings(value:Any,field:str)->list[str]:
    if not isinstance(value,list) or not value or any(not isinstance(x,str) or not x.strip() for x in value):raise VerificationProfileError(f"{field} must be a non-empty string list")
    out=[x.strip() for x in value]
    if len(out)!=len(set(out)):raise VerificationProfileError(f"{field} contains duplicates")
    return out

class VerificationProfileRegistry:
    def __init__(self):self._profiles:dict[str,dict[str,Any]]={}
    def register(self,profile:Mapping[str,Any])->Dict[str,Any]:
        if not isinstance(profile,Mapping):raise VerificationProfileError("profile mapping required")
        profile_id=profile.get("profile_id");target=profile.get("target_type")
        if not isinstance(profile_id,str) or not profile_id.strip() or not isinstance(target,str) or not target.strip():raise VerificationProfileError("profile_id and target_type required")
        profile_id=profile_id.strip()
        if profile_id in self._profiles:raise VerificationProfileError("duplicate profile_id")
        claims=_strings(profile.get("required_claims"),"required_claims");verifiers=_strings(profile.get("specialist_verifiers"),"specialist_verifiers");surfaces=_strings(profile.get("evidence_surfaces"),"evidence_surfaces")
        tolerances=profile.get("tolerances",{});thresholds=profile.get("release_thresholds",{})
        if not isinstance(tolerances,Mapping) or any(not isinstance(k,str) or not k or isinstance(v,bool) or not isinstance(v,(int,float)) or v<0 for k,v in tolerances.items()):raise VerificationProfileError("invalid tolerances")
        if not isinstance(thresholds,Mapping) or any(k in {"overall","score","universal_score"} for k in thresholds):raise VerificationProfileError("invalid release thresholds")
        normalized={}
        for claim,states in thresholds.items():
            if claim not in claims:raise VerificationProfileError("threshold references undeclared claim")
            if not isinstance(states,list) or not states or any(state not in STATES for state in states):raise VerificationProfileError("invalid threshold states")
            normalized[claim]=sorted(set(states))
        record={"schema_version":"axm.verify.verification-profile/0.1","profile_id":profile_id,"target_type":target.strip(),"required_claims":claims,"specialist_verifiers":verifiers,"tolerances":dict(sorted(tolerances.items())),"evidence_surfaces":surfaces,"release_thresholds":dict(sorted(normalized.items())),"approval_authority":False,"canon":False}
        record["profile_digest"]=sha256(json.dumps(record,sort_keys=True,separators=(",",":")).encode()).hexdigest()
        self._profiles[profile_id]=deepcopy(record)
        return deepcopy(record)
    def get(self,profile_id:str)->Dict[str,Any]:
        if profile_id not in self._profiles:raise KeyError(profile_id)
        return deepcopy(self._profiles[profile_id])
    def match(self,target_type:str)->list[Dict[str,Any]]:
        return [deepcopy(v) for _,v in sorted(self._profiles.items()) if v["target_type"]==target_type]
