from __future__ import annotations
import hashlib, json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def select_checkpoint_candidate(candidates: list[dict[str, Any]], target_run: int, required_source_sha256: str) -> dict[str, Any]:
    eligible=[x for x in candidates if int(x.get('run',-1))<=int(target_run) and x.get('source_sha256')==required_source_sha256 and x.get('verified') is True]
    eligible.sort(key=lambda x:(int(x.get('run',-1)),str(x.get('checkpoint_sha256',''))),reverse=True)
    return {'schema':'axm.translation.checkpoint-selection/v1','candidate':eligible[0] if eligible else None,'eligible_count':len(eligible),'decision':'SELECT_FOR_REVIEW' if eligible else 'HOLD','executed':False}

def build_restoration_plan(selection: dict[str, Any], expected_inventory: list[dict[str, Any]], required_tests: list[str]) -> dict[str, Any]:
    candidate=selection.get('candidate')
    if not candidate: return {'schema':'axm.translation.restoration-plan/v1','verdict':'HOLD','reason':'no_candidate','executed':False}
    inventory=sorted([{'path':str(x['path']),'sha256':str(x['sha256'])} for x in expected_inventory],key=lambda x:x['path'])
    body={'checkpoint_sha256':candidate['checkpoint_sha256'],'target_run':candidate['run'],'expected_inventory':inventory,'required_tests':sorted(set(map(str,required_tests))),'steps':['verify_checkpoint_hash','restore_to_empty_staging_area','verify_inventory','run_required_tests','human_compare','human_accept_or_reject'],'native_target_write':False,'executed':False}
    return {'schema':'axm.translation.restoration-plan/v1',**body,'plan_sha256':_hash(body),'verdict':'REVIEWABLE'}

def verify_restoration_evidence(plan: dict[str, Any], observed_inventory: list[dict[str, Any]], test_results: dict[str, bool]) -> dict[str, Any]:
    expected=plan.get('expected_inventory',[]); observed=sorted([{'path':str(x['path']),'sha256':str(x['sha256'])} for x in observed_inventory],key=lambda x:x['path'])
    inventory_match=expected==observed
    missing_tests=[t for t in plan.get('required_tests',[]) if test_results.get(t) is not True]
    ready=plan.get('verdict')=='REVIEWABLE' and inventory_match and not missing_tests
    return {'schema':'axm.translation.restoration-evidence/v1','verdict':'PASS' if ready else 'HOLD','inventory_match':inventory_match,'missing_or_failed_tests':missing_tests,'restored_into_live_system':False,'human_acceptance_required':True}

def recovery_readiness(selection: dict[str, Any], restoration_evidence: dict[str, Any]) -> dict[str, Any]:
    ready=selection.get('decision')=='SELECT_FOR_REVIEW' and restoration_evidence.get('verdict')=='PASS'
    return {'decision':'READY_FOR_HUMAN_RECOVERY_REVIEW' if ready else 'HOLD','candidate_run':(selection.get('candidate') or {}).get('run'),'executed':False,'live_state_changed':False}
