from __future__ import annotations
from dataclasses import dataclass
@dataclass(frozen=True)
class Step:
    step_id:str; dependencies:tuple[str,...]; applied:bool; succeeded:bool; reversible:bool

def plan_recovery(steps:list[Step],*,human_approved_irreversible:bool=False)->dict:
    by={s.step_id:s for s in steps}; failed={s.step_id for s in steps if s.applied and not s.succeeded}
    dependent=set()
    changed=True
    while changed:
        changed=False
        for s in steps:
            if s.applied and any(d in failed|dependent for d in s.dependencies) and s.step_id not in dependent:
                dependent.add(s.step_id); changed=True
    preserve=[]; rollback=[]; held=[]; receipts=[]
    for s in steps:
        if not s.applied: continue
        affected=s.step_id in failed or s.step_id in dependent
        if not affected and s.succeeded:
            preserve.append(s.step_id); continue
        if s.reversible:
            rollback.append(s.step_id); receipts.append(f'COMPENSATED:{s.step_id}')
        elif human_approved_irreversible:
            held.append(s.step_id); receipts.append(f'HUMAN_RECOVERY_REQUIRED:{s.step_id}')
        else:
            held.append(s.step_id)
    complete=all(s.reversible or s.step_id in held for s in steps if s.applied and (s.step_id in failed or s.step_id in dependent))
    return {'ok':not held,'preserve':sorted(preserve),'rollback':sorted(rollback),'held':sorted(held),'compensation_receipts':sorted(receipts),'ledger_complete':complete,'status':'RECOVERED' if not held else 'HELD_RECOVERY_REQUIRED'}
