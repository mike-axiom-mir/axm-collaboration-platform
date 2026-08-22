from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def build_local_rollback_drill(before_inventory: dict[str,str], planned_additions: dict[str,str]) -> dict[str,Any]:
    collisions=sorted(set(before_inventory)&set(planned_additions)); staged=dict(before_inventory)
    if not collisions: staged.update(planned_additions)
    rolled=dict(staged)
    for path in planned_additions:
        if path not in before_inventory: rolled.pop(path,None)
    body={'before_sha256':_hash(before_inventory),'planned_additions_sha256':_hash(planned_additions),'staged_sha256':_hash(staged),'rolled_back_sha256':_hash(rolled),'collisions':collisions,'restored_exactly':rolled==before_inventory and not collisions,'decision':'DRILL_PASS' if rolled==before_inventory and not collisions else 'HOLD','live_apply_executed':False,'live_restore_executed':False,'filesystem_writes':False}
    return {'schema':'axm.translation.local-rollback-drill/v1',**body,'drill_sha256':_hash(body)}

def verify_local_rollback_drill(drill: dict[str,Any]) -> dict[str,Any]:
    body={k:drill.get(k) for k in ('before_sha256','planned_additions_sha256','staged_sha256','rolled_back_sha256','collisions','restored_exactly','decision','live_apply_executed','live_restore_executed','filesystem_writes')}; errors=[]
    if _hash(body)!=drill.get('drill_sha256'): errors.append('hash')
    if any(drill.get(k) is not False for k in ('live_apply_executed','live_restore_executed','filesystem_writes')): errors.append('side_effect')
    if drill.get('decision')=='DRILL_PASS' and (not drill.get('restored_exactly') or drill.get('collisions')): errors.append('decision')
    return {'schema':'axm.translation.local-rollback-drill-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':errors}
