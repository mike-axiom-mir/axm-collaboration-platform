from __future__ import annotations
from dataclasses import dataclass
TERMINAL={'COMPLETED','CANCELLED','FAILED','EXPIRED'}
@dataclass(frozen=True)
class ChildDelegation:
    child_id:str; parent_id:str|None; state:str; result_receipt:str|None; authority_released:bool; release_ack:bool

def evaluate_parent_close(parent_id:str, children:list[ChildDelegation])->dict:
    errors=[]; active=[]; missing=[]; orphans=[]
    ids={c.child_id for c in children}
    for c in children:
        if c.parent_id not in {parent_id, None} and c.parent_id not in ids:
            orphans.append(c.child_id)
        if c.parent_id==parent_id:
            if c.state not in TERMINAL: active.append(c.child_id)
            if not c.result_receipt: missing.append(c.child_id)
            if not c.authority_released or not c.release_ack: errors.append(f'AUTHORITY_NOT_RELEASED:{c.child_id}')
    if active: errors.append('ACTIVE_CHILDREN')
    if missing: errors.append('MISSING_CHILD_RECEIPT')
    if orphans: errors.append('ORPHAN_DELEGATION')
    return {'ok':not errors,'errors':sorted(set(errors)),'active':sorted(active),'missing_receipts':sorted(missing),'orphans':sorted(orphans),'parent_state':'CLOSE_ALLOWED' if not errors else 'HELD'}
