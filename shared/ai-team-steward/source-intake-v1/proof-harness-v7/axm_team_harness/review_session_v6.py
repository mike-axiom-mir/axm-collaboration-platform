from __future__ import annotations
import hashlib, json
from dataclasses import dataclass
@dataclass(frozen=True)
class ReviewSession:
    session_id:str; reviewer_id:str; items:tuple[str,...]; cursor:int; remaining_budget:int; decisions:tuple[str,...]=(); paused:bool=False

def checkpoint_digest(s:ReviewSession)->str:
    d={'session_id':s.session_id,'reviewer_id':s.reviewer_id,'items':s.items,'cursor':s.cursor,'remaining_budget':s.remaining_budget,'decisions':s.decisions,'paused':s.paused}
    return hashlib.sha256(json.dumps(d,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def review_next(s:ReviewSession,decision:str,*,effort:int=1,emergency_priority:bool=False)->dict:
    if s.paused: return {'ok':False,'error':'SESSION_PAUSED'}
    if decision=='AUTO_APPROVE': return {'ok':False,'error':'AUTO_APPROVAL_FORBIDDEN'}
    if effort>s.remaining_budget:
        paused=ReviewSession(s.session_id,s.reviewer_id,s.items,s.cursor,s.remaining_budget,s.decisions,True)
        return {'ok':False,'error':'ATTENTION_BUDGET_EXHAUSTED','session':paused,'digest':checkpoint_digest(paused)}
    if s.cursor>=len(s.items): return {'ok':False,'error':'NO_ITEMS'}
    ns=ReviewSession(s.session_id,s.reviewer_id,s.items,s.cursor+1,s.remaining_budget-effort,s.decisions+(decision,),False)
    return {'ok':True,'session':ns,'digest':checkpoint_digest(ns),'emergency_reordered':bool(emergency_priority),'approved':decision=='APPROVE'}

def resume(s:ReviewSession,provided_digest:str,*,additional_budget:int=0)->dict:
    if checkpoint_digest(s)!=provided_digest: return {'ok':False,'error':'CHECKPOINT_DIGEST_MISMATCH'}
    ns=ReviewSession(s.session_id,s.reviewer_id,s.items,s.cursor,s.remaining_budget+additional_budget,s.decisions,False)
    return {'ok':True,'session':ns,'digest':checkpoint_digest(ns)}
