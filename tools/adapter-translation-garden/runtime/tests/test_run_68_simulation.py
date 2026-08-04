import unittest
from axm_translation_core import simulate_declared_plan,compare_simulation_outcomes,simulation_gate
class SimulationTests(unittest.TestCase):
    def test_set(self): self.assertEqual(simulate_declared_plan({},[{'op':'set','path':['x'],'value':1}])['output_state']['x'],1)
    def test_copy(self): self.assertEqual(simulate_declared_plan({'x':1},[{'op':'copy','from':['x'],'to':['y']}])['output_state']['y'],1)
    def test_rename(self):
        r=simulate_declared_plan({'x':1},[{'op':'rename','from':['x'],'to':['y']}]); self.assertNotIn('x',r['output_state'])
    def test_delete_records_loss(self): self.assertEqual(len(simulate_declared_plan({'x':1},[{'op':'delete','path':['x'],'acknowledged_loss':True}])['losses']),1)
    def test_unacknowledged_loss_holds_gate(self):
        r=simulate_declared_plan({'x':1},[{'op':'delete','path':['x']}]); self.assertEqual(simulation_gate(r)['decision'],'HOLD')
    def test_assertion_failure_holds(self): self.assertEqual(simulate_declared_plan({'x':1},[{'op':'assert_equal','path':['x'],'expected':2}])['decision'],'HOLD')
    def test_unknown_operation_holds(self): self.assertEqual(simulate_declared_plan({},[{'op':'execute'}])['decision'],'HOLD')
    def test_step_limit(self): self.assertIn('step_limit',simulate_declared_plan({},[{}]*3,max_steps=2)['holds'])
    def test_deterministic(self):
        a=simulate_declared_plan({},[{'op':'set','path':['x'],'value':1}]); b=simulate_declared_plan({},[{'op':'set','path':['x'],'value':1}]); self.assertTrue(compare_simulation_outcomes(a,b)['equal'])
    def test_never_executes_modules(self): self.assertFalse(simulate_declared_plan({},[])['executed_modules'])
if __name__=='__main__': unittest.main()
