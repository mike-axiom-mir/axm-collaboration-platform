from __future__ import annotations
from copy import deepcopy
from decimal import Decimal
from typing import Any

from axm_translation_core import add_loss, diff_values, new_loss_ledger

_UNSET = object()


def _dimension(name: str, source: Any = _UNSET, target: Any = _UNSET, *, metric: Any = None, passed: bool | None = None, evidence: Any = None) -> dict[str, Any]:
    if source is _UNSET or target is _UNSET:
        return {'dimension': name, 'status': 'UNPROVEN', 'metric': metric, 'evidence': deepcopy(evidence)}
    ok = source == target if passed is None else passed
    return {'dimension': name, 'status': 'PASS' if ok else 'FAIL', 'metric': metric, 'source': deepcopy(source), 'target': deepcopy(target), 'evidence': deepcopy(evidence)}


def run(
    source: Any, roundtripped: Any, *,
    source_bytes: bytes | str | None = None, roundtrip_bytes: bytes | str | None = None,
    source_meaning: Any = _UNSET, target_meaning: Any = _UNSET,
    source_appearance_hash: Any = _UNSET, target_appearance_hash: Any = _UNSET,
    source_timing: list[Any] | None = None, target_timing: list[Any] | None = None, timing_tolerance: Any = 0,
    source_behavior: Any = _UNSET, target_behavior: Any = _UNSET,
    source_authority: Any = _UNSET, target_authority: Any = _UNSET,
) -> dict[str, Any]:
    ledger = new_loss_ledger()
    results = []
    if source_bytes is None or roundtrip_bytes is None:
        results.append(_dimension('byte'))
    else:
        sb = source_bytes.encode('utf-8') if isinstance(source_bytes, str) else source_bytes
        tb = roundtrip_bytes.encode('utf-8') if isinstance(roundtrip_bytes, str) else roundtrip_bytes
        results.append(_dimension('byte', sb.hex(), tb.hex(), metric={'source_bytes': len(sb), 'target_bytes': len(tb)}))
    changes = diff_values(source, roundtripped)
    results.append(_dimension('structure', source, roundtripped, metric={'difference_count': len(changes)}, passed=not changes, evidence=changes))
    results.append(_dimension('meaning', source_meaning, target_meaning))
    results.append(_dimension('appearance', source_appearance_hash, target_appearance_hash))
    if source_timing is None or target_timing is None:
        results.append(_dimension('timing'))
    else:
        if len(source_timing) != len(target_timing):
            timing_pass = False; max_error = None
        else:
            errors = [abs(Decimal(str(a)) - Decimal(str(b))) for a, b in zip(source_timing, target_timing)]
            max_error = max(errors, default=Decimal('0'))
            timing_pass = max_error <= Decimal(str(timing_tolerance))
        results.append(_dimension('timing', source_timing, target_timing, metric={'max_error': None if max_error is None else str(max_error), 'tolerance': str(timing_tolerance)}, passed=timing_pass))
    results.append(_dimension('behavior', source_behavior, target_behavior))
    results.append(_dimension('authority', source_authority, target_authority))
    severity = {'byte': 'low', 'structure': 'high', 'meaning': 'high', 'appearance': 'medium', 'timing': 'medium', 'behavior': 'high', 'authority': 'blocking'}
    for result in results:
        if result['status'] == 'FAIL':
            add_loss(ledger, kind=f"{result['dimension']}_fidelity_failed", path=f"$.dimensions.{result['dimension']}", source_value=result.get('source'), target_value=result.get('target'), reason=f"round-trip {result['dimension']} fidelity did not match", severity=severity[result['dimension']], reversible=False)
    statuses = [r['status'] for r in results]
    if 'FAIL' in statuses:
        verdict = 'FAIL'
    elif all(s == 'PASS' for s in statuses):
        verdict = 'PASS'
    elif all(s == 'UNPROVEN' for s in statuses):
        verdict = 'UNPROVEN'
    else:
        verdict = 'PARTIAL'
    return {
        'schema': 'axm.translation.roundtrip-fidelity-report/v1',
        'verdict': verdict, 'results': results, 'loss': ledger,
        'dimensions_kept_separate': True,
        'limitations': ['UNPROVEN means no evidence was supplied for that dimension; it is not a pass.'],
    }
