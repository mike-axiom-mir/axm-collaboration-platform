from __future__ import annotations
import unittest

from tools.module_loader import load_implementation


class VerificationModuleTests(unittest.TestCase):
    def test_086_reviewed_fixture_passes(self):
        mod = load_implementation(86)
        report = mod.run(lambda x: x * 2, [{'name': 'double', 'kind': 'valid', 'reviewed': True, 'args': [2], 'expect': {'equals': 4}}])
        self.assertEqual(report['verdict'], 'PASS')

    def test_086_exception_fixture(self):
        mod = load_implementation(86)
        def fail(): raise ValueError('bad')
        report = mod.run(fail, [{'name': 'invalid', 'kind': 'invalid', 'reviewed': True, 'expect': {'exception': 'ValueError'}}])
        self.assertEqual(report['verdict'], 'PASS')

    def test_086_unreviewed_fixture_fails(self):
        mod = load_implementation(86)
        report = mod.run(lambda: 1, [{'name': 'draft', 'expect': {'equals': 1}}])
        self.assertEqual(report['results'][0]['status'], 'UNREVIEWED')

    def test_086_detects_input_mutation(self):
        mod = load_implementation(86)
        def mutate(value): value.append(2); return value
        report = mod.run(mutate, [{'name': 'mutation', 'reviewed': True, 'args': [[1]], 'expect': {'equals': [1, 2]}}])
        self.assertFalse(report['results'][0]['passed'])
        self.assertTrue(report['results'][0]['input_mutated'])

    def test_087_agreement(self):
        mod = load_implementation(87)
        report = mod.run({'a': lambda x: x * 2, 'b': lambda x: x + x}, [{'name': 'two', 'args': [2]}])
        self.assertEqual(report['verdict'], 'PASS')

    def test_087_disagreement(self):
        mod = load_implementation(87)
        report = mod.run({'a': lambda x: x * 2, 'b': lambda x: x + 1}, [{'name': 'two', 'args': [2]}])
        self.assertEqual(report['verdict'], 'FAIL')
        self.assertEqual(report['disagreement_count'], 1)

    def test_087_exception_agreement(self):
        mod = load_implementation(87)
        def a(): raise ValueError('same')
        def b(): raise ValueError('same')
        report = mod.run({'a': a, 'b': b}, [{'name': 'bad'}])
        self.assertEqual(report['verdict'], 'PASS')

    def test_088_is_deterministic(self):
        mod = load_implementation(88)
        a = mod.run({'x': 1}, seed=7)
        b = mod.run({'x': 1}, seed=7)
        self.assertEqual(a['cases'], b['cases'])

    def test_088_respects_case_limit(self):
        mod = load_implementation(88)
        report = mod.run({'x': 1}, max_cases=5)
        self.assertEqual(report['case_count'], 5)
        self.assertFalse(report['execution_performed'])

    def test_088_contains_duplicate_key_raw_case(self):
        mod = load_implementation(88)
        report = mod.run({'x': 1}, max_cases=32)
        self.assertTrue(any(c['category'] == 'duplicate_key' for c in report['cases']))

    def test_088_external_outcome_classification(self):
        mod = load_implementation(88)
        corpus = mod.run({'x': 1}, max_cases=2)
        outcomes = [{'name': corpus['cases'][0]['name'], 'status': 'CRASH'}]
        report = mod.classify_results(corpus, outcomes)
        self.assertEqual(report['verdict'], 'FAIL')

    def test_089_exact_structure_partial_without_other_evidence(self):
        mod = load_implementation(89)
        report = mod.run({'x': 1}, {'x': 1})
        self.assertEqual(report['verdict'], 'PARTIAL')
        structure = next(r for r in report['results'] if r['dimension'] == 'structure')
        self.assertEqual(structure['status'], 'PASS')

    def test_089_structure_failure(self):
        mod = load_implementation(89)
        report = mod.run({'x': 1}, {'x': 2})
        self.assertEqual(report['verdict'], 'FAIL')

    def test_089_authority_failure_is_blocking(self):
        mod = load_implementation(89)
        report = mod.run({'x': 1}, {'x': 1}, source_authority={'mode': 'read'}, target_authority={'mode': 'write'})
        self.assertEqual(report['verdict'], 'FAIL')
        self.assertTrue(report['loss']['summary']['has_blocking_loss'])

    def test_089_full_evidence_passes(self):
        mod = load_implementation(89)
        report = mod.run(
            {'x': 1}, {'x': 1}, source_bytes='same', roundtrip_bytes='same',
            source_meaning='same', target_meaning='same',
            source_appearance_hash='h', target_appearance_hash='h',
            source_timing=[0, 1], target_timing=[0, 1],
            source_behavior={'ok': True}, target_behavior={'ok': True},
            source_authority={'mode': 'read'}, target_authority={'mode': 'read'},
        )
        self.assertEqual(report['verdict'], 'PASS')


if __name__ == '__main__':
    unittest.main()
