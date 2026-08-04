import unittest
from axm_translation_core import build_capability_composition_plan,verify_composition_plan,compare_composition_plans
MODULES=[{'id':'fingerprint','provides':['fingerprint'],'dependencies':[],'authority_mode':'inspect_only','status':'LOCAL_PROTOTYPE','loss_score':0,'risk_score':.1,'reuse_score':1},{'id':'map','provides':['mapping'],'dependencies':['fingerprint'],'authority_mode':'inspect_only','status':'LOCAL_PROTOTYPE','loss_score':.1,'risk_score':.2,'reuse_score':.8},{'id':'shadow','provides':['native'],'dependencies':[],'authority_mode':'shadow_only','status':'CONTRACT_ONLY','loss_score':0,'risk_score':1,'reuse_score':.2}]
class CompositionTests(unittest.TestCase):
    def plan(self): return build_capability_composition_plan({'required_capabilities':['mapping'],'forbidden_authorities':['shadow_only'],'max_loss_score':.5},MODULES)
    def test_selects_provider(self): self.assertIn('map',self.plan()['selected_modules'])
    def test_closes_dependency(self): self.assertIn('fingerprint',self.plan()['selected_modules'])
    def test_topological_order(self): self.assertLess(self.plan()['ordered_modules'].index('fingerprint'),self.plan()['ordered_modules'].index('map'))
    def test_verifies(self): self.assertTrue(verify_composition_plan(self.plan())['valid'])
    def test_missing_holds(self): self.assertEqual(build_capability_composition_plan({'required_capabilities':['x']},MODULES)['decision'],'HOLD')
    def test_shadow_holds_capability(self): self.assertIn('native',build_capability_composition_plan({'required_capabilities':['native']},MODULES)['missing_capabilities'])
    def test_cycle_holds(self):
        m=[{'id':'a','provides':['x'],'dependencies':['b'],'authority_mode':'inspect_only','status':'LOCAL_PROTOTYPE'},{'id':'b','provides':[],'dependencies':['a'],'authority_mode':'inspect_only','status':'LOCAL_PROTOTYPE'}]; self.assertIn('dependency_cycle',build_capability_composition_plan({'required_capabilities':['x']},m)['holds'])
    def test_tamper_detected(self):
        p=self.plan(); p['selected_modules']=[]; self.assertFalse(verify_composition_plan(p)['valid'])
    def test_compare_visible(self): self.assertIn('map',compare_composition_plans(build_capability_composition_plan({'required_capabilities':['fingerprint']},MODULES),self.plan())['added'])
if __name__=='__main__': unittest.main()
