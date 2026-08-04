from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def evaluate_route_policy(route: dict[str,Any], policy: dict[str,Any]) -> dict[str,Any]:
    holds=[]; warnings=[]
    authorities=set(map(str,route.get('authorities',[]))); denied=set(map(str,policy.get('deny_authorities',['shadow_only','native_write','network_send'])))
    if authorities & denied: holds.append('denied_authority')
    allowed_providers=set(map(str,policy.get('allowed_providers',[])))
    if allowed_providers and any(str(x) not in allowed_providers for x in route.get('providers',[])): holds.append('provider_not_allowed')
    privacy_order={'public':0,'internal':1,'personal':2,'sensitive':3,'secret':4}; classification=str(route.get('privacy_classification','internal')); max_privacy=str(policy.get('max_privacy_classification','internal'))
    if privacy_order.get(classification,99)>privacy_order.get(max_privacy,-1): holds.append('privacy_limit')
    if float(route.get('loss_score',0))>float(policy.get('max_loss_score',1)): holds.append('loss_limit')
    if float(route.get('latency_ms',0))>float(policy.get('max_latency_ms',10**12)): holds.append('latency_limit')
    if policy.get('require_consent') and not route.get('consent_evidence'): holds.append('consent_missing')
    required=set(map(str,policy.get('required_evidence',[]))); present=set(map(str,route.get('evidence',[]))); missing=sorted(required-present)
    if missing: holds.append('required_evidence_missing')
    if route.get('degraded') and not route.get('degradation_disclosed'): holds.append('silent_degradation')
    if route.get('uncertainty') is None: warnings.append('uncertainty_not_declared')
    body={'route_id':route.get('id'),'policy_id':policy.get('id'),'holds':sorted(set(holds)),'warnings':warnings,'missing_evidence':missing,'automatic_dispatch':False,'executed':False}
    return {'schema':'axm.translation.policy-route-review/v1',**body,'review_sha256':_hash(body),'decision':'REVIEWABLE_ROUTE' if not holds else 'HOLD'}

def compare_policy_routes(reviews: list[dict[str,Any]], routes: list[dict[str,Any]]) -> dict[str,Any]:
    by_id={str(r.get('id')):r for r in routes}; eligible=[]
    for review in reviews:
        if review.get('decision')!='REVIEWABLE_ROUTE': continue
        route=by_id.get(str(review.get('route_id')),{}); eligible.append({'route_id':review.get('route_id'),'loss_score':float(route.get('loss_score',0)),'latency_ms':float(route.get('latency_ms',0)),'uncertainty':float(route.get('uncertainty',1))})
    eligible.sort(key=lambda x:(x['loss_score'],x['uncertainty'],x['latency_ms'],str(x['route_id'])))
    return {'schema':'axm.translation.policy-route-comparison/v1','eligible':eligible,'held':[r.get('route_id') for r in reviews if r.get('decision')!='REVIEWABLE_ROUTE'],'recommended_for_review':eligible[0]['route_id'] if eligible else None,'automatic_selection':False,'automatic_dispatch':False}

def policy_route_gate(review: dict[str,Any]) -> dict[str,Any]:
    body={k:review.get(k) for k in ('route_id','policy_id','holds','warnings','missing_evidence','automatic_dispatch','executed')}; hash_valid=_hash(body)==review.get('review_sha256'); bounded=review.get('automatic_dispatch') is False and review.get('executed') is False; coherent=(review.get('decision')=='REVIEWABLE_ROUTE')==(not review.get('holds'))
    valid=hash_valid and bounded and coherent
    return {'valid':valid,'hash_valid':hash_valid,'bounded':bounded,'coherent':coherent,'verdict':'PASS' if valid else 'HOLD'}
