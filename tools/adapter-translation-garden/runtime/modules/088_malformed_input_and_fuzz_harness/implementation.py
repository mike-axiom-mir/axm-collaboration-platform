from __future__ import annotations
import json
import random
from copy import deepcopy
from typing import Any


def _type_flip(value: Any) -> Any:
    if value is None: return False
    if isinstance(value, bool): return 1 if value else 0
    if isinstance(value, (int, float)): return str(value)
    if isinstance(value, str): return [value]
    if isinstance(value, list): return {'items': value}
    if isinstance(value, dict): return list(value.items())
    return None


def _bounded_deep(depth: int) -> Any:
    value: Any = 'leaf'
    for _ in range(depth):
        value = {'nested': value}
    return value


def run(value: Any, *, seed: int = 0, max_cases: int = 32, max_depth: int = 8, max_string_length: int = 4096, include_raw_json: bool = True) -> dict[str, Any]:
    if not 1 <= max_cases <= 256:
        raise ValueError('max_cases must be between 1 and 256')
    if not 1 <= max_depth <= 64:
        raise ValueError('max_depth must be between 1 and 64')
    if not 1 <= max_string_length <= 65536:
        raise ValueError('max_string_length must be between 1 and 65536')
    rng = random.Random(seed)
    cases: list[dict[str, Any]] = []
    def add(name: str, candidate: Any, category: str, representation: str = 'python_value') -> None:
        if len(cases) < max_cases:
            cases.append({'name': name, 'category': category, 'representation': representation, 'input': candidate})
    add('null-root', None, 'null')
    add('type-flip-root', _type_flip(value), 'type_confusion')
    add('empty-object', {}, 'empty')
    add('empty-list', [], 'empty')
    for number in [-1, 0, 1, 2**31 - 1, 2**31, 2**63 - 1]:
        add(f'boundary-number-{number}', number, 'numeric_boundary')
    add('deep-nesting', _bounded_deep(max_depth), 'depth_boundary')
    add('oversized-string-capped', 'X' * max_string_length, 'size_boundary')
    if isinstance(value, str):
        for cut in sorted({0, 1, len(value)//2, max(0, len(value)-1)}):
            add(f'truncated-string-{cut}', value[:cut], 'truncated')
    if isinstance(value, dict):
        keys = sorted(value, key=str)
        for key in keys[:8]:
            changed = deepcopy(value); changed[key] = None
            add(f'null-field-{key}', changed, 'null_insertion')
            changed = deepcopy(value); changed.pop(key, None)
            add(f'missing-field-{key}', changed, 'field_deletion')
            changed = deepcopy(value); changed[key] = _type_flip(value[key])
            add(f'type-flip-field-{key}', changed, 'type_confusion')
        if include_raw_json and keys:
            key = str(keys[0]).replace('"', '\\"')
            add('duplicate-json-key', '{"%s":1,"%s":2}' % (key, key), 'duplicate_key', 'raw_json_text')
    if isinstance(value, list):
        add('list-with-null', deepcopy(value) + [None], 'null_insertion')
        add('list-reversed', list(reversed(deepcopy(value))), 'order_change')
    # Deterministically shuffle while retaining case identities.
    rng.shuffle(cases)
    return {
        'schema': 'axm.translation.malformed-input-corpus/v1',
        'seed': seed, 'cases': cases[:max_cases], 'case_count': min(len(cases), max_cases),
        'limits': {'max_cases': max_cases, 'max_depth': max_depth, 'max_string_length': max_string_length},
        'execution_performed': False,
        'limitations': ['This prototype only creates bounded cases. Execute targets in AXM\'s separate sandbox with time, memory, and process limits.'],
    }


def classify_results(corpus: dict[str, Any], outcomes: list[dict[str, Any]]) -> dict[str, Any]:
    by_name = {o.get('name'): o for o in outcomes}
    results = []
    for case in corpus.get('cases', []):
        outcome = deepcopy(by_name.get(case['name'], {'status': 'NOT_RUN'}))
        results.append({'name': case['name'], 'category': case['category'], 'outcome': outcome})
    dangerous = [r for r in results if r['outcome'].get('status') in {'CRASH', 'TIMEOUT', 'MEMORY_LIMIT', 'SANDBOX_ESCAPE'}]
    return {'schema': 'axm.translation.fuzz-result-classification/v1', 'verdict': 'FAIL' if dangerous else 'PASS', 'results': results, 'dangerous_count': len(dangerous)}
