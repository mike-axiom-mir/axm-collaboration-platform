import unittest
from axm_translation_core import evaluate_partial_availability,build_partial_availability_plan,verify_partial_availability_plan
P=[{'provider_id':'p1','capabilities':['read','write'],'state':'UP'},{'provider_id':'p2','capabilities':['read'],'state':'DOWN'},{'provider_id':'p3','capabilities':['render'],'state':'DEGRADED'}]
class AvailabilityTests(unittest.TestCase):
    def report(self): return evaluate_partial_availability(['read','render','export'],P)
    def test_missing(self): self.assertEqual(self.report()['missing'],['export'])
    def test_degraded(self): self.assertEqual(self.report()['degraded'],['render'])
    def test_fragile(self): self.assertIn('read',self.report()['fragile'])
    def test_hold_default(self): self.assertEqual(build_partial_availability_plan(self.report())['decision'],'HOLD')
    def test_reviewable_with_explicit_allowances(self): self.assertEqual(build_partial_availability_plan(self.report(),True,['export'])['decision'],'REVIEWABLE')
    def test_verify(self):
        p=build_partial_availability_plan(self.report(),True,['export']); self.assertEqual(verify_partial_availability_plan(self.report(),p)['verdict'],'PASS')
    def test_no_failover(self): self.assertFalse(self.report()['automatic_failover'])
    def test_bounded(self):
        with self.assertRaises(ValueError): evaluate_partial_availability([], [{}]*513)
if __name__=='__main__': unittest.main()
