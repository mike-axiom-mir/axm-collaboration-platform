from __future__ import annotations
import hashlib, json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def append_dissent_record(ledger: list[dict[str, Any]], record_id: str, author_role: str, concern: str, severity: str, evidence_refs: list[str] | None=None, resolved_by: str | None=None) -> list[dict[str, Any]]:
    previous=ledger[-1]['record_sha256'] if ledger else 'GENESIS'
    body={'index':len(ledger),'record_id':str(record_id),'author_role':str(author_role),'concern':str(concern),'severity':str(severity).upper(),'evidence_refs':sorted(set(map(str,evidence_refs or []))),'resolved_by':resolved_by,'previous_sha256':previous}
    return [*ledger,{'schema':'axm.translation.dissent-record/v1',**body,'record_sha256':_hash(body)}]

def verify_dissent_ledger(ledger: list[dict[str, Any]]) -> dict[str, Any]:
    previous='GENESIS'; errors=[]
    for i,item in enumerate(ledger):
        body={k:item.get(k) for k in ('index','record_id','author_role','concern','severity','evidence_refs','resolved_by','previous_sha256')}
        if item.get('index')!=i: errors.append({'index':i,'reason':'index'})
        if item.get('previous_sha256')!=previous: errors.append({'index':i,'reason':'chain'})
        if _hash(body)!=item.get('record_sha256'): errors.append({'index':i,'reason':'hash'})
        previous=item.get('record_sha256')
    return {'schema':'axm.translation.dissent-ledger-verification/v1','valid':not errors,'records':len(ledger),'errors':errors,'head_sha256':previous}

def merge_gate_decision(ledger: list[dict[str, Any]], required_evidence: list[str], supplied_evidence: list[str], human_approved: bool=False) -> dict[str, Any]:
    unresolved=[x['record_id'] for x in ledger if x.get('severity') in {'BLOCK','CRITICAL'} and not x.get('resolved_by')]
    missing=sorted(set(map(str,required_evidence))-set(map(str,supplied_evidence)))
    verification=verify_dissent_ledger(ledger)
    ready=verification['valid'] and not unresolved and not missing and bool(human_approved)
    return {'schema':'axm.translation.merge-gate-decision/v1','decision':'ALLOW_MANUAL_MERGE_REVIEW' if ready else 'HOLD','ledger_valid':verification['valid'],'unresolved_blockers':unresolved,'missing_evidence':missing,'human_approved':bool(human_approved),'automatic_merge':False,'executed':False}
