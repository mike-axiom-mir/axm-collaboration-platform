import unittest
from axm_translation_core import build_deprecation_plan, evaluate_deprecation_state, deprecation_gate
class DeprecationTests(unittest.TestCase):
    def plan(self, replacement='new'): return build_deprecation_plan('m','1.0',100,200,['obsolete'],replacement,['guide'])
    def test_bad_dates_refused(self):
        with self.assertRaises(ValueError): build_deprecation_plan('m','1',100,100,['x'])
    def test_planned_phase(self): self.assertEqual(evaluate_deprecation_state(self.plan(),50)['phase'],'PLANNED')
    def test_deprecated_phase(self): self.assertEqual(evaluate_deprecation_state(self.plan(),150)['phase'],'DEPRECATED')
    def test_sunset_reviewable(self): self.assertEqual(evaluate_deprecation_state(self.plan(),250)['removal_readiness'],'REVIEWABLE')
    def test_dependents_hold(self): self.assertEqual(evaluate_deprecation_state(self.plan(),250,['consumer'])['removal_readiness'],'HOLD')
    def test_no_replacement_or_migration_holds(self):
        p=build_deprecation_plan('m','1',100,200,['x'],None,[]); self.assertEqual(evaluate_deprecation_state(p,250)['removal_readiness'],'HOLD')
    def test_human_gate_required(self): self.assertEqual(deprecation_gate(evaluate_deprecation_state(self.plan(),250),False)['decision'],'HOLD')
    def test_human_gate_is_plan_only(self): self.assertFalse(deprecation_gate(evaluate_deprecation_state(self.plan(),250),True)['executed'])
if __name__=='__main__': unittest.main()
