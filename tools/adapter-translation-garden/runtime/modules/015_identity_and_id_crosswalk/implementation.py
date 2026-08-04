from __future__ import annotations
from copy import deepcopy
from datetime import datetime
from typing import Any

_PRIVACY = {'public': 0, 'internal': 1, 'confidential': 2, 'restricted': 3}


def _parse_time(value: str | None) -> datetime | None:
    if value is None:
        return None
    text = value[:-1] + '+00:00' if value.endswith('Z') else value
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        raise ValueError('crosswalk times must include an offset or Z')
    return parsed


def make_record(
    *, source_system: str, source_id: str, target_system: str, target_id: str,
    source_scope: str | None = None, target_scope: str | None = None,
    relationship: str = 'declared_crosswalk', authority: str = 'declared',
    confidence: float = 1.0, privacy: str = 'internal',
    valid_from: str | None = None, valid_until: str | None = None,
    evidence: list[Any] | None = None,
) -> dict[str, Any]:
    if privacy not in _PRIVACY:
        raise ValueError(f'unsupported privacy level: {privacy}')
    if not 0 <= confidence <= 1:
        raise ValueError('confidence must be between 0 and 1')
    return {
        'source': {'system': source_system, 'id': str(source_id), 'scope': source_scope},
        'target': {'system': target_system, 'id': str(target_id), 'scope': target_scope},
        'relationship': relationship,
        'authority': authority,
        'confidence': confidence,
        'privacy': privacy,
        'valid_from': valid_from,
        'valid_until': valid_until,
        'evidence': deepcopy(evidence or []),
    }


def run(
    *, source_system: str, source_id: str, target_system: str,
    records: list[dict[str, Any]], source_scope: str | None = None,
    at_time: str | None = None, max_privacy: str = 'internal',
) -> dict[str, Any]:
    if max_privacy not in _PRIVACY:
        raise ValueError(f'unsupported privacy level: {max_privacy}')
    moment = _parse_time(at_time)
    matched = []
    expired = []
    for record in records:
        source = record.get('source', {})
        target = record.get('target', {})
        if source.get('system') != source_system or str(source.get('id')) != str(source_id):
            continue
        if target.get('system') != target_system:
            continue
        if source_scope is not None and source.get('scope') != source_scope:
            continue
        start, end = _parse_time(record.get('valid_from')), _parse_time(record.get('valid_until'))
        if moment is not None and ((start and moment < start) or (end and moment >= end)):
            expired.append(deepcopy(record))
            continue
        item = deepcopy(record)
        privacy = item.get('privacy', 'restricted')
        if privacy not in _PRIVACY:
            privacy = 'restricted'
        if _PRIVACY[privacy] > _PRIVACY[max_privacy]:
            item['target']['id'] = None
            item['target']['redacted'] = True
            item['status'] = 'REDACTED'
        else:
            item['status'] = 'VISIBLE'
        matched.append(item)
    visible = [r for r in matched if r['status'] == 'VISIBLE']
    distinct = {(r['target'].get('id'), r['target'].get('scope')) for r in visible}
    if len(distinct) == 1:
        verdict = 'RESOLVED'
    elif len(distinct) > 1:
        verdict = 'AMBIGUOUS'
    elif matched:
        verdict = 'REDACTED'
    else:
        verdict = 'NOT_FOUND'
    return {
        'schema': 'axm.translation.identity-crosswalk/v1',
        'verdict': verdict,
        'source': {'system': source_system, 'id': str(source_id), 'scope': source_scope},
        'target_system': target_system,
        'candidates': matched,
        'expired_or_out_of_window': expired,
        'native_authority_not_inferred': True,
        'uniqueness_not_assumed': True,
    }
