from __future__ import annotations
import hashlib, json
from dataclasses import dataclass, asdict
@dataclass(frozen=True)
class DecisionSnapshot:
    decision_id:str; actor_id:str; actor_kind:str; producer_id:str; selected_option:str
    source_digest:str; contract_digest:str; policy_digest:str; task_digest:str; options_digest:str
    high_impact:bool=True
def _digest(d:dict)->str:
    return hashlib.sha256(json.dumps(d,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def seal_decision(s:DecisionSnapshot)->dict:
    payload=asdict(s); return {'snapshot':payload,'snapshot_digest':_digest(payload)}
def validate_decision(envelope:dict,*,current:dict[str,str])->dict:
    errors=[]; s=envelope.get('snapshot',{})
    if envelope.get('snapshot_digest')!=_digest(s): errors.append('SNAPSHOT_TAMPERED')
    for key in ['source','contract','policy','task','options']:
        if s.get(f'{key}_digest')!=current.get(key): errors.append(f'{key.upper()}_DRIFT')
    if s.get('high_impact') and s.get('actor_kind')!='HUMAN': errors.append('HUMAN_REQUIRED')
    if s.get('actor_id')==s.get('producer_id'): errors.append('SELF_APPROVAL_FORBIDDEN')
    if not s.get('selected_option'): errors.append('MISSING_SELECTION')
    return {'ok':not errors,'errors':sorted(set(errors)),'state':'VALID' if not errors else 'HELD_REVIEW'}
