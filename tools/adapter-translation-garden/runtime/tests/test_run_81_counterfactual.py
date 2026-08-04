import copy,unittest
from axm_translation_core import compare_counterfactual_plans,build_counterfactual_decision,verify_counterfactual_comparison
PLANS=[{'id':'a','loss':.1,'risk':.1,'latency':10,'cost':2,'coverage':.9,'reversibility':1,'proof':3,'authority_mode':'inspect_only'},{'id':'b','loss':.2,'risk':.2,'latency':20,'cost':3,'coverage':.8,'reversibility':.8,'proof':2,'authority_mode':'inspect_only'},{'id':'s','loss':0,'risk':0,'latency':1,'cost':1,'coverage':1,'reversibility':1,'proof':5,'authority_mode':'shadow_only'}]
class CounterfactualTests(unittest.TestCase):
    def comp(self): return compare_counterfactual_plans(PLANS)
    def test_a_frontier(self): self.assertIn('a',self.comp()['frontier_ids'])
    def test_b_dominated(self): self.assertIn('b',[x['id'] for x in self.comp()['dominated']])
    def test_shadow_held(self): self.assertIn('s',[x['id'] for x in self.comp()['held']])
    def test_verifies(self): self.assertEqual(verify_counterfactual_comparison(self.comp())['verdict'],'PASS')
    def test_human_choice(self): self.assertEqual(build_counterfactual_decision(self.comp(),'a')['decision'],'REVIEWABLE_CHOICE')
    def test_bad_choice_holds(self): self.assertEqual(build_counterfactual_decision(self.comp(),'b')['decision'],'HOLD')
    def test_no_auto(self): self.assertFalse(self.comp()['automatic_selection'])
    def test_tamper(self):
        c=copy.deepcopy(self.comp()); c['frontier_ids'].append('x'); self.assertEqual(verify_counterfactual_comparison(c)['verdict'],'HOLD')
    def test_empty_holds(self): self.assertEqual(build_counterfactual_decision(compare_counterfactual_plans([]))['decision'],'HOLD')
if __name__=='__main__': unittest.main()
