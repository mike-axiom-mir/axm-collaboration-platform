from __future__ import annotations
from dataclasses import dataclass
@dataclass(frozen=True)
class Challenge:
    challenge_id:str; challenger_id:str; target_decision:str; scope:str; reason:str; high_impact:bool; retaliation_action:str=''

def evaluate_challenge(c:Challenge,*,expected_scope:str,explanation:dict,resolver_id:str,producer_id:str)->dict:
    errors=[]; required={'sources','authority','limitations','decision_path'}
    if c.scope!=expected_scope: errors.append('SCOPE_MISMATCH')
    if not c.reason: errors.append('MISSING_REASON')
    if required-set(explanation): errors.append('INCOMPLETE_EXPLANATION')
    if resolver_id==producer_id: errors.append('PRODUCER_ONLY_RESOLUTION')
    if c.retaliation_action: errors.append('RETALIATION_FORBIDDEN')
    return {'ok':not errors,'errors':sorted(errors),'action_state':'PAUSED_FOR_CHALLENGE' if c.high_impact else 'UNCHANGED','explanation_receipt':explanation if not errors else None}
