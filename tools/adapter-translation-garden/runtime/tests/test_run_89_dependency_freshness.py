import unittest
from axm_translation_core import assess_dependency_freshness,dependency_freshness_gate,build_dependency_refresh_plan
NOW=1000
R=[{'dependency_id':'fresh','observed_at':950,'max_age_seconds':100},{'dependency_id':'stale','observed_at':0,'max_age_seconds':100},{'dependency_id':'future','observed_at':1100},{'dependency_id':'optional','observed_at':0,'max_age_seconds':100,'required':False}]
class FreshnessTests(unittest.TestCase):
    def report(self): return assess_dependency_freshness(R,NOW)
    def test_stale(self): self.assertIn('stale',self.report()['stale'])
    def test_future(self): self.assertIn('future',self.report()['future'])
    def test_hold(self): self.assertEqual(dependency_freshness_gate(self.report())['verdict'],'HOLD')
    def test_optional_allow_not_enough(self): self.assertEqual(dependency_freshness_gate(self.report(),True)['verdict'],'HOLD')
    def test_fresh_pass(self): self.assertEqual(dependency_freshness_gate(assess_dependency_freshness(R[:1],NOW))['verdict'],'PASS')
    def test_refresh_plan_no_network(self): self.assertFalse(build_dependency_refresh_plan(self.report())['network_access'])
    def test_no_auto_refresh(self): self.assertFalse(self.report()['automatic_refresh'])
    def test_unknown(self): self.assertIn('',assess_dependency_freshness([{}],NOW)['unknown'])
if __name__=='__main__': unittest.main()
