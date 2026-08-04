import unittest
from axm_translation_core import plan_local_intake,verify_local_intake_order
M=[{'id':'a','hard_dependencies':['b'],'authority_mode':'inspect_only'},{'id':'b','hard_dependencies':[],'authority_mode':'inspect_only'},{'id':'s','hard_dependencies':[],'authority_mode':'shadow_only'}]
class T(unittest.TestCase):
 def plan(self): return plan_local_intake(['a'],M,['s'],1)
 def test_closure(self): self.assertEqual(self.plan()['dependency_closure'],['a','b'])
 def test_order(self): self.assertEqual(self.plan()['ordered_module_ids'],['b','a'])
 def test_batches(self): self.assertEqual(len(self.plan()['batches']),2)
 def test_ready(self): self.assertEqual(self.plan()['decision'],'READY_FOR_STAGED_INTAKE')
 def test_verify(self): self.assertEqual(verify_local_intake_order(self.plan(),M)['verdict'],'PASS')
 def test_missing(self): self.assertEqual(plan_local_intake(['x'],M,['s'])['decision'],'HOLD')
 def test_shadow(self): self.assertEqual(plan_local_intake(['s'],M,['s'])['decision'],'HOLD')
 def test_cycle(self): self.assertEqual(plan_local_intake(['a'],[{'id':'a','hard_dependencies':['b']},{'id':'b','hard_dependencies':['a']}],[])['decision'],'HOLD')
 def test_no_install(self): self.assertFalse(self.plan()['automatic_install'])
 def test_disabled(self): self.assertFalse(self.plan()['default_enabled'])
if __name__=='__main__': unittest.main()
