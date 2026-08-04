
from __future__ import annotations
from typing import Any

LEVEL = {'PUBLIC': 0, 'INTERNAL': 1, 'PRIVATE': 2, 'SECRET': 3}


def max_label(labels: list[str]) -> str:
    return max(labels, key=lambda x: LEVEL[x]) if labels else 'PUBLIC'


def filter_context(fields: list[dict[str, Any]], *, maximum_label: str, allowed_names: set[str]) -> dict[str, Any]:
    included, excluded, errors = [], [], []
    limit = LEVEL[maximum_label]
    for field in fields:
        name, label = field['name'], field['label']
        if label not in LEVEL:
            errors.append('UNKNOWN_TAINT_LABEL')
            continue
        if name not in allowed_names or LEVEL[label] > limit:
            excluded.append({'name': name, 'reason': 'NOT_REQUIRED_OR_NOT_AUTHORIZED', 'label': label})
        else:
            included.append(field)
    return {'ok': not errors, 'included': included, 'excluded': excluded, 'errors': errors,
            'output_taint': max_label([f['label'] for f in included])}


def transform(input_fields: list[dict[str, Any]], output: dict[str, Any], *, redaction_receipt: str | None = None) -> dict[str, Any]:
    incoming = max_label([f['label'] for f in input_fields])
    outgoing = output.get('label', 'PUBLIC')
    if LEVEL[outgoing] < LEVEL[incoming] and not redaction_receipt:
        return {'ok': False, 'code': 'TAINT_DOWNGRADE_WITHOUT_REDACTION_RECEIPT'}
    return {'ok': True, 'code': 'TAINT_PRESERVED_OR_REVIEWED', 'input_taint': incoming, 'output_taint': outgoing}
