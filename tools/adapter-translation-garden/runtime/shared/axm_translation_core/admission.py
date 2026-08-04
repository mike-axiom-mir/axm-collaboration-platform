from __future__ import annotations
import hashlib,json
from typing import Any

RESOURCES=('memory_mb','storage_mb','latency_ms','energy_wh','bandwidth_kbps','expansion_ratio')
def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def evaluate_admission_envelope(request: dict[str,Any], envelope: dict[str,Any]) -> dict[str,Any]:
    holds=[]; margins={}; missing=[]
    for resource in RESOURCES:
        needed=request.get(resource); limit=envelope.get('max_'+resource)
        if needed is None: missing.append(resource); continue
        if isinstance(needed,bool) or not isinstance(needed,(int,float)) or float(needed)<0: holds.append('invalid_'+resource); continue
        if limit is None: missing.append('max_'+resource); continue
        margin=float(limit)-float(needed); margins[resource]=round(margin,8)
        if margin<0: holds.append(resource+'_budget_exceeded')
    required=set(map(str,envelope.get('required_evidence',[]))); present=set(map(str,request.get('evidence',[]))); absent=sorted(required-present)
    if absent: holds.append('required_evidence_missing')
    if request.get('authority_mode') in set(map(str,envelope.get('denied_authorities',['shadow_only']))): holds.append('authority_denied')
    if missing and envelope.get('require_complete_budget',True): holds.append('budget_fields_missing')
    body={'request_id':request.get('id'),'envelope_id':envelope.get('id'),'margins':margins,'missing_fields':missing,'missing_evidence':absent,'holds':sorted(set(holds)),'allocated':False,'automatic_admission':False}
    return {'schema':'axm.translation.admission-envelope-review/v1',**body,'review_sha256':_hash(body),'decision':'REVIEWABLE_ADMISSION' if not holds else 'HOLD'}

def build_admission_plan(reviews: list[dict[str,Any]]) -> dict[str,Any]:
    reviewable=[r.get('request_id') for r in reviews if r.get('decision')=='REVIEWABLE_ADMISSION']; held=[{'request_id':r.get('request_id'),'holds':r.get('holds',[])} for r in reviews if r.get('decision')!='REVIEWABLE_ADMISSION']
    return {'schema':'axm.translation.admission-plan/v1','reviewable_requests':reviewable,'held_requests':held,'human_decision_required':True,'automatic_allocation':False,'allocated':False}

def verify_admission_review(review: dict[str,Any]) -> dict[str,Any]:
    body={k:review.get(k) for k in ('request_id','envelope_id','margins','missing_fields','missing_evidence','holds','allocated','automatic_admission')}; valid=_hash(body)==review.get('review_sha256') and review.get('allocated') is False and review.get('automatic_admission') is False and ((review.get('decision')=='REVIEWABLE_ADMISSION')==(not review.get('holds')))
    return {'valid':valid,'verdict':'PASS' if valid else 'HOLD'}
