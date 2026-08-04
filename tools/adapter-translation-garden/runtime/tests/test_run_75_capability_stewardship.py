import unittest
from axm_translation_core import build_capability_stewardship_decision,verify_capability_stewardship_decision,capability_stewardship_action_report
class CapabilityStewardshipTests(unittest.TestCase):
    def good(self,gaps=None): return build_capability_stewardship_decision({'decision':'READY_FOR_BOUNDED_CAPABILITY_REVIEW'},{'decision':'REVIEWABLE'},{'uncovered':gaps or []},{'verdict':'PASS'},{'verdict':'PASS'},{'verified_packs':90,'expected_packs':90,'failed_packs':[]})
    def test_ready(self): self.assertEqual(self.good()['decision'],'READY_FOR_SELECTIVE_CAPABILITY_INTAKE_REVIEW')
    def test_visible_gap_review(self): self.assertEqual(self.good(['x'])['decision'],'REVIEW_WITH_VISIBLE_GAPS')
    def test_checkpoint_hold(self): self.assertIn('capability_checkpoint',build_capability_stewardship_decision({'decision':'HOLD'},{'decision':'REVIEWABLE'},{'uncovered':[]},{'verdict':'PASS'},{'verdict':'PASS'},{'verified_packs':90,'expected_packs':90,'failed_packs':[]})['holds'])
    def test_metamorphic_hold(self): self.assertIn('metamorphic',build_capability_stewardship_decision({'decision':'READY_FOR_BOUNDED_CAPABILITY_REVIEW'},{'decision':'HOLD'},{'uncovered':[]},{'verdict':'PASS'},{'verdict':'PASS'},{'verified_packs':90,'expected_packs':90,'failed_packs':[]})['holds'])
    def test_pack_hold(self): self.assertIn('selective_packs',build_capability_stewardship_decision({'decision':'READY_FOR_BOUNDED_CAPABILITY_REVIEW'},{'decision':'REVIEWABLE'},{'uncovered':[]},{'verdict':'PASS'},{'verdict':'PASS'},{'verified_packs':89,'expected_packs':90,'failed_packs':['x']})['holds'])
    def test_verifies(self): self.assertTrue(verify_capability_stewardship_decision(self.good())['valid'])
    def test_tamper_detected(self):
        d=self.good(); d['holds']=['x']; self.assertFalse(verify_capability_stewardship_decision(d)['valid'])
    def test_no_automatic_authority(self): self.assertFalse(self.good()['automatic_install'])
    def test_report_boundary(self): self.assertIn('Nothing was executed',capability_stewardship_action_report(self.good()))
if __name__=='__main__': unittest.main()
