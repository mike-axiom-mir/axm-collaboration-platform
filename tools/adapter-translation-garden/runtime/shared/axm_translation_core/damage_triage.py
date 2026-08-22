from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def classify_checkpoint_damage(expected: list[dict[str,Any]], observed: list[dict[str,Any]], max_entries: int=20000) -> dict[str,Any]:
    if len(expected)+len(observed)>max_entries: raise ValueError('inventory too large')
    exp={str(x['path']):x for x in expected}; obs={str(x['path']):x for x in observed}; rows=[]
    for path in sorted(set(exp)|set(obs)):
        e=exp.get(path); o=obs.get(path)
        if e is None: status='UNEXPECTED'; required=False
        elif o is None: status='MISSING'; required=bool(e.get('required',True))
        elif e.get('sha256')!=o.get('sha256'): status='HASH_MISMATCH'; required=bool(e.get('required',True))
        else: status='INTACT'; required=bool(e.get('required',True))
        severity='CRITICAL' if required and status in {'MISSING','HASH_MISMATCH'} else ('WARNING' if status!='INTACT' else 'NONE')
        rows.append({'path':path,'status':status,'severity':severity,'required':required,'expected_sha256':e.get('sha256') if e else None,'observed_sha256':o.get('sha256') if o else None})
    body={'entries':rows,'critical_paths':[r['path'] for r in rows if r['severity']=='CRITICAL'],'warning_paths':[r['path'] for r in rows if r['severity']=='WARNING'],'intact_count':sum(r['status']=='INTACT' for r in rows),'repair_executed':False,'delete_executed':False}
    return {'schema':'axm.translation.checkpoint-damage-report/v1',**body,'report_sha256':_hash(body)}

def build_damage_triage_plan(report: dict[str,Any]) -> dict[str,Any]:
    actions=[]
    for row in report.get('entries',[]):
        if row['status']=='INTACT': continue
        action='RESTORE_FROM_VERIFIED_CANDIDATE' if row['status'] in {'MISSING','HASH_MISMATCH'} else 'QUARANTINE_FOR_REVIEW'
        actions.append({'path':row['path'],'status':row['status'],'severity':row['severity'],'proposed_action':action})
    return {'schema':'axm.translation.checkpoint-damage-triage-plan/v1','decision':'HOLD_FOR_RECOVERY_REVIEW' if report.get('critical_paths') else 'REVIEW_WARNINGS' if actions else 'NO_DAMAGE','actions':actions,'repair_executed':False,'delete_executed':False,'automatic_restore':False}

def verify_damage_report(report: dict[str,Any], plan: dict[str,Any]) -> dict[str,Any]:
    errors=[]
    body={k:report.get(k) for k in ('entries','critical_paths','warning_paths','intact_count','repair_executed','delete_executed')}
    if _hash(body)!=report.get('report_sha256'): errors.append('hash')
    if any(plan.get(k) is not False for k in ('repair_executed','delete_executed','automatic_restore')): errors.append('authority')
    expected={r['path'] for r in report.get('entries',[]) if r['status']!='INTACT'}; actual={a['path'] for a in plan.get('actions',[])}
    if expected!=actual: errors.append('coverage')
    return {'schema':'axm.translation.checkpoint-damage-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':errors,'bounded':True}
