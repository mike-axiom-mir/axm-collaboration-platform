from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def _classify(key: str, before: Any, after: Any) -> str:
    low=key.lower()
    if isinstance(before,bool) and isinstance(after,bool):
        if any(x in low for x in ('allow','enable','automatic')): return 'LOOSENING' if (not before and after) else 'TIGHTENING'
    if isinstance(before,(int,float)) and isinstance(after,(int,float)) and not isinstance(before,bool) and not isinstance(after,bool):
        if any(x in low for x in ('max','limit','budget')): return 'LOOSENING' if after>before else 'TIGHTENING'
        if 'minimum' in low or low.startswith('min_'): return 'TIGHTENING' if after>before else 'LOOSENING'
    if isinstance(before,list) and isinstance(after,list):
        b=set(map(str,before)); a=set(map(str,after))
        if 'deny' in low: return 'TIGHTENING' if a-b else 'LOOSENING'
        if 'allow' in low or 'provider' in low: return 'LOOSENING' if a-b else 'TIGHTENING'
    return 'UNCLASSIFIED'

def compare_policy_snapshots(before: dict[str,Any], after: dict[str,Any]) -> dict[str,Any]:
    changes=[]
    for key in sorted(set(before)|set(after)):
        if key not in before: kind='ADDED'; old=None; new=after[key]
        elif key not in after: kind='REMOVED'; old=before[key]; new=None
        elif before[key]==after[key]: continue
        else: kind='CHANGED'; old=before[key]; new=after[key]
        change={'change_id':_hash([key,old,new])[:16],'key':key,'kind':kind,'before':old,'after':new,'direction':_classify(key,old,new)}; changes.append(change)
    body={'before_sha256':_hash(before),'after_sha256':_hash(after),'changes':changes,'loosening_change_ids':[c['change_id'] for c in changes if c['direction']=='LOOSENING'],'automatic_activation':False}
    return {'schema':'axm.translation.policy-drift-report/v1',**body,'report_sha256':_hash(body)}

def policy_drift_gate(report: dict[str,Any], approved_change_ids: list[str]|None=None) -> dict[str,Any]:
    approved=set(approved_change_ids or []); ids={c['change_id'] for c in report.get('changes',[])}; unapproved=sorted(ids-approved); loosenings=sorted(set(report.get('loosening_change_ids',[])))
    if not ids: decision='PASS_NO_DRIFT'
    elif unapproved: decision='HOLD_UNAPPROVED_DRIFT'
    else: decision='REVIEWABLE_TRANSITION'
    return {'schema':'axm.translation.policy-drift-gate/v1','decision':decision,'unapproved_change_ids':unapproved,'loosening_change_ids':loosenings,'human_approval_required':bool(ids),'automatic_activation':False,'verdict':'PASS' if decision in {'PASS_NO_DRIFT','REVIEWABLE_TRANSITION'} else 'HOLD'}

def build_policy_transition_plan(report: dict[str,Any], approved_change_ids: list[str]|None=None) -> dict[str,Any]:
    gate=policy_drift_gate(report,approved_change_ids); steps=[{'change_id':c['change_id'],'action':'REVIEW_AND_STAGE','direction':c['direction']} for c in report.get('changes',[])]
    return {'schema':'axm.translation.policy-transition-plan/v1','gate':gate,'steps':steps,'rollback_policy_sha256':report.get('before_sha256'),'target_policy_sha256':report.get('after_sha256'),'executed':False,'automatic_activation':False}
