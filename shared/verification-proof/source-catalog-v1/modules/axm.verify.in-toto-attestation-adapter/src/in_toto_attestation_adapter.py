
"""Detached AXM in-toto Attestation Adapter v0.1.0."""
from __future__ import annotations
from typing import Any,Dict,Mapping,Sequence
STATES={"PASS","FAIL","UNKNOWN","NOT_RUN"}
class InTotoAdapterError(ValueError):pass
def subjects(rows:Sequence[Mapping[str,Any]])->list[dict[str,Any]]:
    out=[];seen=set()
    for raw in rows:
        name=raw.get("name") if isinstance(raw,Mapping) else None;digest=raw.get("digest") if isinstance(raw,Mapping) else None
        if not isinstance(name,str) or not name or name in seen or not isinstance(digest,Mapping) or not digest or any(not isinstance(k,str) or not k or not isinstance(v,str) or not v for k,v in digest.items()):raise InTotoAdapterError("invalid or duplicate subject")
        seen.add(name);out.append({"name":name,"digest":dict(sorted(digest.items()))})
    return sorted(out,key=lambda x:x["name"])
class InTotoAttestationAdapter:
    def adapt(self,statement:Mapping[str,Any],expected_subjects:Sequence[Mapping[str,Any]]=(),envelope:Mapping[str,Any]|None=None)->Dict[str,Any]:
        if not isinstance(statement,Mapping) or statement.get("_type") not in {"https://in-toto.io/Statement/v1","https://in-toto.io/Statement/v0.1"}:raise InTotoAdapterError("unsupported statement type")
        actual=subjects(statement.get("subject",[]));expected=subjects(expected_subjects) if expected_subjects else []
        ptype=statement.get("predicateType");predicate=statement.get("predicate")
        if not isinstance(ptype,str) or not ptype or not isinstance(predicate,Mapping):raise InTotoAdapterError("predicateType and predicate are required")
        mismatches=[]
        if expected and actual!=expected:mismatches.append({"type":"subject_binding","expected":expected,"observed":actual})
        status="NOT_RUN";identity=None
        if envelope is not None:
            status=envelope.get("verification_status") if isinstance(envelope,Mapping) else None;identity=envelope.get("signer_identity") if isinstance(envelope,Mapping) else None
            if status not in STATES:raise InTotoAdapterError("invalid envelope verification status")
        if status=="FAIL":mismatches.append({"type":"envelope_verification"})
        verdict="FAIL" if mismatches else ("PASS" if status=="PASS" else "UNKNOWN")
        return {"schema_version":"axm.verify.in-toto-attestation/0.1","verdict_state":verdict,"statement_type":statement["_type"],"predicate_type":ptype,"subjects":actual,"signer_identity":identity,"envelope_verification_status":status,"mismatches":mismatches,"cryptographic_verification_performed":False,"predicate_truth_proven":False,"authority":"NONE","canon":False}
