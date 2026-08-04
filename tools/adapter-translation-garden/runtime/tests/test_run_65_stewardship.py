import unittest
from axm_translation_core import build_stewardship_decision, verify_stewardship_decision, stewardship_action_report
class StewardshipTests(unittest.TestCase):
    def good(self): return build_stewardship_decision({'verdict':'PASS'},{'decision':'ALLOW_MANUAL_MERGE_REVIEW'},{'decision':'REVIEWABLE'},{'decision':'READY_FOR_HUMAN_RECOVERY_REVIEW'},{'verified_packs':90,'expected_packs':90,'failed_packs':[]})
    def test_good_ready(self): self.assertEqual(self.good()['decision'],'READY_FOR_SELECTIVE_HUMAN_REVIEW')
    def test_longevity_hold(self): self.assertIn('longevity',build_stewardship_decision({'verdict':'HOLD'},{'decision':'ALLOW_MANUAL_MERGE_REVIEW'},{'decision':'REVIEWABLE'},{'decision':'READY_FOR_HUMAN_RECOVERY_REVIEW'},{'verified_packs':90,'expected_packs':90,'failed_packs':[]})['holds'])
    def test_merge_hold(self): self.assertIn('merge_gate',build_stewardship_decision({'verdict':'PASS'},{'decision':'HOLD'},{'decision':'REVIEWABLE'},{'decision':'READY_FOR_HUMAN_RECOVERY_REVIEW'},{'verified_packs':90,'expected_packs':90,'failed_packs':[]})['holds'])
    def test_fixture_hold(self): self.assertIn('fixture_adequacy',build_stewardship_decision({'verdict':'PASS'},{'decision':'ALLOW_MANUAL_MERGE_REVIEW'},{'decision':'HOLD'},{'decision':'READY_FOR_HUMAN_RECOVERY_REVIEW'},{'verified_packs':90,'expected_packs':90,'failed_packs':[]})['holds'])
    def test_recovery_hold(self): self.assertIn('recovery',build_stewardship_decision({'verdict':'PASS'},{'decision':'ALLOW_MANUAL_MERGE_REVIEW'},{'decision':'REVIEWABLE'},{'decision':'HOLD'},{'verified_packs':90,'expected_packs':90,'failed_packs':[]})['holds'])
    def test_pack_failure_holds(self): self.assertIn('pack_recovery',build_stewardship_decision({'verdict':'PASS'},{'decision':'ALLOW_MANUAL_MERGE_REVIEW'},{'decision':'REVIEWABLE'},{'decision':'READY_FOR_HUMAN_RECOVERY_REVIEW'},{'verified_packs':89,'expected_packs':90,'failed_packs':['x']})['holds'])
    def test_decision_verifies(self): self.assertTrue(verify_stewardship_decision(self.good())['valid'])
    def test_tamper_detected(self):
        d=self.good(); d['holds']=['x']; self.assertFalse(verify_stewardship_decision(d)['valid'])
    def test_report_states_no_actions(self): self.assertIn('Nothing was installed',stewardship_action_report(self.good()))
if __name__=='__main__': unittest.main()
