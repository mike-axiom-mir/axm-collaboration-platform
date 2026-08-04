import copy,unittest
from axm_translation_core import compute_minimal_restore_set,verify_restore_set,build_rollback_feasibility_report
D={'entries':[{'path':'a','status':'HASH_MISMATCH'},{'path':'b','status':'MISSING'},{'path':'c','status':'INTACT'}]}; G={'app':['a','b'],'a':['c']}; C=[{'checkpoint_id':'big','verified':True,'compatible':True,'files':['a','b','c','x']},{'checkpoint_id':'small','verified':True,'compatible':True,'files':['a','b','c']}]
class RestoreTests(unittest.TestCase):
    def plan(self): return compute_minimal_restore_set(['app'],G,D,C)
    def test_closure(self): self.assertCountEqual(self.plan()['dependency_closure'],['a','app','b','c'])
    def test_needed(self): self.assertEqual(self.plan()['damaged_needed_paths'],['a','b'])
    def test_minimal(self): self.assertEqual(self.plan()['chosen_candidate']['checkpoint_id'],'small')
    def test_verify(self): self.assertEqual(verify_restore_set(self.plan())['verdict'],'PASS')
    def test_no_restore(self): self.assertFalse(self.plan()['restore_executed'])
    def test_no_candidate_holds(self): self.assertEqual(compute_minimal_restore_set(['app'],G,D,[])['decision'],'HOLD_NO_COMPLETE_CANDIDATE')
    def test_feasibility(self): self.assertTrue(build_rollback_feasibility_report(self.plan())['feasible'])
    def test_tamper(self):
        p=self.plan(); p['damaged_needed_paths'].append('x'); self.assertEqual(verify_restore_set(p)['verdict'],'HOLD')
if __name__=='__main__': unittest.main()
