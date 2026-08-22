from __future__ import annotations
from copy import deepcopy
from typing import Any

from axm_translation_core import add_loss, new_loss_ledger


def _resolve_entry(entry: Any) -> tuple[list[Any], dict[str, Any]]:
    metadata: dict[str, Any] = {}
    if isinstance(entry, dict) and 'target' in entry:
        target = entry['target']
        metadata = {k: deepcopy(v) for k, v in entry.items() if k != 'target'}
    else:
        target = entry
    candidates = list(target) if isinstance(target, (list, tuple, set)) else [target]
    return candidates, metadata


def run(values: Any, crosswalk: dict[Any, Any], *, preserve_unmapped: bool = True, strict: bool = False) -> dict[str, Any]:
    scalar = not isinstance(values, (list, tuple))
    items = [values] if scalar else list(values)
    ledger = new_loss_ledger()
    results = []
    for index, source in enumerate(items):
        if source not in crosswalk:
            target = {'state': 'unmapped', 'source': deepcopy(source)} if preserve_unmapped else None
            results.append({'source': deepcopy(source), 'target': target, 'status': 'UNMAPPED'})
            add_loss(ledger, kind='unmapped_code', path=f'$.values[{index}]', source_value=source, target_value=target, reason='no explicit crosswalk entry exists', severity='blocking' if strict else 'high', reversible=preserve_unmapped)
            continue
        candidates, metadata = _resolve_entry(crosswalk[source])
        distinct = []
        for candidate in candidates:
            if not any(candidate == existing for existing in distinct):
                distinct.append(candidate)
        if len(distinct) != 1:
            results.append({'source': deepcopy(source), 'target': None, 'candidates': deepcopy(distinct), 'status': 'AMBIGUOUS', 'metadata': metadata})
            add_loss(ledger, kind='ambiguous_codebook_mapping', path=f'$.values[{index}]', source_value=source, target_value=distinct, reason='crosswalk provides more than one distinct target', severity='blocking')
            continue
        results.append({'source': deepcopy(source), 'target': deepcopy(distinct[0]), 'status': 'MAPPED', 'metadata': metadata})
    mapped_values = [r['target'] for r in results]
    return {
        'schema': 'axm.translation.codebook-crosswalk/v1',
        'ok': not ledger['summary']['has_blocking_loss'],
        'result': mapped_values[0] if scalar else mapped_values,
        'entries': results,
        'loss': ledger,
        'unmapped_preserved': preserve_unmapped,
    }
