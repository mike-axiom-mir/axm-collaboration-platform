
from __future__ import annotations
import json
import tempfile
import unittest
from pathlib import Path

from axm_team_harness.controls import ControlState, authorize_resume, can_act, resume, revoke, stop
from axm_team_harness.ledger import append_event, read_entries, verify_entries, verify_file
from axm_team_harness.projection import human_projection
from axm_team_harness.recovery import corrupt_copy, recover
from axm_team_harness.registry import by_module_id, harness_root, load_registry
from axm_team_harness.runner import load_fixture, run_all
from axm_team_harness.scenarios import run_scenarios
from axm_team_harness.selector import select_tests
from axm_team_harness.validator import validate_fixture


class HarnessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = load_registry()
        cls.entries = by_module_id(cls.registry)

    def test_01_registry_exactly_100(self):
        self.assertEqual(len(self.registry['entries']), 100)
        self.assertEqual(len(self.entries), 100)

    def test_02_valid_fixtures_pass(self):
        for entry in self.registry['entries']:
            with self.subTest(module_id=entry['module_id']):
                fixture = load_fixture('valid', entry['proof_slice_id'])
                self.assertTrue(validate_fixture(fixture, entry).ok)

    def test_03_mutations_fail_with_expected_codes(self):
        for entry in self.registry['entries']:
            with self.subTest(module_id=entry['module_id']):
                fixture = load_fixture('mutated', entry['proof_slice_id'])
                result = validate_fixture(fixture, entry)
                self.assertFalse(result.ok)
                self.assertTrue(set(fixture['expected_validation']['error_codes']).issubset(set(result.error_codes)))

    def test_04_hash_chain_and_replay(self):
        with tempfile.TemporaryDirectory() as tmp:
            for entry in self.registry['entries']:
                path = Path(tmp) / f'{entry["seed_number"]:03d}.jsonl'
                append_event(path, {'event_type': 'VALID', 'new_state': 'VALIDATED'})
                append_event(path, {'event_type': 'REJECT', 'new_state': 'HELD'})
                self.assertEqual(verify_file(path), (True, None))
                self.assertEqual(recover(path)['known_state'], 'HELD')

    def test_05_corruption_is_detected(self):
        with tempfile.TemporaryDirectory() as tmp:
            for entry in self.registry['entries']:
                path = Path(tmp) / f'{entry["seed_number"]:03d}.jsonl'
                append_event(path, {'event_type': 'VALID', 'new_state': 'VALIDATED'})
                entries = corrupt_copy(read_entries(path))
                self.assertFalse(verify_entries(entries)[0])

    def test_06_stop_revoke_expiry_resume(self):
        for _entry in self.registry['entries']:
            base = ControlState()
            stopped = stop(base, 'test')
            self.assertFalse(can_act(stopped)[0])
            resumed = resume(authorize_resume(stopped, 'human-receipt'))
            self.assertTrue(can_act(resumed)[0])
            self.assertFalse(can_act(revoke(base, 'test'))[0])
            self.assertFalse(can_act(ControlState(expires_at='2000-01-01T00:00:00Z'))[0])

    def test_07_projection_redacts_private_material(self):
        for entry in self.registry['entries']:
            fixture = load_fixture('mutated', entry['proof_slice_id'])
            result = validate_fixture(fixture, entry).to_dict()
            text = json.dumps(human_projection(fixture, result), ensure_ascii=False)
            self.assertNotIn('not-a-real-token', text)
            self.assertNotIn('private prompt', text)
            self.assertNotIn('must never appear', text)

    def test_08_scenarios(self):
        result = run_scenarios()
        self.assertEqual(result['scenario_count'], 10)
        self.assertTrue(result['passed'])

    def test_09_selector_sparse_and_root(self):
        sparse = select_tests(self.registry['entries'], ['axm.team.task-intent-packet'])
        root = select_tests(self.registry['entries'], ['axm.team.bounded-collaboration-orchestrator'])
        self.assertLess(sparse['selected_count'], 100)
        self.assertEqual(root['selected_count'], 100)

    def test_10_full_runner(self):
        result = run_all()
        self.assertTrue(result['passed'])
        for key, value in result['counts'].items():
            self.assertEqual(value, 100, key)


if __name__ == '__main__':
    unittest.main()
