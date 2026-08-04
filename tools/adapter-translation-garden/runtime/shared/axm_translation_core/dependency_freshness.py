from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def assess_dependency_freshness(records: list[dict[str,Any]], now: int, default_max_age_seconds: int=86400) -> dict[str,Any]:
    rows=[]
    for r in records:
        dep=str(r.get('dependency_id','')); observed=r.get('observed_at'); max_age=int(r.get('max_age_seconds',default_max_age_seconds)); superseded=bool(r.get('superseded'))
        if not dep or observed is None: status='UNKNOWN'; age=None
        else:
            age=now-int(observed)
            if age<0: status='FUTURE'
            elif superseded: status='SUPERSEDED'
            elif age>max_age: status='STALE'
            else: status='FRESH'
        rows.append({'dependency_id':dep,'observed_at':observed,'age_seconds':age,'max_age_seconds':max_age,'status':status,'required':bool(r.get('required',True)),'evidence_sha256':r.get('evidence_sha256')})
    body={'now':now,'records':rows,'stale':[x['dependency_id'] for x in rows if x['status']=='STALE'],'future':[x['dependency_id'] for x in rows if x['status']=='FUTURE'],'unknown':[x['dependency_id'] for x in rows if x['status']=='UNKNOWN'],'superseded':[x['dependency_id'] for x in rows if x['status']=='SUPERSEDED'],'automatic_refresh':False}
    return {'schema':'axm.translation.dependency-freshness-report/v1',**body,'report_sha256':_hash(body)}

def dependency_freshness_gate(report: dict[str,Any], allow_optional_stale: bool=False) -> dict[str,Any]:
    rows=report.get('records',[]); holds=[]
    for r in rows:
        if r.get('status')=='FRESH': continue
        if not r.get('required') and allow_optional_stale and r.get('status') in {'STALE','SUPERSEDED'}: continue
        holds.append({'dependency_id':r.get('dependency_id'),'status':r.get('status')})
    return {'schema':'axm.translation.dependency-freshness-gate/v1','verdict':'PASS' if not holds else 'HOLD','holds':holds,'refresh_required':bool(holds),'automatic_refresh':False}

def build_dependency_refresh_plan(report: dict[str,Any]) -> dict[str,Any]:
    actions=[{'dependency_id':r['dependency_id'],'action':'REQUEST_REVIEWED_EVIDENCE','reason':r['status']} for r in report.get('records',[]) if r.get('status')!='FRESH']
    return {'schema':'axm.translation.dependency-refresh-plan/v1','actions':actions,'network_access':False,'executed':False,'automatic_refresh':False}
