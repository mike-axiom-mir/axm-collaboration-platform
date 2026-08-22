from __future__ import annotations

REQUIRED = {'contract','positive','negative','recovery','human_projection','limitations'}


def validate_release_bundle(bundle: dict) -> dict:
    errors = []
    evidence = set(bundle.get('evidence', {}))
    if not REQUIRED.issubset(evidence):
        errors.append('INCOMPLETE_EVIDENCE_BUNDLE')
    if bundle.get('runtime_proven'):
        errors.append('UNSUPPORTED_RUNTIME_CLAIM')
    if bundle.get('canon'):
        errors.append('CANON_FORBIDDEN')
    if bundle.get('approval_owner') != 'HUMAN':
        errors.append('HUMAN_APPROVAL_OWNER_REQUIRED')
    if bundle.get('producer_id') == bundle.get('approval_actor'):
        errors.append('SELF_APPROVAL_FORBIDDEN')
    status = 'READY_FOR_READ_ONLY_MANIFEST_BINDING_CANDIDATE' if not errors else 'HELD'
    return {'ok': not errors, 'errors': errors, 'status': status, 'integrated': False, 'canon': False}
