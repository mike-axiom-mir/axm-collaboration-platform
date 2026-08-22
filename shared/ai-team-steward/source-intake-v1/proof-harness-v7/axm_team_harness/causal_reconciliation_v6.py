from __future__ import annotations
from dataclasses import dataclass
@dataclass(frozen=True)
class VersionedPacket:
    packet_id:str; vector:dict[str,int]; authority_epoch:int; payload_digest:str

def compare_vectors(a:dict[str,int],b:dict[str,int])->str:
    keys=set(a)|set(b); age=all(a.get(k,0)>=b.get(k,0) for k in keys); bge=all(b.get(k,0)>=a.get(k,0) for k in keys)
    if age and bge: return 'EQUAL'
    if age: return 'A_DOMINATES'
    if bge: return 'B_DOMINATES'
    return 'CONCURRENT'

def reconcile(a:VersionedPacket,b:VersionedPacket,*,current_epoch:int)->dict:
    if a.authority_epoch!=current_epoch or b.authority_epoch!=current_epoch:
        return {'ok':False,'status':'HELD','error':'STALE_AUTHORITY_EPOCH'}
    rel=compare_vectors(a.vector,b.vector)
    if rel=='A_DOMINATES': return {'ok':True,'selected':'A','relation':rel}
    if rel=='B_DOMINATES': return {'ok':True,'selected':'B','relation':rel}
    if rel=='EQUAL' and a.payload_digest==b.payload_digest: return {'ok':True,'selected':'EQUIVALENT','relation':rel}
    return {'ok':False,'status':'HELD_CONFLICT','error':'CONCURRENT_OR_DIVERGENT','relation':rel}
