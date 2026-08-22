import unittest
from axm_translation_core import optimize_intake_batch,verify_intake_batch,explain_intake_batch
C=[{'id':'a','status':'LOCAL_PROTOTYPE','authority_mode':'inspect_only','value_score':1,'reuse_score':1,'complexity':1,'risk':.2,'dependencies':[]},{'id':'b','status':'LOCAL_PROTOTYPE','authority_mode':'inspect_only','value_score':.9,'reuse_score':.8,'complexity':1,'risk':.2,'dependencies':['a']},{'id':'s','status':'CONTRACT_ONLY','authority_mode':'shadow_only','value_score':1,'reuse_score':1,'complexity':.1,'risk':.1,'dependencies':[]}]
class IntakeOptimizerTests(unittest.TestCase):
    def test_selects_reviewable(self): self.assertIn('a',optimize_intake_batch(C,max_modules=2,max_complexity=3,max_risk=1)['selected_modules'])
    def test_closes_dependency(self):
        p=optimize_intake_batch(C,max_modules=2,max_complexity=3,max_risk=1,mandatory=['b']); self.assertIn('a',p['selected_modules'])
    def test_excludes_shadow(self): self.assertNotIn('s',optimize_intake_batch(C,max_modules=3,max_complexity=3,max_risk=1)['selected_modules'])
    def test_respects_module_limit(self): self.assertLessEqual(optimize_intake_batch(C,max_modules=1,max_complexity=3,max_risk=1)['module_count'],1)
    def test_missing_mandatory_holds(self): self.assertEqual(optimize_intake_batch(C,mandatory=['x'])['decision'],'HOLD')
    def test_verifies(self):
        p=optimize_intake_batch(C,max_modules=2,max_complexity=3,max_risk=1); self.assertTrue(verify_intake_batch(p,C)['valid'])
    def test_tamper_dependency_detected(self):
        p=optimize_intake_batch(C,max_modules=2,max_complexity=3,max_risk=1,mandatory=['b']); p['selected_modules']=['b']; p['module_count']=1; self.assertEqual(verify_intake_batch(p,C)['verdict'],'HOLD')
    def test_no_install(self): self.assertFalse(optimize_intake_batch(C)['automatic_install'])
    def test_explanation_boundary(self): self.assertIn('No modules were installed',explain_intake_batch(optimize_intake_batch(C,max_modules=2,max_complexity=3,max_risk=1)))
    def test_budget_rejection_visible(self): self.assertTrue(optimize_intake_batch(C,max_modules=0,max_complexity=0,max_risk=0)['rejected'])
if __name__=='__main__': unittest.main()
