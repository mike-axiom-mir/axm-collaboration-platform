from __future__ import annotations
from copy import deepcopy
from typing import Any, Callable


def _read_path(value: Any, path: str) -> Any:
    current = value
    clean = path[2:] if path.startswith('$.') else path
    if not clean:
        return current
    for part in clean.split('.'):
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            raise KeyError(path)
    return current


def _contains(actual: Any, expected: Any) -> bool:
    if isinstance(expected, dict) and isinstance(actual, dict):
        return all(k in actual and _contains(actual[k], v) for k, v in expected.items())
    if isinstance(expected, list) and isinstance(actual, list):
        return all(any(_contains(item, wanted) for item in actual) for wanted in expected)
    return actual == expected


def run(adapter: Callable[..., Any], fixtures: list[dict[str, Any]], *, require_reviewed: bool = True) -> dict[str, Any]:
    results = []
    for index, fixture in enumerate(fixtures):
        name = fixture.get('name', f'fixture-{index}')
        if require_reviewed and fixture.get('reviewed') is not True:
            results.append({'name': name, 'kind': fixture.get('kind', 'unspecified'), 'passed': False, 'status': 'UNREVIEWED', 'reason': 'fixture lacks reviewed=true'})
            continue
        args = deepcopy(fixture.get('args', []))
        kwargs = deepcopy(fixture.get('kwargs', {}))
        before = deepcopy({'args': args, 'kwargs': kwargs})
        expectation = fixture.get('expect', {})
        actual = None
        caught = None
        try:
            actual = adapter(*args, **kwargs)
        except Exception as exc:  # fixture harness must report, not hide
            caught = {'type': type(exc).__name__, 'message': str(exc)}
        mutated = before != {'args': args, 'kwargs': kwargs}
        checks = []
        if 'exception' in expectation:
            checks.append(caught is not None and caught['type'] == expectation['exception'])
        else:
            checks.append(caught is None)
            if caught is None and 'equals' in expectation:
                checks.append(actual == expectation['equals'])
            if caught is None and 'contains' in expectation:
                checks.append(_contains(actual, expectation['contains']))
            if caught is None and 'path_equals' in expectation:
                for path, wanted in expectation['path_equals'].items():
                    try:
                        checks.append(_read_path(actual, path) == wanted)
                    except KeyError:
                        checks.append(False)
        if not expectation:
            checks.append(False)
        passed = all(checks) and not mutated
        results.append({
            'name': name, 'kind': fixture.get('kind', 'unspecified'), 'passed': passed,
            'status': 'PASS' if passed else 'FAIL', 'actual': deepcopy(actual),
            'exception': caught, 'input_mutated': mutated, 'expectation': deepcopy(expectation),
        })
    passed_count = sum(1 for r in results if r['passed'])
    return {
        'schema': 'axm.translation.golden-fixture-report/v1',
        'verdict': 'PASS' if passed_count == len(results) else 'FAIL',
        'results': results, 'passed': passed_count, 'failed': len(results) - passed_count,
        'fixture_count': len(results),
        'limitations': ['Adapters execute in the caller process; isolate untrusted implementations outside this harness.'],
    }
