import unittest
from axm_translation_core import generate_metamorphic_cases,evaluate_metamorphic_observations,metamorphic_gate
class MetamorphicTests(unittest.TestCase):
    def test_repeat_exists(self): self.assertEqual(generate_metamorphic_cases({'a':1})['cases'][0]['relation'],'exact_repeat')
    def test_key_order_generated(self): self.assertIn('dict_key_order',[x['relation'] for x in generate_metamorphic_cases({'a':1,'b':2})['cases']])
    def test_case_bound(self): self.assertLessEqual(generate_metamorphic_cases({'a':1},max_cases=1)['case_count'],1)
    def test_equal_observation_passes(self):
        c=generate_metamorphic_cases(1); obs={x['case_id']:{'base_output':1,'transformed_output':1} for x in c['cases']}; self.assertEqual(evaluate_metamorphic_observations(c,obs)['verdict'],'PASS')
    def test_difference_fails(self):
        c=generate_metamorphic_cases(1); x=c['cases'][0]; r=evaluate_metamorphic_observations(c,{x['case_id']:{'base_output':1,'transformed_output':2}}); self.assertTrue(r['failures'])
    def test_missing_holds(self): self.assertEqual(evaluate_metamorphic_observations(generate_metamorphic_cases(1),{})['verdict'],'HOLD')
    def test_gate_reviewable(self):
        c=generate_metamorphic_cases(None); obs={x['case_id']:{'base_output':None,'transformed_output':None} for x in c['cases']}; self.assertEqual(metamorphic_gate(evaluate_metamorphic_observations(c,obs))['decision'],'REVIEWABLE')
    def test_never_executes_module(self): self.assertFalse(generate_metamorphic_cases(1)['executed_module'])
if __name__=='__main__': unittest.main()
