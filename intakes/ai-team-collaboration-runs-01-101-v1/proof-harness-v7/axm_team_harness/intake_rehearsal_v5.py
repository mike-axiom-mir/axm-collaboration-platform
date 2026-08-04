from __future__ import annotations
REQUIRED={'contract','positive','negative','recovery','contestability','workspace_conflict','revocation','limitations'}
MAX='READY_FOR_BOUNDED_READ_ONLY_INTAKE_REHEARSAL_CANDIDATE'
def validate_intake_rehearsal(bundle:dict)->dict:
    errors=[]; evidence=bundle.get('evidence',{})
    if REQUIRED-set(evidence): errors.append('INCOMPLETE_EVIDENCE')
    if bundle.get('runtime_proven'): errors.append('RUNTIME_CLAIM_FORBIDDEN')
    if bundle.get('canon'): errors.append('CANON_FORBIDDEN')
    if bundle.get('producer_id')==bundle.get('approval_actor'): errors.append('SELF_APPROVAL_FORBIDDEN')
    if bundle.get('novelty_status')!='NOVEL_DELTA': errors.append('NO_NOVEL_DELTA')
    if bundle.get('human_owner')!='HUMAN': errors.append('HUMAN_OWNER_REQUIRED')
    return {'ok':not errors,'errors':sorted(errors),'status':MAX if not errors else 'HELD'}
