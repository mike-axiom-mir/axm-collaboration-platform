from __future__ import annotations
import unittest
from axm_translation_core import build_decision_trace,validate_decision_trace,explain_decision_trace
class Run48ExplainabilityTests(unittest.TestCase):
    def trace(self): return build_decision_trace(decision='HOLD',factors=[{'name':'compatibility','effect':'block','value':False,'reason':'API removed'}],evidence_refs=['z','a','a'],limitations=['Static evidence only'],human_review_required=True)
    def test_trace_schema(self): self.assertEqual(self.trace()['schema'],'axm.translation.decision-trace/v1')
    def test_sorted_refs(self): self.assertEqual(self.trace()['evidence_refs'],['a','z'])
    def test_validation_pass(self): self.assertEqual(validate_decision_trace(self.trace())['verdict'],'PASS')
    def test_missing_reason_fails(self): self.assertEqual(validate_decision_trace(build_decision_trace(decision='HOLD',factors=[{'name':'x'}]))['verdict'],'INCOMPLETE')
    def test_plain_decision(self): self.assertIn('Decision: HOLD',explain_decision_trace(self.trace()))
    def test_factor_reason_visible(self): self.assertIn('API removed',explain_decision_trace(self.trace()))
    def test_limit_visible(self): self.assertIn('Static evidence only',explain_decision_trace(self.trace()))
    def test_human_review_visible(self): self.assertIn('Human review is required',explain_decision_trace(self.trace()))
    def test_no_action_message(self): self.assertIn('No automatic action',explain_decision_trace(build_decision_trace(decision='PASS',factors=[])))
    def test_not_executed(self): self.assertFalse(self.trace()['executed'])
if __name__=='__main__': unittest.main()
