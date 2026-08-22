from __future__ import annotations
from typing import Any

def classify_evidence_freshness(evidence: dict[str, Any], now: int, default_max_age: int) -> dict[str, Any]:
    observed=int(evidence.get('observed_at',0)); max_age=int(evidence.get('max_age_seconds',default_max_age)); expires=evidence.get('expires_at'); superseded=evidence.get('superseded_by')
    age=int(now)-observed
    if observed>int(now): status='FUTURE_TIMESTAMP'
    elif superseded: status='SUPERSEDED'
    elif expires is not None and int(now)>=int(expires): status='EXPIRED'
    elif age>max_age: status='STALE'
    else: status='FRESH'
    return {'schema':'axm.translation.evidence-freshness/v1','evidence_id':str(evidence.get('evidence_id','')),'status':status,'age_seconds':age,'max_age_seconds':max_age,'expires_at':expires,'superseded_by':superseded,'usable':status=='FRESH','human_review_required':status!='FRESH'}

def aggregate_evidence_freshness(evidence_items: list[dict[str, Any]], now: int, default_max_age: int) -> dict[str, Any]:
    items=[classify_evidence_freshness(x,now,default_max_age) for x in evidence_items]
    counts={k:sum(i['status']==k for i in items) for k in ['FRESH','STALE','EXPIRED','SUPERSEDED','FUTURE_TIMESTAMP']}
    return {'schema':'axm.translation.evidence-freshness-bundle/v1','items':items,'counts':counts,'verdict':'PASS' if items and counts['FRESH']==len(items) else 'HOLD','empty':not items,'automatic_refresh':False}

def expiry_action_plan(bundle: dict[str, Any]) -> dict[str, Any]:
    actions=[]
    for item in bundle.get('items',[]):
        if item.get('status')!='FRESH': actions.append({'evidence_id':item.get('evidence_id'),'action':'RECOLLECT_OR_REVIEW','reason':item.get('status')})
    return {'schema':'axm.translation.evidence-expiry-plan/v1','actions':actions,'blocks_release':bool(actions) or bool(bundle.get('empty')),'executed':False}
