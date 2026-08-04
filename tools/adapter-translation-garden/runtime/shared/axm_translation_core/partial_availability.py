from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def evaluate_partial_availability(required_capabilities: list[str], providers: list[dict[str,Any]], max_providers: int=512) -> dict[str,Any]:
    if len(providers)>max_providers: raise ValueError('too many providers')
    rows=[]
    for cap in sorted(set(map(str,required_capabilities))):
        candidates=[]
        for p in providers:
            if cap in set(map(str,p.get('capabilities',[]))):
                state=str(p.get('state','UNKNOWN')).upper(); deps_ok=all(bool(x) for x in p.get('dependency_availability',[])) if p.get('dependency_availability') else True
                candidates.append({'provider_id':str(p.get('provider_id')),'state':state,'dependencies_available':deps_ok,'usable':state in {'UP','DEGRADED'} and deps_ok,'quality':p.get('quality'),'authority_mode':p.get('authority_mode')})
        usable=[c for c in candidates if c['usable']]; up=[c for c in usable if c['state']=='UP']
        status='AVAILABLE' if up else ('DEGRADED' if usable else 'MISSING')
        rows.append({'capability':cap,'status':status,'candidates':candidates,'usable_provider_ids':[c['provider_id'] for c in usable],'fragile':len(usable)==1})
    body={'required_capabilities':sorted(set(map(str,required_capabilities))),'coverage':rows,'missing':[r['capability'] for r in rows if r['status']=='MISSING'],'degraded':[r['capability'] for r in rows if r['status']=='DEGRADED'],'fragile':[r['capability'] for r in rows if r['fragile']],'automatic_failover':False}
    return {'schema':'axm.translation.partial-availability-report/v1',**body,'report_sha256':_hash(body)}

def build_partial_availability_plan(report: dict[str,Any], allow_degraded: bool=False, allowed_missing: list[str]|None=None) -> dict[str,Any]:
    allowed=set(allowed_missing or []); blocked=sorted(set(report.get('missing',[]))-allowed); degraded=[] if allow_degraded else list(report.get('degraded',[])); holds=sorted(set(blocked+degraded))
    return {'schema':'axm.translation.partial-availability-plan/v1','decision':'REVIEWABLE' if not holds else 'HOLD','holds':holds,'candidate_providers':{r['capability']:r['usable_provider_ids'] for r in report.get('coverage',[])},'human_provider_selection_required':True,'automatic_failover':False,'executed':False}

def verify_partial_availability_plan(report: dict[str,Any], plan: dict[str,Any]) -> dict[str,Any]:
    errors=[]
    if plan.get('automatic_failover') is not False or plan.get('executed') is not False: errors.append('authority')
    expected={r['capability']:r['usable_provider_ids'] for r in report.get('coverage',[])}
    if plan.get('candidate_providers')!=expected: errors.append('provider_map')
    if plan.get('decision')=='REVIEWABLE' and plan.get('holds'): errors.append('decision')
    return {'schema':'axm.translation.partial-availability-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':errors,'bounded':True}
