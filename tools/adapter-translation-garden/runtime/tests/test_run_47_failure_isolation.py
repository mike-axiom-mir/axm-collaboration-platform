from __future__ import annotations
import unittest
from axm_translation_core import normalize_failure,build_retry_plan,isolation_decision,aggregate_failures
class Run47FailureTests(unittest.TestCase):
    def failure(self,kind='validation',recoverable=False): return normalize_failure(module_id='m',stage='inspect',kind=kind,code='E1',message='x',recoverable=recoverable,evidence_refs=['b','a','a'])
    def test_normalized(self): self.assertEqual(self.failure()['kind'],'validation')
    def test_unknown_kind(self): self.assertEqual(self.failure('weird')['kind'],'unknown')
    def test_refs_deduplicated(self): self.assertEqual(self.failure()['evidence_refs'],['a','b'])
    def test_message_bounded(self): self.assertEqual(len(normalize_failure(module_id='m',stage='s',kind='unknown',code='e',message='x'*2000)['message']),1000)
    def test_integrity_quarantine(self): self.assertEqual(isolation_decision(self.failure('integrity'))['verdict'],'QUARANTINE')
    def test_permission_quarantine(self): self.assertEqual(isolation_decision(self.failure('permission'))['verdict'],'QUARANTINE')
    def test_recoverable_plan_only(self): self.assertEqual(isolation_decision(self.failure('resource',True),allow_retry_kinds=['resource'])['verdict'],'RETRY_PLAN_ONLY')
    def test_no_automatic_retry(self): self.assertFalse(isolation_decision(self.failure())['automatic_retry'])
    def test_retry_plan_bounded(self): self.assertEqual(build_retry_plan(self.failure('resource',True),max_attempts=99,base_delay_ms=1)['attempts'],10)
    def test_nonrecoverable_no_retry(self): self.assertEqual(build_retry_plan(self.failure(),max_attempts=3)['verdict'],'NO_RETRY')
    def test_aggregate_quarantine(self): self.assertEqual(aggregate_failures([self.failure('integrity')])['verdict'],'QUARANTINE')
    def test_empty_pass(self): self.assertEqual(aggregate_failures([])['verdict'],'PASS')
    def test_never_executes(self): self.assertFalse(build_retry_plan(self.failure('resource',True),max_attempts=1)['executed'])
if __name__=='__main__': unittest.main()
