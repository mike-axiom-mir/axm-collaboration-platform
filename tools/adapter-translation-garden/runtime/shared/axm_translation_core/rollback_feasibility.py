from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def _closure(targets: list[str], dependencies: dict[str,list[str]], max_nodes: int=10000) -> list[str]:
    seen=set(); stack=list(map(str,targets))
    while stack:
        node=stack.pop()
        if node in seen: continue
        seen.add(node)
        if len(seen)>max_nodes: raise ValueError('dependency closure too large')
        stack.extend(map(str,dependencies.get(node,[])))
    return sorted(seen)

def compute_minimal_restore_set(targets: list[str], dependencies: dict[str,list[str]], damage_report: dict[str,Any], checkpoints: list[dict[str,Any]]) -> dict[str,Any]:
    closure=_closure(targets,dependencies); damaged={r['path'] for r in damage_report.get('entries',[]) if r.get('status') in {'MISSING','HASH_MISMATCH'}}; needed=sorted(set(closure)&damaged)
    candidates=[]
    for cp in checkpoints:
        files=set(map(str,cp.get('files',[]))); covers=sorted(set(needed)&files)
        candidates.append({'checkpoint_id':str(cp.get('checkpoint_id')),'verified':bool(cp.get('verified')),'compatible':bool(cp.get('compatible')),'covers':covers,'covers_all':set(covers)==set(needed),'file_count':len(files)})
    eligible=[c for c in candidates if c['verified'] and c['compatible'] and c['covers_all']]
    chosen=sorted(eligible,key=lambda c:(c['file_count'],c['checkpoint_id']))[0] if eligible else None
    body={'targets':sorted(map(str,targets)),'dependency_closure':closure,'damaged_needed_paths':needed,'checkpoint_candidates':candidates,'chosen_candidate':chosen,'decision':'REVIEWABLE' if chosen or not needed else 'HOLD_NO_COMPLETE_CANDIDATE','restore_executed':False,'automatic_restore':False}
    return {'schema':'axm.translation.minimal-restore-set/v1',**body,'plan_sha256':_hash(body)}

def verify_restore_set(plan: dict[str,Any]) -> dict[str,Any]:
    body={k:plan.get(k) for k in ('targets','dependency_closure','damaged_needed_paths','checkpoint_candidates','chosen_candidate','decision','restore_executed','automatic_restore')}; errors=[]
    if _hash(body)!=plan.get('plan_sha256'): errors.append('hash')
    if plan.get('restore_executed') is not False or plan.get('automatic_restore') is not False: errors.append('authority')
    chosen=plan.get('chosen_candidate')
    if chosen and not chosen.get('covers_all'): errors.append('coverage')
    if plan.get('decision')=='REVIEWABLE' and plan.get('damaged_needed_paths') and not chosen: errors.append('decision')
    return {'schema':'axm.translation.minimal-restore-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':errors,'bounded':True}

def build_rollback_feasibility_report(plan: dict[str,Any]) -> dict[str,Any]:
    return {'schema':'axm.translation.rollback-feasibility-report/v1','feasible':plan.get('decision')=='REVIEWABLE','candidate_checkpoint_id':(plan.get('chosen_candidate') or {}).get('checkpoint_id'),'restore_path_count':len(plan.get('damaged_needed_paths',[])),'human_approval_required':True,'executed':False}
