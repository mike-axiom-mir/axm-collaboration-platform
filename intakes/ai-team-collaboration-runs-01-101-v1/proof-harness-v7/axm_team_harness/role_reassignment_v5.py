from __future__ import annotations
from dataclasses import dataclass
@dataclass(frozen=True)
class Assignment:
    seat_id:str; roles:frozenset[str]; authority:frozenset[str]

def validate_reassignment(assignments:list[Assignment],*,parent_authority:set[str],human_approved:bool)->dict:
    errors=[]; forbidden=[{'BUILDER','JUDGE'},{'BUILDER','VERIFIER'},{'APPLIER','APPROVER'}]
    if not human_approved: errors.append('HUMAN_APPROVAL_REQUIRED')
    for a in assignments:
        if not a.authority.issubset(parent_authority): errors.append('AUTHORITY_WIDENING')
        for pair in forbidden:
            if pair.issubset(a.roles): errors.append('SEPARATION_OF_DUTY_VIOLATION')
    return {'ok':not errors,'errors':sorted(set(errors))}
