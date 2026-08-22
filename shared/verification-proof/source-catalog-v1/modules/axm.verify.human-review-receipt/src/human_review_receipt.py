"""Detached AXM Human Review Receipt v0.1.0."""
from __future__ import annotations
from hashlib import sha256
from typing import Any,Dict,Mapping
from datetime import datetime
import json
DECISIONS={"APPROVE","REJECT","NEEDS_CHANGES","UNSURE"}
class HumanReviewReceiptError(ValueError):pass

def _text(v:Any,f:str)->str:
    if not isinstance(v,str) or not v.strip():raise HumanReviewReceiptError(f"{f} required")
    return v.strip()
def _strings(v:Any,f:str,nonempty:bool=False)->list[str]:
    if not isinstance(v,list) or (nonempty and not v) or any(not isinstance(x,str) or not x.strip() for x in v):raise HumanReviewReceiptError(f"{f} must be {'non-empty ' if nonempty else ''}string list")
    return [x.strip() for x in v]
def _time(v:Any)->str:
    t=_text(v,"reviewed_at")
    try:datetime.fromisoformat(t.replace("Z","+00:00"))
    except ValueError as exc:raise HumanReviewReceiptError("invalid reviewed_at") from exc
    return t
class HumanReviewReceiptBuilder:
    def build(self,review:Mapping[str,Any])->Dict[str,Any]:
        if not isinstance(review,Mapping):raise HumanReviewReceiptError("review mapping required")
        decision=review.get("decision")
        if decision not in DECISIONS:raise HumanReviewReceiptError("unknown decision")
        receipt={"schema_version":"axm.verify.human-review-receipt/0.1","review_id":_text(review.get("review_id"),"review_id"),"reviewer_id":_text(review.get("reviewer_id"),"reviewer_id"),"reviewer_role":_text(review.get("reviewer_role"),"reviewer_role"),"artifact_id":_text(review.get("artifact_id"),"artifact_id"),"artifact_digest":_text(review.get("artifact_digest"),"artifact_digest"),"native_surface":_text(review.get("native_surface"),"native_surface"),"inspected_scope":_strings(review.get("inspected_scope"),"inspected_scope",True),"decision":decision,"limitations":_strings(review.get("limitations",[]),"limitations"),"dissent":_strings(review.get("dissent",[]),"dissent"),"authority_scope":_strings(review.get("authority_scope"),"authority_scope",True),"reviewed_at":_time(review.get("reviewed_at")),"evidence_only":True,"release_authority":False,"canon":False}
        receipt["receipt_digest"]=sha256(json.dumps(receipt,sort_keys=True,separators=(",",":")).encode()).hexdigest()
        return receipt
