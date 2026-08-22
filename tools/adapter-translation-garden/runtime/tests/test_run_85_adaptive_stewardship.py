import copy,unittest
from axm_translation_core import build_adaptive_stewardship_decision,verify_adaptive_stewardship_decision,adaptive_stewardship_action_report
PASS={'scenario':{'verdict':'PASS'},'policy':{'verdict':'PASS','bounded':True},'degradation':{'verdict':'PASS'},'interop':{'decision':'REVIEWABLE'},'calibration':{'decision':'REVIEWABLE'},'counterfactual':{'verdict':'PASS'},'mutation':{'decision':'REVIEWABLE'},'admission':{'verdict':'PASS'},'delta':{'verdict':'PASS'},'packs':{'verified_packs':90,'expected_packs':90,'failed_packs':[]}}
class AdaptiveTests(unittest.TestCase):
    def decision(self): return build_adaptive_stewardship_decision(PASS['scenario'],PASS['policy'],PASS['degradation'],PASS['interop'],PASS['calibration'],PASS['counterfactual'],PASS['mutation'],PASS['admission'],PASS['delta'],PASS['packs'])
    def test_ready(self): self.assertEqual(self.decision()['decision'],'READY_FOR_SELECTIVE_ADAPTIVE_INTAKE_REVIEW')
    def test_verify(self): self.assertEqual(verify_adaptive_stewardship_decision(self.decision())['verdict'],'PASS')
    def test_bounded(self): self.assertTrue(verify_adaptive_stewardship_decision(self.decision())['bounded'])
    def test_hold_policy(self):
        p=dict(PASS['policy'],verdict='HOLD'); d=build_adaptive_stewardship_decision(PASS['scenario'],p,PASS['degradation'],PASS['interop'],PASS['calibration'],PASS['counterfactual'],PASS['mutation'],PASS['admission'],PASS['delta'],PASS['packs']); self.assertIn('policy',d['holds'])
    def test_hold_packs(self):
        p={'verified_packs':89,'expected_packs':90,'failed_packs':[1]}; d=build_adaptive_stewardship_decision(PASS['scenario'],PASS['policy'],PASS['degradation'],PASS['interop'],PASS['calibration'],PASS['counterfactual'],PASS['mutation'],PASS['admission'],PASS['delta'],p); self.assertIn('selective_packs',d['holds'])
    def test_tamper(self):
        d=self.decision(); d['holds'].append('x'); self.assertEqual(verify_adaptive_stewardship_decision(d)['verdict'],'HOLD')
    def test_report_ready(self): self.assertIn('ready',adaptive_stewardship_action_report(self.decision()).lower())
    def test_report_hold(self):
        d=self.decision(); d['decision']='HOLD'; d['holds']=['x']; self.assertIn('hold',adaptive_stewardship_action_report(d).lower())
    def test_no_install(self): self.assertFalse(self.decision()['automatic_install'])
    def test_no_dispatch(self): self.assertFalse(self.decision()['automatic_dispatch'])
if __name__=='__main__': unittest.main()
