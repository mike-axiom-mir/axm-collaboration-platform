from __future__ import annotations
from copy import deepcopy
from typing import Any

from axm_translation_core import add_loss, new_loss_ledger

MISSING = object()
STATES = {'value', 'null', 'missing', 'defaulted', 'unknown', 'unsupported', 'redacted', 'empty'}


def semantic_value(state: str, value: Any = MISSING, *, reason: str | None = None, provenance: list[Any] | None = None) -> dict[str, Any]:
    if state not in STATES:
        raise ValueError(f'unsupported semantic state: {state}')
    result = {'schema': 'axm.translation.semantic-value/v1', 'state': state, 'reason': reason, 'provenance': deepcopy(provenance or [])}
    if value is not MISSING:
        result['value'] = deepcopy(value)
    if state == 'value' and value is MISSING:
        raise ValueError('value state requires a value')
    return result


def classify(record: dict[str, Any], key: str, *, state_hint: str | None = None, empty_policy: str = 'value') -> dict[str, Any]:
    if state_hint:
        value = record.get(key, MISSING)
        return semantic_value(state_hint, value, reason='explicit caller state hint') if value is not MISSING else semantic_value(state_hint, reason='explicit caller state hint')
    if key not in record:
        return semantic_value('missing', reason='key is absent')
    value = record[key]
    if value is None:
        return semantic_value('null', None, reason='explicit null value')
    if value == '' and empty_policy == 'empty':
        return semantic_value('empty', '', reason='explicit empty_policy')
    return semantic_value('value', value)


def adapt(envelope: dict[str, Any], *, target_supported_states: list[str], fallback: str = 'sidecar', collapse_value: Any = None) -> dict[str, Any]:
    state = envelope.get('state')
    if state not in STATES:
        raise ValueError('invalid semantic value envelope')
    supported = set(target_supported_states)
    ledger = new_loss_ledger()
    if state in supported:
        present = state != 'missing'
        value = deepcopy(envelope.get('value')) if 'value' in envelope else None
        return {'schema': 'axm.translation.semantic-value-adaptation/v1', 'ok': True, 'status': 'DIRECT', 'target_present': present, 'target_value': value, 'sidecar': None, 'loss': ledger}
    if fallback == 'refuse':
        add_loss(ledger, kind='semantic_state_unsupported', path='$.state', source_value=state, reason='target cannot represent the source state and fallback is refuse', severity='blocking')
        return {'schema': 'axm.translation.semantic-value-adaptation/v1', 'ok': False, 'status': 'REFUSED', 'target_present': False, 'target_value': None, 'sidecar': deepcopy(envelope), 'loss': ledger}
    if fallback == 'sidecar':
        add_loss(ledger, kind='semantic_state_sidecar', path='$.state', source_value=state, target_value=collapse_value, reason='target value uses an explicit fallback while the exact state is preserved in a sidecar', severity='high', reversible=True)
        return {'schema': 'axm.translation.semantic-value-adaptation/v1', 'ok': True, 'status': 'PRESERVED_IN_SIDECAR', 'target_present': state != 'missing', 'target_value': deepcopy(collapse_value), 'sidecar': deepcopy(envelope), 'loss': ledger}
    if fallback == 'collapse':
        add_loss(ledger, kind='semantic_state_collapsed', path='$.state', source_value=state, target_value=collapse_value, reason='caller explicitly requested an irreversible collapse', severity='blocking', reversible=False)
        return {'schema': 'axm.translation.semantic-value-adaptation/v1', 'ok': False, 'status': 'COLLAPSED_WITH_BLOCKING_LOSS', 'target_present': state != 'missing', 'target_value': deepcopy(collapse_value), 'sidecar': None, 'loss': ledger}
    raise ValueError(f'unsupported fallback: {fallback}')


def run(record: dict[str, Any], key: str, *, target_supported_states: list[str], state_hint: str | None = None, empty_policy: str = 'value', fallback: str = 'sidecar', collapse_value: Any = None) -> dict[str, Any]:
    envelope = classify(record, key, state_hint=state_hint, empty_policy=empty_policy)
    result = adapt(envelope, target_supported_states=target_supported_states, fallback=fallback, collapse_value=collapse_value)
    result['source_semantics'] = envelope
    return result
