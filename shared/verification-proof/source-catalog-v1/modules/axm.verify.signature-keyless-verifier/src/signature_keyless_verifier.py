
"""Detached AXM Signature and Keyless Identity Verifier v0.1.0."""
from __future__ import annotations
from datetime import datetime,timezone
from typing import Any,Dict,Mapping
STATES={"PASS","FAIL","UNKNOWN","NOT_RUN"}
class SignatureVerifierError(ValueError):pass
def parse_time(value:str)->datetime:
    if not isinstance(value,str) or not value:raise SignatureVerifierError("time must be an ISO string")
    try:dt=datetime.fromisoformat(value.replace("Z","+00:00"))
    except ValueError as exc:raise SignatureVerifierError("invalid ISO time") from exc
    if dt.tzinfo is None:raise SignatureVerifierError("time must include timezone")
    return dt.astimezone(timezone.utc)
class SignatureKeylessVerifier:
    def evaluate(self,evidence:Mapping[str,Any],policy:Mapping[str,Any],now:str)->Dict[str,Any]:
        if not isinstance(evidence,Mapping) or not isinstance(policy,Mapping):raise SignatureVerifierError("evidence and policy must be mappings")
        status=evidence.get("signature_status");cert=evidence.get("certificate")
        if status not in STATES or not isinstance(cert,Mapping):raise SignatureVerifierError("invalid signature status or certificate")
        for field in ("subject","issuer","trust_root","not_before","not_after","revocation_status"):
            if not isinstance(cert.get(field),str) or not cert.get(field):raise SignatureVerifierError(f"missing certificate {field}")
        if cert["revocation_status"] not in STATES:raise SignatureVerifierError("invalid revocation status")
        current=parse_time(now);not_before=parse_time(cert["not_before"]);not_after=parse_time(cert["not_after"])
        if not_before>not_after:raise SignatureVerifierError("certificate validity window is reversed")
        failures=[];uncertain=[]
        def require_allowed(field,policy_key):
            allowed=policy.get(policy_key,[])
            if not isinstance(allowed,list) or any(not isinstance(x,str) or not x for x in allowed):raise SignatureVerifierError(f"invalid {policy_key}")
            if allowed and cert[field] not in allowed:failures.append({"field":field,"observed":cert[field]})
        require_allowed("subject","allowed_subjects");require_allowed("issuer","allowed_issuers");require_allowed("trust_root","trusted_roots")
        if not (not_before<=current<=not_after):failures.append({"field":"validity_window","now":now})
        if status=="FAIL":failures.append({"field":"signature_status"})
        elif status in {"UNKNOWN","NOT_RUN"}:uncertain.append({"field":"signature_status","status":status})
        rev=cert["revocation_status"]
        if rev=="FAIL":failures.append({"field":"revocation_status"})
        elif rev in {"UNKNOWN","NOT_RUN"}:uncertain.append({"field":"revocation_status","status":rev})
        inclusion=evidence.get("transparency_inclusion_status","NOT_RUN")
        if inclusion not in STATES:raise SignatureVerifierError("invalid transparency inclusion status")
        if policy.get("require_transparency") is True:
            if inclusion=="FAIL":failures.append({"field":"transparency_inclusion"})
            elif inclusion!="PASS":uncertain.append({"field":"transparency_inclusion","status":inclusion})
        verdict="FAIL" if failures else ("UNKNOWN" if uncertain else "PASS")
        return {"schema_version":"axm.verify.signature-keyless/0.1","verdict_state":verdict,"failures":failures,"uncertainty":uncertain,"subject":cert["subject"],"issuer":cert["issuer"],"trust_root":cert["trust_root"],"cryptographic_verification_performed":False,"native_verification_receipt_required":True,"identity_ownership_proven":False,"authority":"NONE","canon":False}
