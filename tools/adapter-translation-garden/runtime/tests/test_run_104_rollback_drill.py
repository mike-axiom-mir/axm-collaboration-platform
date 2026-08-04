import copy,unittest
from axm_translation_core import build_local_rollback_drill,verify_local_rollback_drill
class T(unittest.TestCase):
 def good(self): return build_local_rollback_drill({'a':'1'},{'b':'2'})
 def test_pass(self): self.assertEqual(self.good()['decision'],'DRILL_PASS')
 def test_restored(self): self.assertTrue(self.good()['restored_exactly'])
 def test_hash_equal(self): self.assertEqual(self.good()['before_sha256'],self.good()['rolled_back_sha256'])
 def test_collision(self): self.assertEqual(build_local_rollback_drill({'a':'1'},{'a':'2'})['decision'],'HOLD')
 def test_verify(self): self.assertEqual(verify_local_rollback_drill(self.good())['verdict'],'PASS')
 def test_no_apply(self): self.assertFalse(self.good()['live_apply_executed'])
 def test_no_restore(self): self.assertFalse(self.good()['live_restore_executed'])
 def test_no_write(self): self.assertFalse(self.good()['filesystem_writes'])
 def test_deterministic(self): self.assertEqual(self.good()['drill_sha256'],build_local_rollback_drill({'a':'1'},{'b':'2'})['drill_sha256'])
 def test_tamper(self):
  d=self.good(); d['restored_exactly']=False; self.assertEqual(verify_local_rollback_drill(d)['verdict'],'HOLD')
if __name__=='__main__': unittest.main()
