"""Detached AXM Public Claim Evidence Page Generator v0.1.0."""
from __future__ import annotations
from typing import Any,Dict,Mapping
STATES={"PASS","FAIL","UNKNOWN","NOT_RUN","CONFLICTED","STALE","HUMAN_REVIEW"}
class PublicEvidencePageError(ValueError):pass

def _text(v:Any,f:str)->str:
    if not isinstance(v,str) or not v.strip():raise PublicEvidencePageError(f"{f} required")
    return " ".join(v.strip().splitlines())
def _strings(v:Any,f:str)->list[str]:
    if not isinstance(v,list) or any(not isinstance(x,str) or not x.strip() for x in v):raise PublicEvidencePageError(f"{f} must be string list")
    return [_text(x,f) for x in v]
class PublicClaimEvidencePageGenerator:
    def generate(self,claim:Mapping[str,Any],evidence:list[Mapping[str,Any]],limitations:list[str],reproducible_steps:list[str])->Dict[str,Any]:
        if not isinstance(claim,Mapping) or claim.get("public_safe") is not True:raise PublicEvidencePageError("claim must be explicitly public_safe")
        claim_id=_text(claim.get("claim_id"),"claim_id");statement=_text(claim.get("statement"),"statement");scope=_text(claim.get("scope"),"scope");state=claim.get("verdict_state")
        if state not in STATES:raise PublicEvidencePageError("invalid claim verdict")
        if not isinstance(evidence,list):raise PublicEvidencePageError("evidence list required")
        public=[];withheld=0
        for raw in evidence:
            if not isinstance(raw,Mapping) or raw.get("verdict_state") not in STATES:raise PublicEvidencePageError("invalid evidence")
            if raw.get("public_safe") is not True:withheld+=1;continue
            item={"evidence_id":_text(raw.get("evidence_id"),"evidence_id"),"verdict_state":raw["verdict_state"],"summary":_text(raw.get("summary"),"summary"),"source_ref":_text(raw.get("source_ref"),"source_ref")}
            public.append(item)
        lim=_strings(limitations,"limitations");steps=_strings(reproducible_steps,"reproducible_steps")
        groups={s:[] for s in STATES}
        for item in public:groups[item["verdict_state"]].append(item)
        lines=[f"# Claim evidence: {claim_id}","",statement,"",f"**Scope:** {scope}",f"**Claim state:** {state}","","## Evidence"]
        for label in ("PASS","FAIL","UNKNOWN","NOT_RUN","CONFLICTED","STALE","HUMAN_REVIEW"):
            lines.extend(["",f"### {label}"])
            rows=groups[label]
            lines.extend([f"- {r['summary']} — source: {r['source_ref']}" for r in rows] or ["- None supplied."])
        lines.extend(["","## Limitations"]+([f"- {x}" for x in lim] or ["- None supplied."])+["","## Reproduce"]+([f"{i}. {x}" for i,x in enumerate(steps,1)] or ["No reproducible steps supplied."])+["",f"Private or non-public evidence withheld: {withheld}"])
        return {"schema_version":"axm.verify.public-claim-evidence-page/0.1","claim_id":claim_id,"claim_verdict_state":state,"public_evidence":public,"withheld_evidence_count":withheld,"limitations":lim,"reproducible_steps":steps,"markdown":"\n".join(lines)+"\n","published":False,"authority":"NONE","canon":False}
