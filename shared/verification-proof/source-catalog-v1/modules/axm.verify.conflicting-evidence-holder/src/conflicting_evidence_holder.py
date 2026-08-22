"""Detached AXM Conflicting Evidence Holder v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping
import copy, hashlib, json

class ConflictHolderError(ValueError): pass

def _text(v:Any,f:str)->str:
    if not isinstance(v,str) or not v.strip(): raise ConflictHolderError(f"{f} must be a non-empty string")
    return v.strip()

class ConflictingEvidenceHolder:
    def __init__(self, holder_id:str):
        self.holder_id=_text(holder_id,"holder_id"); self._receipts={}; self._reviews={}
    def add_receipt(self, receipt:Mapping[str,Any])->Dict[str,Any]:
        if not isinstance(receipt,Mapping): raise ConflictHolderError("receipt must be an object")
        r=copy.deepcopy(dict(receipt)); rid=_text(r.get("receipt_id"),"receipt_id")
        if rid in self._receipts: raise ConflictHolderError(f"duplicate receipt_id: {rid}")
        for field in ("claim_id","target_profile","scope_id","assertion_key","verifier_id","proof_surface"):_text(r.get(field),field)
        verdict=_text(r.get("verdict_state"),"verdict_state").upper()
        if verdict not in {"PASS","FAIL","UNKNOWN","NOT_RUN","HUMAN_REVIEW","STALE","CONFLICTED"}: raise ConflictHolderError("unsupported verdict_state")
        r["verdict_state"]=verdict; self._receipts[rid]=r
        return self.snapshot()
    def _groups(self):
        buckets={}
        for r in self._receipts.values():
            key=(r["claim_id"],r["target_profile"],r["scope_id"],r["assertion_key"]); buckets.setdefault(key,[]).append(r)
        groups=[]
        for key,items in sorted(buckets.items()):
            verdicts={x["verdict_state"] for x in items}
            if "PASS" in verdicts and "FAIL" in verdicts:
                ids=sorted(x["receipt_id"] for x in items if x["verdict_state"] in {"PASS","FAIL"})
                raw="|".join((*key,*ids)); cid="conflict."+hashlib.sha256(raw.encode()).hexdigest()[:16]
                groups.append({"conflict_id":cid,"claim_id":key[0],"target_profile":key[1],"scope_id":key[2],"assertion_key":key[3],"receipt_ids":ids,"verdict_states":["FAIL","PASS"],"state":"HELD","reviews":copy.deepcopy(self._reviews.get(cid,[])),"resolved":False})
        return groups
    def attach_review(self, conflict_id:str, review:Mapping[str,Any])->Dict[str,Any]:
        conflict_id=_text(conflict_id,"conflict_id")
        if conflict_id not in {x["conflict_id"] for x in self._groups()}: raise ConflictHolderError("unknown conflict_id")
        if not isinstance(review,Mapping): raise ConflictHolderError("review must be an object")
        note={"reviewer_id":_text(review.get("reviewer_id"),"reviewer_id"),"note":_text(review.get("note"),"note"),"decision":_text(review.get("decision","NO_AUTOMATIC_RESOLUTION"),"decision")}
        self._reviews.setdefault(conflict_id,[]).append(note); return self.snapshot()
    def snapshot(self)->Dict[str,Any]:
        groups=self._groups()
        return {"schema_version":"axm.verify.conflict-holder/0.1","holder_id":self.holder_id,"receipts":[copy.deepcopy(self._receipts[k]) for k in sorted(self._receipts)],"conflicts":groups,"conflict_count":len(groups),"state":"CONFLICTED" if groups else "NO_HELD_CONFLICT","authority":"NONE","canon":False}
