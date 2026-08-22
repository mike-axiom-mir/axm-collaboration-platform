
from __future__ import annotations
import json
import tempfile
from pathlib import Path
from typing import Any
from .controls import ControlState, authorize_resume, can_act, resume, revoke, stop
from .ledger import append_event, read_entries, verify_entries, verify_file
from .projection import human_projection
from .recovery import corrupt_copy, recover
from .registry import by_module_id, harness_root, load_registry
from .scenarios import run_scenarios
from .selector import select_tests
from .validator import validate_fixture


def load_fixture(kind: str, proof_slice_id: str) -> dict[str, Any]:
    path = harness_root() / 'fixtures' / kind / f'{proof_slice_id}.json'
    return json.loads(path.read_text(encoding='utf-8'))


def run_all() -> dict[str, Any]:
    registry = load_registry()
    entries = by_module_id(registry)
    counts = {
        'registry_entries': len(entries),
        'valid_fixtures_accepted': 0,
        'mutated_fixtures_rejected': 0,
        'expected_error_sets_observed': 0,
        'clean_ledgers_verified': 0,
        'corruption_cases_detected': 0,
        'stop_controls_denied': 0,
        'revoke_controls_denied': 0,
        'expiry_controls_denied': 0,
        'authorized_resumes_allowed': 0,
        'human_projections_sanitized': 0,
    }
    per_seed = []
    with tempfile.TemporaryDirectory(prefix='axm-team-harness-') as tmp:
        tmpdir = Path(tmp)
        for entry in registry['entries']:
            valid = load_fixture('valid', entry['proof_slice_id'])
            mutated = load_fixture('mutated', entry['proof_slice_id'])
            vr = validate_fixture(valid, entry)
            mr = validate_fixture(mutated, entry)
            counts['valid_fixtures_accepted'] += int(vr.ok)
            counts['mutated_fixtures_rejected'] += int(not mr.ok)
            expected = set(mutated['expected_validation']['error_codes'])
            counts['expected_error_sets_observed'] += int(expected.issubset(set(mr.error_codes)))

            ledger_path = tmpdir / f'{entry["seed_number"]:03d}.jsonl'
            append_event(ledger_path, {'module_id': entry['module_id'], 'event_type': 'FIXTURE_VALIDATED', 'new_state': 'VALIDATED'})
            append_event(ledger_path, {'module_id': entry['module_id'], 'event_type': 'MUTATION_REJECTED', 'new_state': 'HELD'})
            ok, _ = verify_file(ledger_path)
            counts['clean_ledgers_verified'] += int(ok and recover(ledger_path)['known_state'] == 'HELD')
            entries_copy = read_entries(ledger_path)
            corrupted = corrupt_copy(entries_copy)
            corrupt_ok, _ = verify_entries(corrupted)
            counts['corruption_cases_detected'] += int(not corrupt_ok)

            base_control = ControlState()
            stopped = stop(base_control, 'human stop test')
            counts['stop_controls_denied'] += int(can_act(stopped)[0] is False)
            resumed = resume(authorize_resume(stopped, f'resume-{entry["seed_number"]:03d}'))
            counts['authorized_resumes_allowed'] += int(can_act(resumed)[0] is True)
            revoked_state = revoke(base_control, 'human revoke test')
            counts['revoke_controls_denied'] += int(can_act(revoked_state)[0] is False)
            expired_state = ControlState(expires_at='2000-01-01T00:00:00Z')
            counts['expiry_controls_denied'] += int(can_act(expired_state)[0] is False)

            projection = human_projection(mutated, mr.to_dict())
            projection_text = json.dumps(projection, ensure_ascii=False)
            sanitized = all(term not in projection_text for term in ['not-a-real-token', 'private prompt', 'must never appear'])
            counts['human_projections_sanitized'] += int(sanitized)

            per_seed.append({
                'seed_number': entry['seed_number'],
                'module_id': entry['module_id'],
                'proof_slice_id': entry['proof_slice_id'],
                'valid_ok': vr.ok,
                'mutated_rejected': not mr.ok,
                'expected_errors_observed': expected.issubset(set(mr.error_codes)),
                'ledger_verified': ok,
                'corruption_detected': not corrupt_ok,
                'stop_denied': can_act(stopped)[0] is False,
                'revoke_denied': can_act(revoked_state)[0] is False,
                'expiry_denied': can_act(expired_state)[0] is False,
                'authorized_resume_allowed': can_act(resumed)[0] is True,
                'projection_sanitized': sanitized,
            })

    scenarios = run_scenarios()
    sparse = select_tests(registry['entries'], ['axm.team.task-intent-packet'])
    root = select_tests(registry['entries'], ['axm.team.bounded-collaboration-orchestrator'])
    all_expected_100 = all(value == 100 for key, value in counts.items() if key != 'registry_entries') and counts['registry_entries'] == 100
    return {
        'harness_version': '0.1.0',
        'evidence_scope': 'DETERMINISTIC_HARNESS_ONLY_NOT_AXM_RUNTIME',
        'counts': counts,
        'scenario_suite': scenarios,
        'selector_examples': {'sparse': sparse, 'root': root},
        'per_seed': per_seed,
        'passed': all_expected_100 and scenarios['passed'] and sparse['selected_count'] < 100 and root['selected_count'] == 100,
    }


if __name__ == '__main__':
    print(json.dumps(run_all(), ensure_ascii=False, indent=2))
