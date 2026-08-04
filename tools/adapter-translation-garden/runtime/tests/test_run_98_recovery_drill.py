import copy,unittest
from axm_translation_core import simulate_dependency_recovery_drill,verify_dependency_recovery_drill
G={'app':['core'],'core':[]}; I=[{'module_id':'app','pack_id':'a6','pack_revision':6,'verified':True,'compatible':True},{'module_id':'core','pack_id':'c6','pack_revision':6,'verified':True,'compatible':True}]
class T(unittest.TestCase):
 def drill(self): return simulate_dependency_recovery_drill(['app'],G,I,['core'])
 def test_closure(self): self.assertEqual(self.drill()['dependency_closure'],['app','core'])
 def test_choice(self): self.assertEqual(self.drill()['recovery_choices'][0]['pack_id'],'c6')
 def test_ready(self): self.assertEqual(self.drill()['decision'],'DRILL_REVIEWABLE')
 def test_verify(self): self.assertEqual(verify_dependency_recovery_drill(self.drill())['verdict'],'PASS')
 def test_unrecoverable(self): self.assertEqual(simulate_dependency_recovery_drill(['app'],G,I[:1],['core'])['decision'],'HOLD')
 def test_cycle(self): self.assertTrue(simulate_dependency_recovery_drill(['app'],{'app':['core'],'core':['app']},I,['core'])['cycles'])
 def test_no_extract(self): self.assertFalse(self.drill()['archive_extraction'])
 def test_no_restore(self): self.assertFalse(self.drill()['restore_executed'])
 def test_no_write(self): self.assertFalse(self.drill()['filesystem_writes'])
 def test_tamper(self):
  d=self.drill(); d['decision']='HOLD'; self.assertEqual(verify_dependency_recovery_drill(d)['verdict'],'HOLD')
if __name__=='__main__': unittest.main()
