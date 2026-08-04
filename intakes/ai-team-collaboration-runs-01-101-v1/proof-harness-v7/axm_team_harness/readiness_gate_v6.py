from __future__ import annotations
REQ={'delegation_closure','authority_epoch','evidence_custody','partial_failure','proof_compaction','review_session','causal_reconciliation','proof_summary','sandbox_intake','limitations'}
MAX='READY_FOR_HUMAN_REVIEWED_LOCAL_SANDBOX_BINDING_CANDIDATE'
def evaluate_readiness(bundle:dict)->dict:
    errors=[]; evidence=bundle.get('evidence',{})
    missing=sorted(REQ-set(evidence))
    if missing: errors.append('MISSING_EVIDENCE')
    if bundle.get('runtime_proven'): errors.append('RUNTIME_CLAIM_FORBIDDEN')
    if bundle.get('canon'): errors.append('CANON_CLAIM_FORBIDDEN')
    if bundle.get('producer_id')==bundle.get('approval_actor'): errors.append('SELF_APPROVAL_FORBIDDEN')
    if bundle.get('approval_actor_kind')!='HUMAN': errors.append('HUMAN_APPROVAL_REQUIRED')
    if bundle.get('novelty_status')!='NOVEL_DELTA': errors.append('NO_NOVEL_DELTA')
    if not bundle.get('rollback_clean'): errors.append('ROLLBACK_PROOF_REQUIRED')
    return {'ok':not errors,'errors':sorted(errors),'status':MAX if not errors else 'HELD','max_status':MAX,'canon':False,'runtime_integrated':False}
