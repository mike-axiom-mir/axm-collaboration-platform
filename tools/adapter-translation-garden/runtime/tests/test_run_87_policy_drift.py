import unittest
from axm_translation_core import compare_policy_snapshots,policy_drift_gate,build_policy_transition_plan
class PolicyDriftTests(unittest.TestCase):
    def report(self): return compare_policy_snapshots({'allow_network':False,'max_loss':1,'allowed_providers':['a']},{'allow_network':True,'max_loss':2,'allowed_providers':['a','b']})
    def test_three_changes(self): self.assertEqual(len(self.report()['changes']),3)
    def test_loosening(self): self.assertEqual(len(self.report()['loosening_change_ids']),3)
    def test_unapproved_holds(self): self.assertEqual(policy_drift_gate(self.report())['verdict'],'HOLD')
    def test_approved_reviewable(self):
        r=self.report(); ids=[c['change_id'] for c in r['changes']]; self.assertEqual(policy_drift_gate(r,ids)['decision'],'REVIEWABLE_TRANSITION')
    def test_no_drift(self): self.assertEqual(policy_drift_gate(compare_policy_snapshots({'a':1},{'a':1}))['decision'],'PASS_NO_DRIFT')
    def test_plan_not_executed(self): self.assertFalse(build_policy_transition_plan(self.report())['executed'])
    def test_rollback_hash(self): self.assertEqual(len(build_policy_transition_plan(self.report())['rollback_policy_sha256']),64)
    def test_no_auto_activation(self): self.assertFalse(self.report()['automatic_activation'])
if __name__=='__main__': unittest.main()
