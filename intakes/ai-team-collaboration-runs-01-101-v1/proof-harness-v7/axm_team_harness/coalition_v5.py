from __future__ import annotations
from dataclasses import dataclass, replace
@dataclass(frozen=True)
class CoalitionMember:
    seat_id:str; roles:frozenset[str]; actions:frozenset[str]; privacy_scope:frozenset[str]
@dataclass(frozen=True)
class CoalitionCharter:
    coalition_id:str; task_id:str; human_owner:str; members:tuple[CoalitionMember,...]; parent_actions:frozenset[str]; parent_privacy:frozenset[str]; issued_tick:int; expires_tick:int; depth:int; dissolved:bool=False

def validate_coalition(c:CoalitionCharter,*,now_tick:int,max_members:int,max_depth:int)->dict:
    errors=[]
    if not c.human_owner: errors.append('MISSING_HUMAN_OWNER')
    if len(c.members)==0 or len(c.members)>max_members: errors.append('MEMBER_LIMIT')
    if c.depth>max_depth: errors.append('DEPTH_EXCEEDED')
    if now_tick>c.expires_tick: errors.append('COALITION_EXPIRED')
    if c.dissolved: errors.append('COALITION_DISSOLVED')
    for m in c.members:
        if not m.actions.issubset(c.parent_actions): errors.append('ACTION_WIDENING')
        if not m.privacy_scope.issubset(c.parent_privacy): errors.append('PRIVACY_WIDENING')
    return {'ok':not errors,'errors':sorted(set(errors))}

def dissolve(c:CoalitionCharter,active_leases:set[str])->dict:
    d=replace(c,dissolved=True)
    return {'charter':d,'revoked_leases':sorted(active_leases),'residual_authority':False,'status':'DISSOLVED'}
