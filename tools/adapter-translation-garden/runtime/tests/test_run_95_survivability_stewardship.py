import unittest
from axm_translation_core import build_survivability_stewardship_decision,verify_survivability_stewardship_decision,survivability_stewardship_action_report
V={'verdict':'PASS'}; P={'verified_packs':90,'expected_packs':90,'failed_packs':[]}
class StewardshipTests(unittest.TestCase):
    def decision(self): return build_survivability_stewardship_decision(V,V,V,V,V,P)
    def test_ready(self): self.assertEqual(self.decision()['decision'],'READY_FOR_SELECTIVE_SURVIVABILITY_INTAKE_REVIEW')
    def test_verify(self): self.assertEqual(verify_survivability_stewardship_decision(self.decision())['verdict'],'PASS')
    def test_hold(self): self.assertIn('restore',build_survivability_stewardship_decision(V,V,{'verdict':'HOLD'},V,V,P)['holds'])
    def test_pack_hold(self): self.assertIn('selective_packs',build_survivability_stewardship_decision(V,V,V,V,V,{'verified_packs':89,'expected_packs':90,'failed_packs':[1]})['holds'])
    def test_no_restore(self): self.assertFalse(self.decision()['automatic_restore'])
    def test_no_repair(self): self.assertFalse(self.decision()['automatic_repair'])
    def test_no_install(self): self.assertFalse(self.decision()['automatic_install'])
    def test_report(self): self.assertIn('ready',survivability_stewardship_action_report(self.decision()).lower())
    def test_tamper(self):
        d=self.decision(); d['holds']=['x']; self.assertEqual(verify_survivability_stewardship_decision(d)['verdict'],'HOLD')
if __name__=='__main__': unittest.main()
