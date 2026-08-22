from __future__ import annotations
import hashlib, json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def build_deprecation_plan(module_id: str, current_version: str, announced_at: int, sunset_at: int, reasons: list[str], replacement: str | None=None, migration_refs: list[str] | None=None) -> dict[str, Any]:
    if int(sunset_at)<=int(announced_at): raise ValueError('sunset_must_follow_announcement')
    body={'module_id':str(module_id),'current_version':str(current_version),'announced_at':int(announced_at),'sunset_at':int(sunset_at),'reasons':sorted(set(map(str,reasons))),'replacement':replacement,'migration_refs':sorted(set(map(str,migration_refs or []))),'automatic_disable':False,'automatic_remove':False}
    return {'schema':'axm.translation.deprecation-plan/v1',**body,'plan_sha256':_hash(body)}

def evaluate_deprecation_state(plan: dict[str, Any], now: int, active_dependents: list[str] | None=None) -> dict[str, Any]:
    dependents=sorted(set(map(str,active_dependents or [])))
    if int(now)<int(plan['announced_at']): phase='PLANNED'
    elif int(now)<int(plan['sunset_at']): phase='DEPRECATED'
    else: phase='SUNSET_REACHED'
    removal_ready=phase=='SUNSET_REACHED' and not dependents and bool(plan.get('replacement') or plan.get('migration_refs'))
    return {'schema':'axm.translation.deprecation-state/v1','module_id':plan['module_id'],'phase':phase,'active_dependents':dependents,'replacement_visible':bool(plan.get('replacement')),'migration_visible':bool(plan.get('migration_refs')),'removal_readiness':'REVIEWABLE' if removal_ready else 'HOLD','automatic_action':False}

def deprecation_gate(state: dict[str, Any], human_approved: bool=False) -> dict[str, Any]:
    reviewable=state.get('removal_readiness')=='REVIEWABLE'
    return {'decision':'ALLOW_MANUAL_RETIREMENT_PLAN' if reviewable and human_approved else 'HOLD','reviewable':reviewable,'human_approved':bool(human_approved),'executed':False,'reason':'explicit_human_approval_required' if reviewable and not human_approved else ('dependencies_or_migration_not_ready' if not reviewable else 'review_gate_satisfied')}
