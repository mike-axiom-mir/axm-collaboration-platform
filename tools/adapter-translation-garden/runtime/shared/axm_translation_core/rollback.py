from __future__ import annotations
import hashlib, json
from typing import Any

def _h(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()


def build_rollback_plan(*, change_id: str, before: dict[str, str], after: dict[str, str], current: dict[str, str]) -> dict[str, Any]:
    changed=sorted(k for k in set(before)|set(after) if before.get(k)!=after.get(k))
    drift=sorted(k for k in changed if current.get(k)!=after.get(k))
    actions=[{'path':k,'expected_current_sha256':after.get(k),'target_sha256':before.get(k),'operation':'RESTORE_OR_REMOVE'} for k in changed]
    verdict='BLOCKED_BY_DRIFT' if drift else ('PLAN_READY' if changed else 'NO_CHANGE')
    return {'schema':'axm.translation.rollback-plan/v1','change_id':change_id,'verdict':verdict,'changed_paths':changed,'drift_paths':drift,'actions':actions,'plan_sha256':_h({'change_id':change_id,'actions':actions}),'writes_performed':False,'executed':False}


def build_rollback_receipt(*, plan: dict[str, Any], observed_after: dict[str, str]) -> dict[str, Any]:
    expected={x['path']:x.get('target_sha256') for x in plan.get('actions',[])}
    mismatches=sorted(k for k,v in expected.items() if observed_after.get(k)!=v)
    return {'schema':'axm.translation.rollback-receipt/v1','change_id':plan.get('change_id'),'plan_sha256':plan.get('plan_sha256'),'verdict':'RESTORED' if not mismatches else 'MISMATCH','mismatch_paths':mismatches,'observed_sha256':_h(observed_after),'executed':False}


def verify_rollback_receipt(plan: dict[str, Any], receipt: dict[str, Any]) -> dict[str, Any]:
    match=plan.get('change_id')==receipt.get('change_id') and plan.get('plan_sha256')==receipt.get('plan_sha256') and receipt.get('verdict')=='RESTORED'
    return {'schema':'axm.translation.rollback-verification/v1','verdict':'PASS' if match else 'FAIL','matched':match,'executed':False}
