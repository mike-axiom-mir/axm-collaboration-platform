from __future__ import annotations
from typing import Any

def check_conformance(source: dict[str, Any], output: dict[str, Any], *, required_fields: set[str]) -> dict[str, Any]:
    errors: list[str] = []
    missing = sorted(required_fields - set(output))
    if missing:
        errors.append('REQUIRED_FIELD_LOSS')
    source_actions = set(source.get('authority', {}).get('allowed_actions', []))
    output_actions = set(output.get('authority', {}).get('allowed_actions', []))
    if not output_actions.issubset(source_actions):
        errors.append('AUTHORITY_WIDENED_BY_ADAPTER')
    source_privacy = source.get('privacy', {}).get('classification')
    output_privacy = output.get('privacy', {}).get('classification')
    if source_privacy and output_privacy and source_privacy != output_privacy:
        errors.append('PRIVACY_CLASS_CHANGED')
    if source.get('module_id') != output.get('module_id'):
        errors.append('MODULE_ID_CHANGED')
    if source.get('proof_slice_id') != output.get('proof_slice_id'):
        errors.append('PROOF_SLICE_ID_CHANGED')
    return {'ok': not errors, 'error_codes': errors, 'missing_fields': missing}
