from __future__ import annotations
import hashlib, json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def build_reproducible_build_plan(input_snapshot_sha256: str, toolchain: dict[str, str], steps: list[dict[str, Any]], environment: dict[str, str] | None=None) -> dict[str, Any]:
    normalized_steps=[]
    for i,step in enumerate(steps):
        action=str(step.get('action','')).strip()
        if not action: raise ValueError('missing_action')
        normalized_steps.append({'index':i,'action':action,'inputs':sorted(map(str,step.get('inputs',[]))),'outputs':sorted(map(str,step.get('outputs',[]))),'parameters':step.get('parameters',{})})
    body={'input_snapshot_sha256':str(input_snapshot_sha256),'toolchain':{str(k):str(v) for k,v in sorted(toolchain.items())},'environment':{str(k):str(v) for k,v in sorted((environment or {}).items())},'steps':normalized_steps,'network_allowed':False,'native_writes_allowed':False}
    return {'schema':'axm.translation.reproducible-build-plan/v1',**body,'plan_sha256':_hash(body),'executed':False}

def build_build_receipt(plan: dict[str, Any], output_files: list[dict[str, Any]], observed_toolchain: dict[str, str], nondeterminism: list[str] | None=None) -> dict[str, Any]:
    outputs=sorted([{'path':str(x['path']),'sha256':str(x['sha256']),'size_bytes':int(x['size_bytes'])} for x in output_files],key=lambda x:x['path'])
    body={'plan_sha256':plan.get('plan_sha256'),'outputs':outputs,'observed_toolchain':{str(k):str(v) for k,v in sorted(observed_toolchain.items())},'nondeterminism':sorted(map(str,nondeterminism or []))}
    return {'schema':'axm.translation.build-receipt/v1',**body,'receipt_sha256':_hash(body),'status':'REPRODUCIBLE_CANDIDATE' if not body['nondeterminism'] else 'HOLD','executed_elsewhere':True}

def compare_build_receipts(first: dict[str, Any], second: dict[str, Any]) -> dict[str, Any]:
    same_plan=first.get('plan_sha256')==second.get('plan_sha256')
    same_outputs=first.get('outputs')==second.get('outputs')
    same_toolchain=first.get('observed_toolchain')==second.get('observed_toolchain')
    clean=not first.get('nondeterminism') and not second.get('nondeterminism')
    return {'schema':'axm.translation.reproducibility-comparison/v1','verdict':'PASS' if all([same_plan,same_outputs,same_toolchain,clean]) else 'HOLD','same_plan':same_plan,'same_outputs':same_outputs,'same_toolchain':same_toolchain,'nondeterminism_clear':clean,'automatic_promotion':False}

def verify_build_receipt(plan: dict[str, Any], receipt: dict[str, Any]) -> dict[str, Any]:
    body={k:receipt.get(k) for k in ('plan_sha256','outputs','observed_toolchain','nondeterminism')}
    valid_hash=_hash(body)==receipt.get('receipt_sha256')
    same_plan=receipt.get('plan_sha256')==plan.get('plan_sha256')
    return {'valid':valid_hash and same_plan,'hash_valid':valid_hash,'plan_matches':same_plan,'verdict':'PASS' if valid_hash and same_plan else 'HOLD'}
