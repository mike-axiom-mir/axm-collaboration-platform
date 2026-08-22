"""Detached AXM Failed Proof and Negative-Result Memory v0.1.0."""
from __future__ import annotations
from copy import deepcopy
from datetime import datetime
from hashlib import sha256
from typing import Any,Dict,Mapping
import json
OUTCOMES={"DISPROVEN_CLAIM","FAILED_CHECK","FLAKY_EVIDENCE","REJECTED_METHOD"}
class FailedProofLessonError(ValueError):pass

def _text(v:Any,f:str)->str:
    if not isinstance(v,str) or not v.strip():raise FailedProofLessonError(f"{f} required")
    return v.strip()
def _strings(v:Any,f:str,nonempty:bool=False)->list[str]:
    if not isinstance(v,list) or (nonempty and not v) or any(not isinstance(x,str) or not x.strip() for x in v):raise FailedProofLessonError(f"{f} must be string list")
    return [x.strip() for x in v]
class FailedProofLessonMemory:
    def __init__(self):self._records:dict[str,dict[str,Any]]={}
    def add(self,record:Mapping[str,Any])->Dict[str,Any]:
        if not isinstance(record,Mapping):raise FailedProofLessonError("record mapping required")
        if record.get("promote_canon") is True or record.get("create_rule") is True:raise FailedProofLessonError("automatic promotion or rule creation refused")
        lesson_id=_text(record.get("lesson_id"),"lesson_id")
        if lesson_id in self._records:raise FailedProofLessonError("duplicate lesson_id")
        outcome=record.get("outcome")
        if outcome not in OUTCOMES:raise FailedProofLessonError("unknown outcome")
        at=_text(record.get("recorded_at"),"recorded_at")
        try:datetime.fromisoformat(at.replace("Z","+00:00"))
        except ValueError as exc:raise FailedProofLessonError("invalid recorded_at") from exc
        item={"schema_version":"axm.verify.failed-proof-lesson/0.1","lesson_id":lesson_id,"claim_id":_text(record.get("claim_id"),"claim_id"),"outcome":outcome,"evidence_ids":_strings(record.get("evidence_ids"),"evidence_ids",True),"bounded_lesson":_text(record.get("bounded_lesson"),"bounded_lesson"),"scope":_strings(record.get("scope"),"scope",True),"non_generalization":_text(record.get("non_generalization"),"non_generalization"),"recorded_at":at,"rule_created":False,"promoted_canon":False}
        item["lesson_digest"]=sha256(json.dumps(item,sort_keys=True,separators=(",",":")).encode()).hexdigest();self._records[lesson_id]=deepcopy(item);return deepcopy(item)
    def get(self,lesson_id:str)->Dict[str,Any]:
        if lesson_id not in self._records:raise KeyError(lesson_id)
        return deepcopy(self._records[lesson_id])
