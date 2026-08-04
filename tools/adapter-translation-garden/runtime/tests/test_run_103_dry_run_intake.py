import copy,unittest
from axm_translation_core import simulate_dry_run_intake,verify_dry_run_intake
P={'ordered_module_ids':['m'],'decision':'READY_FOR_STAGED_INTAKE'}
class T(unittest.TestCase):
 def good(self): return simulate_dry_run_intake(P,[],{'m':['module.json','implementation.py']})
 def test_pass(self): self.assertEqual(self.good()['decision'],'DRY_RUN_PASS')
 def test_count(self): self.assertEqual(len(self.good()['proposed_files']),2)
 def test_collision(self): self.assertEqual(simulate_dry_run_intake(P,['incoming/adapters/m/module.json'],{'m':['module.json']})['decision'],'HOLD')
 def test_unsafe_parent(self): self.assertTrue(simulate_dry_run_intake(P,[],{'m':['../x']})['unsafe_paths'])
 def test_unsafe_absolute(self): self.assertTrue(simulate_dry_run_intake(P,[],{'m':['/x']})['unsafe_paths'])
 def test_duplicate(self): self.assertTrue(simulate_dry_run_intake(P,[],{'m':['x','x']})['duplicate_targets'])
 def test_order_hold(self): self.assertEqual(simulate_dry_run_intake({'ordered_module_ids':['m'],'decision':'HOLD'},[],{'m':['x']})['decision'],'HOLD')
 def test_no_write(self): self.assertFalse(self.good()['filesystem_writes'])
 def test_no_extract(self): self.assertFalse(self.good()['archive_extraction'])
 def test_verify(self): self.assertEqual(verify_dry_run_intake(self.good())['verdict'],'PASS')
if __name__=='__main__': unittest.main()
