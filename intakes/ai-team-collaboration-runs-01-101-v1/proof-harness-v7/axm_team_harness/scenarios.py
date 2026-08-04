
from __future__ import annotations
import json
from pathlib import Path
from typing import Any
from .registry import by_module_id, load_registry, harness_root
from .validator import validate_fixture


def load_scenarios(path: Path | None = None) -> list[dict[str, Any]]:
    root = path or harness_root() / 'scenarios'
    return [json.loads(p.read_text(encoding='utf-8')) for p in sorted(root.glob('*.json'))]


def run_scenarios() -> dict[str, Any]:
    registry = load_registry()
    entries = by_module_id(registry)
    outcomes = []
    for scenario in load_scenarios():
        fixture_path = harness_root() / scenario['fixture_file']
        fixture = json.loads(fixture_path.read_text(encoding='utf-8'))
        result = validate_fixture(fixture, entries[fixture['module_id']]).to_dict()
        expected = set(scenario['expected_error_codes'])
        actual = set(result['error_codes'])
        passed = not result['ok'] and expected.issubset(actual)
        outcomes.append({'scenario_id': scenario['scenario_id'], 'module_id': fixture['module_id'], 'passed': passed, 'expected_error_codes': sorted(expected), 'actual_error_codes': sorted(actual)})
    return {'scenario_count': len(outcomes), 'passed': all(o['passed'] for o in outcomes), 'outcomes': outcomes}
