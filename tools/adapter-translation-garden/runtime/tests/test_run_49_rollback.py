from __future__ import annotations
import unittest
from axm_translation_core import build_rollback_plan,build_rollback_receipt,verify_rollback_receipt
class Run49RollbackTests(unittest.TestCase):
    def plan(self,current=None): return build_rollback_plan(change_id='c1',before={'a':'old','b':'same'},after={'a':'new','b':'same'},current=current or {'a':'new','b':'same'})
    def test_plan_ready(self): self.assertEqual(self.plan()['verdict'],'PLAN_READY')
    def test_changed_path(self): self.assertEqual(self.plan()['changed_paths'],['a'])
    def test_no_write(self): self.assertFalse(self.plan()['writes_performed'])
    def test_drift_blocks(self): self.assertEqual(self.plan({'a':'other','b':'same'})['verdict'],'BLOCKED_BY_DRIFT')
    def test_no_change(self): self.assertEqual(build_rollback_plan(change_id='x',before={'a':'1'},after={'a':'1'},current={'a':'1'})['verdict'],'NO_CHANGE')
    def test_receipt_restored(self): self.assertEqual(build_rollback_receipt(plan=self.plan(),observed_after={'a':'old'})['verdict'],'RESTORED')
    def test_receipt_mismatch(self): self.assertEqual(build_rollback_receipt(plan=self.plan(),observed_after={'a':'new'})['verdict'],'MISMATCH')
    def test_verify_pass(self):
        p=self.plan(); r=build_rollback_receipt(plan=p,observed_after={'a':'old'}); self.assertEqual(verify_rollback_receipt(p,r)['verdict'],'PASS')
    def test_tampered_receipt_fails(self):
        p=self.plan(); r=build_rollback_receipt(plan=p,observed_after={'a':'old'}); r['plan_sha256']='bad'; self.assertEqual(verify_rollback_receipt(p,r)['verdict'],'FAIL')
    def test_deterministic_plan_hash(self): self.assertEqual(self.plan()['plan_sha256'],self.plan()['plan_sha256'])
    def test_never_executes(self): self.assertFalse(build_rollback_receipt(plan=self.plan(),observed_after={'a':'old'})['executed'])
if __name__=='__main__': unittest.main()
