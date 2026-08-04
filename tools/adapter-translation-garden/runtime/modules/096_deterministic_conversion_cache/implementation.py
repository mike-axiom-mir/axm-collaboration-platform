from __future__ import annotations
import copy, hashlib, json
from typing import Any

_FIELDS=('source_hash','contract_hash','adapter_id','adapter_version','options_hash','environment_hash','proof_hash')


def key(identity: dict[str, Any]) -> str:
    missing=[f for f in _FIELDS if not identity.get(f)]
    if missing: raise ValueError('missing identity fields: '+','.join(missing))
    payload={f:identity[f] for f in _FIELDS}
    return hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def lookup(entries: dict[str, Any], identity: dict[str, Any]) -> dict[str, Any]:
    try: cache_key=key(identity)
    except ValueError as exc: return {'verdict':'REFUSE','reason':str(exc),'hit':False}
    entry=entries.get(cache_key)
    if entry is None: return {'verdict':'MISS','key':cache_key,'hit':False}
    if entry.get('identity')!={f:identity[f] for f in _FIELDS}: return {'verdict':'REFUSE','reason':'identity mismatch under key','key':cache_key,'hit':False}
    if entry.get('state')!='verified': return {'verdict':'MISS','reason':'entry not verified','key':cache_key,'hit':False}
    return {'verdict':'HIT','key':cache_key,'hit':True,'output_reference':copy.deepcopy(entry.get('output_reference')),'proof_reference':entry.get('proof_reference')}


def plan_put(entries: dict[str, Any], identity: dict[str, Any], *, output_reference: Any, proof_reference: str) -> dict[str, Any]:
    try: cache_key=key(identity)
    except ValueError as exc: return {'verdict':'REFUSE','reason':str(exc),'persisted':False}
    out=copy.deepcopy(entries); out[cache_key]={'identity':{f:identity[f] for f in _FIELDS},'output_reference':copy.deepcopy(output_reference),'proof_reference':proof_reference,'state':'verified'}
    return {'verdict':'PUT_PLANNED','key':cache_key,'entries':out,'persisted':False}


def run(entries: dict[str, Any], identity: dict[str, Any]) -> dict[str, Any]: return lookup(entries,identity)
