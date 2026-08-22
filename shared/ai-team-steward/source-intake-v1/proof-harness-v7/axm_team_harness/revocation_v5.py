from __future__ import annotations
from dataclasses import dataclass, replace
@dataclass(frozen=True)
class LeaseNode:
    lease_id:str; parent_id:str|None; holder:str; actions:frozenset[str]; revoked:bool=False; acknowledged:bool=False

def cascade_revoke(nodes:list[LeaseNode],root_id:str)->dict:
    by={n.lease_id:n for n in nodes}; children={k:[] for k in by}
    for n in nodes:
        if n.parent_id in children: children[n.parent_id].append(n.lease_id)
    affected=[]; stack=[root_id]
    while stack:
        x=stack.pop()
        if x in by and x not in affected: affected.append(x); stack.extend(children.get(x,[]))
    out=[replace(n,revoked=True,acknowledged=True) if n.lease_id in affected else n for n in nodes]
    orphans=[n.lease_id for n in nodes if n.parent_id and n.parent_id not in by]
    return {'nodes':out,'affected':sorted(affected),'orphans':sorted(orphans),'all_acknowledged':all(n.acknowledged for n in out if n.lease_id in affected)}

def authorize(nodes:list[LeaseNode],lease_id:str,action:str)->dict:
    by={n.lease_id:n for n in nodes}; n=by.get(lease_id); errors=[]
    if not n: errors.append('LEASE_MISSING')
    else:
        if n.revoked: errors.append('LEASE_REVOKED')
        if action not in n.actions: errors.append('ACTION_DENIED')
        p=n.parent_id
        while p:
            pn=by.get(p)
            if not pn: errors.append('ORPHAN_LEASE'); break
            if pn.revoked: errors.append('ANCESTOR_REVOKED')
            p=pn.parent_id
    return {'ok':not errors,'errors':sorted(set(errors))}

def resume_with_new_lease(old:LeaseNode,new:LeaseNode,*,human_receipt:bool)->dict:
    ok=old.revoked and new.lease_id!=old.lease_id and human_receipt and not new.revoked
    return {'ok':ok,'status':'NEW_LEASE_ACTIVE' if ok else 'HOLD_RESUME_DENIED'}
