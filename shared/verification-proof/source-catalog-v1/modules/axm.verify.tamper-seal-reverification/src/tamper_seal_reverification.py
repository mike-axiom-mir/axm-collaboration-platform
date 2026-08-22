"""Detached AXM Tamper and Seal Reverification v0.1.0."""
from __future__ import annotations
import hashlib,json
from typing import Any,Dict,Mapping,Sequence

STATES={"PASS","FAIL","UNKNOWN","NOT_RUN"}
class SealReverificationError(ValueError):pass

def _bytes(value:Any)->bytes:
    if isinstance(value,bytes):return value
    try:return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False,allow_nan=False).encode()
    except (TypeError,ValueError) as exc:raise SealReverificationError("subject must be bytes or deterministic JSON") from exc

def _digest(value:Any)->str:return hashlib.sha256(_bytes(value)).hexdigest()

def _hex(value:Any)->bool:
    if not isinstance(value,str) or len(value)!=64:return False
    try:bytes.fromhex(value);return True
    except ValueError:return False

class TamperSealReverification:
    def reverify(self, subjects:Mapping[str,Any], seals:Sequence[Mapping[str,Any]], references:Sequence[Mapping[str,Any]]|None=None, signature_receipts:Sequence[Mapping[str,Any]]|None=None)->Dict[str,Any]:
        if not isinstance(subjects,Mapping) or not isinstance(seals,Sequence) or isinstance(seals,(str,bytes)) or not seals:raise SealReverificationError("subjects and non-empty seals are required")
        failures=[];uncertainty=[];results=[]
        for seal in seals:
            if not isinstance(seal,Mapping) or seal.get("algorithm")!="sha256" or not _hex(seal.get("digest")) or not isinstance(seal.get("subject_id"),str):raise SealReverificationError("invalid seal record")
            sid=seal["subject_id"]
            if sid not in subjects:failures.append({"type":"missing_subject","subject_id":sid});continue
            computed=_digest(subjects[sid]);match=computed==seal["digest"]
            results.append({"subject_id":sid,"computed_digest":computed,"expected_digest":seal["digest"],"matches":match})
            if not match:failures.append({"type":"digest_mismatch","subject_id":sid})
        for ref in references or []:
            if not isinstance(ref,Mapping) or not isinstance(ref.get("from_id"),str) or not isinstance(ref.get("to_id"),str):raise SealReverificationError("invalid reference")
            if ref["from_id"] not in subjects or ref["to_id"] not in subjects:failures.append({"type":"broken_reference","from_id":ref["from_id"],"to_id":ref["to_id"]})
        for receipt in signature_receipts or []:
            status=receipt.get("status") if isinstance(receipt,Mapping) else None
            if status not in STATES:raise SealReverificationError("invalid signature receipt")
            if status=="FAIL":failures.append({"type":"signature_failure","subject_id":receipt.get("subject_id")})
            elif status in {"UNKNOWN","NOT_RUN"}:uncertainty.append({"type":"signature_unverified","subject_id":receipt.get("subject_id"),"status":status})
        verdict="FAIL" if failures else ("UNKNOWN" if uncertainty else "PASS")
        return {"schema_version":"axm.verify.tamper-seal-reverification/0.1","verdict_state":verdict,"seal_results":results,"failures":failures,"uncertainty":uncertainty,"stored_verdict_fields_trusted":False,"signature_cryptography_performed":False,"authority":"NONE","canon":False}
