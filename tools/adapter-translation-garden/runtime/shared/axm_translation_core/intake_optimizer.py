from __future__ import annotations
from typing import Any

def _valid_number(value: Any, default: float=0.0) -> float:
    if isinstance(value,bool) or not isinstance(value,(int,float)): return default
    return float(value)

def optimize_intake_batch(candidates: list[dict[str,Any]], max_modules: int=10, max_complexity: float=10.0, max_risk: float=5.0, mandatory: list[str]|None=None) -> dict[str,Any]:
    by_id={str(c.get('id')):c for c in candidates if c.get('id')}; selected=set(); holds=[]; rejected=[]
    def closure(mid: str, seen: set[str]|None=None) -> set[str]:
        seen=set() if seen is None else seen
        if mid in seen: return seen
        seen.add(mid)
        for dep in map(str,by_id.get(mid,{}).get('dependencies',[])):
            if dep not in by_id: holds.append({'module_id':mid,'reason':'missing_dependency','dependency':dep})
            else: closure(dep,seen)
        return seen
    for mid in map(str,mandatory or []):
        if mid not in by_id: holds.append({'module_id':mid,'reason':'mandatory_missing'})
        else: selected.update(closure(mid))
    ranked=[]
    for mid,c in by_id.items():
        authority=str(c.get('authority_mode','unknown')); status=str(c.get('status',''))
        if authority=='shadow_only' or status not in {'LOCAL_PROTOTYPE','AVAILABLE'}:
            rejected.append({'module_id':mid,'reason':'not_reviewable'}); continue
        value=_valid_number(c.get('value_score'),0.5); reuse=_valid_number(c.get('reuse_score'),0.5); complexity=max(0.0,_valid_number(c.get('complexity'),1.0)); risk=max(0.0,_valid_number(c.get('risk'),0.5)); score=(value+0.5*reuse)/(1.0+complexity+risk)
        ranked.append((score,mid))
    ranked.sort(key=lambda x:(-x[0],x[1]))
    def totals(ids: set[str]) -> tuple[float,float]:
        return (sum(max(0.0,_valid_number(by_id[i].get('complexity'),1.0)) for i in ids),sum(max(0.0,_valid_number(by_id[i].get('risk'),0.5)) for i in ids))
    for score,mid in ranked:
        needed=closure(mid,set())-selected; proposed=selected|needed; complexity,risk=totals(proposed)
        if len(proposed)<=max_modules and complexity<=max_complexity and risk<=max_risk: selected=proposed
        else: rejected.append({'module_id':mid,'reason':'budget','candidate_score':round(score,8)})
    complexity,risk=totals(selected)
    ordered=sorted(selected,key=lambda i:(len(by_id[i].get('dependencies',[])),i))
    body={'selected_modules':ordered,'module_count':len(ordered),'total_complexity':round(complexity,8),'total_risk':round(risk,8),'limits':{'max_modules':max_modules,'max_complexity':max_complexity,'max_risk':max_risk},'holds':holds,'rejected':rejected,'automatic_install':False,'automatic_merge':False}
    return {'schema':'axm.translation.intake-batch-plan/v1',**body,'decision':'REVIEWABLE_BATCH' if not holds else 'HOLD'}

def verify_intake_batch(plan: dict[str,Any], candidates: list[dict[str,Any]]) -> dict[str,Any]:
    by_id={str(c.get('id')):c for c in candidates if c.get('id')}; selected=set(plan.get('selected_modules',[])); issues=[]
    if len(selected)!=int(plan.get('module_count',-1)): issues.append('module_count')
    for mid in selected:
        c=by_id.get(mid)
        if c is None: issues.append('unknown:'+mid); continue
        if c.get('authority_mode')=='shadow_only': issues.append('shadow:'+mid)
        for dep in map(str,c.get('dependencies',[])):
            if dep not in selected: issues.append('dependency:'+mid+'->'+dep)
    limits=plan.get('limits',{})
    if len(selected)>int(limits.get('max_modules',0)): issues.append('max_modules')
    if float(plan.get('total_complexity',0))>float(limits.get('max_complexity',0)): issues.append('max_complexity')
    if float(plan.get('total_risk',0))>float(limits.get('max_risk',0)): issues.append('max_risk')
    if plan.get('automatic_install') is not False or plan.get('automatic_merge') is not False: issues.append('automatic_authority')
    return {'valid':not issues,'issues':sorted(set(issues)),'verdict':'PASS' if not issues else 'HOLD'}

def explain_intake_batch(plan: dict[str,Any]) -> str:
    if plan.get('decision')!='REVIEWABLE_BATCH': return 'Intake batch is on hold. No modules were installed or merged.'
    return f"Reviewable batch contains {plan.get('module_count',0)} modules within declared complexity and risk limits. No modules were installed or merged."
