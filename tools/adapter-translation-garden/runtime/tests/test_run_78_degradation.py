import copy,unittest
from axm_translation_core import build_degradation_ladder,select_degradation_step,verify_degradation_ladder
REPS=[{'id':'high','quality':1,'cost':10,'latency_ms':10,'privacy_classification':'internal','proof_level':3},{'id':'mid','quality':.8,'cost':5,'latency_ms':7,'privacy_classification':'internal','proof_level':2,'losses':['detail']},{'id':'low','quality':.5,'cost':2,'latency_ms':4,'privacy_classification':'public','proof_level':1,'losses':['detail','precision']}]
class DegradationTests(unittest.TestCase):
    def test_ladder(self): self.assertEqual(build_degradation_ladder(REPS)['decision'],'REVIEWABLE_LADDER')
    def test_verify(self): self.assertEqual(verify_degradation_ladder(build_degradation_ladder(REPS))['verdict'],'PASS')
    def test_select_high(self): self.assertEqual(select_degradation_step(build_degradation_ladder(REPS),{'max_cost':20,'minimum_quality':.9})['selected']['id'],'high')
    def test_select_mid(self): self.assertEqual(select_degradation_step(build_degradation_ladder(REPS),{'max_cost':6,'minimum_quality':.7})['selected']['id'],'mid')
    def test_disclosure(self): self.assertTrue(select_degradation_step(build_degradation_ladder(REPS),{'max_cost':6,'minimum_quality':.7})['degradation_disclosed'])
    def test_refusal(self): self.assertEqual(select_degradation_step(build_degradation_ladder(REPS),{'max_cost':1})['decision'],'REFUSE_NO_SAFE_STEP')
    def test_cost_violation_holds(self):
        bad=[REPS[0],{**REPS[1],'cost':20}]; self.assertEqual(build_degradation_ladder(bad)['decision'],'HOLD')
    def test_tamper(self):
        l=build_degradation_ladder(REPS); l['steps'][0]['cost']=999; self.assertEqual(verify_degradation_ladder(l)['verdict'],'HOLD')
    def test_no_auto(self): self.assertFalse(build_degradation_ladder(REPS)['automatic_fallback'])
if __name__=='__main__': unittest.main()
