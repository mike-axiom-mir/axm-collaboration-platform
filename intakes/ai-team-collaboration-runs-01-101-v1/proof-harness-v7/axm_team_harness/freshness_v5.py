from __future__ import annotations
from dataclasses import dataclass
@dataclass(frozen=True)
class EvidenceNode:
    node_id:str; issued_tick:int; expires_tick:int; parents:tuple[str,...]=(); clock_known:bool=True

def evaluate_freshness(nodes:list[EvidenceNode],*,now_tick:int)->dict:
    by={n.node_id:n for n in nodes}; stale=set(); held=set(); reasons={}
    for n in nodes:
        r=[]
        if not n.clock_known: r.append('UNKNOWN_CLOCK')
        if now_tick>n.expires_tick: r.append('EXPIRED')
        for p in n.parents:
            if p not in by: r.append('MISSING_PARENT')
        if r: held.add(n.node_id); reasons[n.node_id]=r
    changed=True
    while changed:
        changed=False
        for n in nodes:
            if n.node_id in stale or n.node_id in held: continue
            if now_tick>n.expires_tick or any(p in stale or p in held for p in n.parents):
                stale.add(n.node_id); reasons[n.node_id]=['TRANSITIVE_STALE']; changed=True
    fresh=sorted(set(by)-stale-held)
    return {'ok':not stale and not held,'fresh':fresh,'stale':sorted(stale),'held':sorted(held),'reasons':reasons}
