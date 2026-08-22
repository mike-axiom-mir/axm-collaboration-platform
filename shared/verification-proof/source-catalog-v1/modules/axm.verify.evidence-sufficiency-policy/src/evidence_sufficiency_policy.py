"""Detached AXM Evidence Sufficiency Policy Engine v0.1.0."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, Mapping, Sequence

class EvidenceSufficiencyError(ValueError): pass

def _text(v: Any, f: str) -> str:
    if not isinstance(v, str) or not v.strip(): raise EvidenceSufficiencyError(f"{f} must be a non-empty string")
    return v.strip()

def _nonneg(v: Any, f: str) -> int:
    if not isinstance(v, int) or isinstance(v, bool) or v < 0: raise EvidenceSufficiencyError(f"{f} must be a non-negative integer")
    return v

@dataclass(frozen=True)
class EvidenceSufficiencyPolicy:
    policy_id: str
    min_receipts: int = 1
    required_surfaces: Sequence[str] = ()
    min_independent_verifiers: int = 0
    require_fresh: bool = True
    require_relevant: bool = True
    require_native_fit: bool = False
    accepted_verdict_states: Sequence[str] = ("PASS",)

    def __post_init__(self):
        object.__setattr__(self,"policy_id",_text(self.policy_id,"policy_id"))
        object.__setattr__(self,"min_receipts",_nonneg(self.min_receipts,"min_receipts"))
        object.__setattr__(self,"min_independent_verifiers",_nonneg(self.min_independent_verifiers,"min_independent_verifiers"))
        surfaces=[]
        for i,x in enumerate(self.required_surfaces):
            t=_text(x,f"required_surfaces[{i}]")
            if t in surfaces: raise EvidenceSufficiencyError(f"duplicate required surface: {t}")
            surfaces.append(t)
        object.__setattr__(self,"required_surfaces",tuple(surfaces))
        states=[]
        for i,x in enumerate(self.accepted_verdict_states):
            t=_text(x,f"accepted_verdict_states[{i}]").upper()
            if t not in states: states.append(t)
        if not states: raise EvidenceSufficiencyError("accepted_verdict_states must not be empty")
        object.__setattr__(self,"accepted_verdict_states",tuple(states))

    def evaluate(self, claim_id: str, receipts: Sequence[Mapping[str, Any]]) -> Dict[str, Any]:
        claim_id=_text(claim_id,"claim_id")
        if not isinstance(receipts,(list,tuple)): raise EvidenceSufficiencyError("receipts must be a list")
        seen=set(); eligible=[]; uncertain=[]; excluded=[]
        for i,r in enumerate(receipts):
            if not isinstance(r,Mapping): raise EvidenceSufficiencyError(f"receipts[{i}] must be an object")
            rid=_text(r.get("receipt_id"),f"receipts[{i}].receipt_id")
            if rid in seen: raise EvidenceSufficiencyError(f"duplicate receipt_id: {rid}")
            seen.add(rid)
            if _text(r.get("claim_id"),f"receipts[{i}].claim_id") != claim_id:
                excluded.append({"receipt_id":rid,"reasons":["CLAIM_MISMATCH"]}); continue
            reasons=[]; unknown=[]
            verdict=_text(r.get("verdict_state"),"verdict_state").upper()
            if verdict not in self.accepted_verdict_states: reasons.append("VERDICT_NOT_ACCEPTED")
            if self.require_fresh:
                state=_text(r.get("freshness_state"),"freshness_state").upper()
                if state == "UNKNOWN": unknown.append("FRESHNESS_UNKNOWN")
                elif state != "FRESH": reasons.append("NOT_FRESH")
            if self.require_relevant:
                state=_text(r.get("relevance_state"),"relevance_state").upper()
                if state == "UNKNOWN": unknown.append("RELEVANCE_UNKNOWN")
                elif state != "RELEVANT": reasons.append("NOT_RELEVANT")
            if self.require_native_fit:
                state=_text(r.get("native_fit_state"),"native_fit_state").upper()
                if state == "UNKNOWN": unknown.append("NATIVE_FIT_UNKNOWN")
                elif state != "FIT": reasons.append("NATIVE_FIT_MISSING")
            surface=_text(r.get("proof_surface"),"proof_surface")
            verifier=_text(r.get("verifier_id"),"verifier_id")
            independence=_text(r.get("independence_state","UNKNOWN"),"independence_state").upper()
            item={"receipt_id":rid,"surface":surface,"verifier_id":verifier,"independence_state":independence}
            if reasons: excluded.append({**item,"reasons":reasons})
            elif unknown: uncertain.append({**item,"reasons":unknown})
            else: eligible.append(item)

        def metrics(items):
            surfaces={x["surface"] for x in items}
            independent={x["verifier_id"] for x in items if x["independence_state"]=="INDEPENDENT"}
            return len(items), surfaces, independent
        count,surfaces,independent=metrics(eligible)
        possible_count,possible_surfaces,possible_independent=metrics(eligible+uncertain)
        missing_surfaces=sorted(set(self.required_surfaces)-surfaces)
        possible_missing=sorted(set(self.required_surfaces)-possible_surfaces)
        definite_ok=count>=self.min_receipts and not missing_surfaces and len(independent)>=self.min_independent_verifiers
        possible_ok=possible_count>=self.min_receipts and not possible_missing and len(possible_independent)>=self.min_independent_verifiers
        if definite_ok: state="SUFFICIENT"
        elif possible_ok and uncertain: state="UNKNOWN"
        else: state="INSUFFICIENT"
        deficits={"receipt_count":max(0,self.min_receipts-count),"missing_surfaces":missing_surfaces,"independent_verifiers":max(0,self.min_independent_verifiers-len(independent))}
        return {"schema_version":"axm.verify.evidence-sufficiency-receipt/0.1","policy_id":self.policy_id,"claim_id":claim_id,"sufficiency_state":state,"eligible_receipts":eligible,"uncertain_receipts":uncertain,"excluded_receipts":excluded,"deficits":deficits,"sufficient_means_pass":False,"authority":"NONE","canon":False}
