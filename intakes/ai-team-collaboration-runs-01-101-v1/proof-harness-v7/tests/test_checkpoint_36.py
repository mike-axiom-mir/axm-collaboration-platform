from __future__ import annotations
import json
import tempfile
import unittest
from pathlib import Path

from axm_team_harness.ledger import append_event, verify_file
from axm_team_harness.registry import by_module_id, load_registry
from axm_team_harness.runner import load_fixture
from axm_team_harness.selector import select_tests
from axm_team_harness.validator import validate_fixture

class Checkpoint36Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry=load_registry()
        cls.by_id=by_module_id(cls.registry)

    def test_registry_and_fixture_corpus(self):
        self.assertEqual(len(self.registry['entries']),100)
        for entry in self.registry['entries']:
            valid=load_fixture('valid',entry['proof_slice_id'])
            mutated=load_fixture('mutated',entry['proof_slice_id'])
            self.assertTrue(validate_fixture(valid,entry).ok)
            result=validate_fixture(mutated,entry)
            self.assertFalse(result.ok)
            self.assertTrue(set(mutated['expected_validation']['error_codes']).issubset(set(result.error_codes)))

    def test_hash_receipts(self):
        with tempfile.TemporaryDirectory() as tmp:
            for entry in self.registry['entries']:
                p=Path(tmp)/f"{entry['seed_number']:03d}.jsonl"
                append_event(p,{'event_type':'VALIDATED','new_state':'VALIDATED'})
                append_event(p,{'event_type':'REJECTED','new_state':'HELD'})
                self.assertEqual(verify_file(p),(True,None))

    def test_sparse_and_root_selection(self):
        sparse=select_tests(self.registry['entries'],['axm.team.task-intent-packet'])
        root=select_tests(self.registry['entries'],['axm.team.bounded-collaboration-orchestrator'])
        self.assertLess(sparse['selected_count'],100)
        self.assertEqual(root['selected_count'],100)

if __name__=='__main__':
    unittest.main()
