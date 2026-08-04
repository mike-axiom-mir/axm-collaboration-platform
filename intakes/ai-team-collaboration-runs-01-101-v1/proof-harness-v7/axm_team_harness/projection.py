
from __future__ import annotations
from typing import Any

SENSITIVE_KEYS = {'private_context', 'raw_prompt', 'token', 'secret', 'secret_note', 'api_key', 'password'}


def sanitize(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: sanitize(v) for k, v in value.items() if k not in SENSITIVE_KEYS}
    if isinstance(value, list):
        return [sanitize(item) for item in value]
    return value


def human_projection(fixture: dict[str, Any], validation: dict[str, Any]) -> dict[str, Any]:
    return sanitize({
        'projection_version': 'axm.team.human-projection.v1',
        'module_id': fixture.get('module_id'),
        'proof_slice_id': fixture.get('proof_slice_id'),
        'family': fixture.get('family'),
        'fixture_kind': fixture.get('fixture_kind'),
        'state_object': fixture.get('payload', {}).get('state_object'),
        'critical_invariant': fixture.get('payload', {}).get('critical_invariant'),
        'validation': validation,
        'hold_or_action': 'ALLOW_PROOF_PATH' if validation.get('ok') else 'HOLD_AND_REVIEW',
        'evidence_refs': fixture.get('evidence', {}).get('source_refs', []),
        'human_decision': fixture.get('human', {}),
        'private_context': fixture.get('private_context', {}),
    })
