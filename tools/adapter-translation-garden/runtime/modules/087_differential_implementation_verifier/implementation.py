from __future__ import annotations
from copy import deepcopy
from typing import Any, Callable

from axm_translation_core import contract_fingerprint


def _signature(value: Any) -> str:
    try:
        return contract_fingerprint(value)['digest']
    except (TypeError, ValueError):
        return contract_fingerprint({'repr': repr(value), 'type': type(value).__name__})['digest']


def run(implementations: dict[str, Callable[..., Any]], cases: list[dict[str, Any]], *, normalizer: Callable[[Any], Any] | None = None) -> dict[str, Any]:
    if len(implementations) < 2:
        raise ValueError('at least two implementations are required')
    results = []
    for index, case in enumerate(cases):
        case_name = case.get('name', f'case-{index}')
        outcomes = {}
        for name, implementation in sorted(implementations.items()):
            args = deepcopy(case.get('args', []))
            kwargs = deepcopy(case.get('kwargs', {}))
            before = deepcopy({'args': args, 'kwargs': kwargs})
            try:
                output = implementation(*args, **kwargs)
                normalized = normalizer(output) if normalizer else output
                outcome = {'status': 'RETURNED', 'output': deepcopy(output), 'normalized': deepcopy(normalized), 'signature': _signature(normalized)}
            except Exception as exc:
                normalized = {'exception_type': type(exc).__name__, 'message': str(exc)}
                outcome = {'status': 'RAISED', 'exception': normalized, 'signature': _signature(normalized)}
            outcome['input_mutated'] = before != {'args': args, 'kwargs': kwargs}
            outcomes[name] = outcome
        groups: dict[str, list[str]] = {}
        for name, outcome in outcomes.items():
            groups.setdefault(outcome['signature'], []).append(name)
        mutation = any(o['input_mutated'] for o in outcomes.values())
        agree = len(groups) == 1 and not mutation
        results.append({
            'name': case_name, 'agree': agree, 'outcomes': outcomes,
            'agreement_groups': list(groups.values()), 'input_mutation_detected': mutation,
        })
    disagreements = [r for r in results if not r['agree']]
    return {
        'schema': 'axm.translation.differential-verification/v1',
        'verdict': 'PASS' if not disagreements else 'FAIL',
        'results': results, 'agreement_count': len(results) - len(disagreements),
        'disagreement_count': len(disagreements),
        'limitations': ['Agreement does not prove correctness; it only shows the compared implementations behaved the same on these cases.'],
    }
