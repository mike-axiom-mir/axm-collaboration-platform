from __future__ import annotations
import copy, hashlib, json
from typing import Any


def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()


def new_proof_chain(chain_id: str) -> dict[str, Any]:
    if not isinstance(chain_id,str) or not chain_id.strip(): raise ValueError('chain_id is required')
    return {'schema':'axm.translation.proof-chain/v1','chain_id':chain_id,'events':[],'tip':None}


def append_proof_event(chain: dict[str, Any], *, event_type: str, module_id: str, evidence: Any, observed_at: str | None = None, claims: list[str] | None = None) -> dict[str, Any]:
    if chain.get('schema')!='axm.translation.proof-chain/v1': raise ValueError('unsupported chain schema')
    if not event_type or not module_id: raise ValueError('event_type and module_id are required')
    out=copy.deepcopy(chain); events=out.setdefault('events',[]); prior=out.get('tip')
    core={'sequence':len(events),'event_type':event_type,'module_id':module_id,'evidence_sha256':_hash(evidence),'previous_hash':prior,'observed_at':observed_at,'claims':list(claims or [])}
    event={**core,'event_hash':_hash(core),'evidence':copy.deepcopy(evidence)}
    events.append(event); out['tip']=event['event_hash']; return out


def verify_proof_chain(chain: dict[str, Any]) -> dict[str, Any]:
    errors=[]; previous=None
    if chain.get('schema')!='axm.translation.proof-chain/v1': errors.append('unsupported_schema')
    for index,event in enumerate(chain.get('events',[])):
        core={k:event.get(k) for k in ('sequence','event_type','module_id','evidence_sha256','previous_hash','observed_at','claims')}
        if event.get('sequence')!=index: errors.append(f'sequence_mismatch:{index}')
        if event.get('previous_hash')!=previous: errors.append(f'previous_hash_mismatch:{index}')
        if event.get('evidence_sha256')!=_hash(event.get('evidence')): errors.append(f'evidence_hash_mismatch:{index}')
        expected=_hash(core)
        if event.get('event_hash')!=expected: errors.append(f'event_hash_mismatch:{index}')
        previous=event.get('event_hash')
    if chain.get('tip')!=previous: errors.append('tip_mismatch')
    return {'verdict':'PASS' if not errors else 'REFUSE','errors':errors,'events_verified':len(chain.get('events',[])),'tip':previous,'executed':False}
