import unittest
from axm_translation_core import build_longevity_checkpoint, verify_longevity_checkpoint, longevity_action_report
class LongevityTests(unittest.TestCase):
    def good(self): return build_longevity_checkpoint({'verdict':'PASS'},{'verdict':'PASS'},{'verdict':'PASS'},[])
    def test_good_passes(self): self.assertEqual(self.good()['verdict'],'PASS')
    def test_source_hold_propagates(self): self.assertIn('source_drift',build_longevity_checkpoint({'verdict':'HOLD'},{'verdict':'PASS'},{'verdict':'PASS'},[])['holds'])
    def test_freshness_hold_propagates(self): self.assertIn('evidence_freshness',build_longevity_checkpoint({'verdict':'PASS'},{'verdict':'PASS'},{'verdict':'HOLD'},[])['holds'])
    def test_blocked_sunset_propagates(self):
        c=build_longevity_checkpoint({'verdict':'PASS'},{'verdict':'PASS'},{'verdict':'PASS'},[{'module_id':'m','phase':'SUNSET_REACHED','removal_readiness':'HOLD'}]); self.assertIn('sunset_blocked',c['holds'])
    def test_checkpoint_verifies(self): self.assertTrue(verify_longevity_checkpoint(self.good())['valid'])
    def test_tamper_detected(self):
        c=self.good(); c['holds']=['x']; self.assertFalse(verify_longevity_checkpoint(c)['valid'])
    def test_report_states_no_action(self): self.assertIn('No merge',longevity_action_report(self.good()))
if __name__=='__main__': unittest.main()
