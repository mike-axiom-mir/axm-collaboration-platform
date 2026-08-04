from __future__ import annotations
REQUIRED={'decision_snapshot','receipt_auth','canonical_package','transaction_rehearsal','invariant_bundle','launch_selftest','human_handoff','archive_safety','lineage_audit','limitations','human_decision'}
MAX_STATUS='READY_FOR_LOCAL_AXM_INTAKE_HANDOFF_CANDIDATE'
def evaluate_final_gate(bundle:dict)->dict:
    errors=[]; evidence=bundle.get('evidence',{})
    missing=sorted(REQUIRED-set(evidence))
    if missing: errors.append('MISSING_EVIDENCE:'+','.join(missing))
    if bundle.get('runtime_proven'): errors.append('RUNTIME_PROOF_FORBIDDEN')
    if bundle.get('canon'): errors.append('CANON_FORBIDDEN')
    if bundle.get('auto_apply'): errors.append('AUTO_APPLY_FORBIDDEN')
    if bundle.get('producer_id')==bundle.get('approval_actor'): errors.append('SELF_APPROVAL_FORBIDDEN')
    if bundle.get('approval_actor_kind')!='HUMAN': errors.append('HUMAN_APPROVAL_REQUIRED')
    if bundle.get('unresolved_defects'): errors.append('UNRESOLVED_DEFECTS')
    if bundle.get('lineage_complete') is not True: errors.append('LINEAGE_INCOMPLETE')
    if bundle.get('novelty_status')!='NOVEL_DELTA': errors.append('NO_NOVEL_DELTA')
    return {'ok':not errors,'errors':errors,'status':MAX_STATUS if not errors else 'HELD','more_specification_time_needed':False if not errors else True,'runtime_integrated':False,'canon':False}
