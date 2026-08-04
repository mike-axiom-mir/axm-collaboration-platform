import unittest
from axm_translation_core import build_reproducible_build_plan, build_build_receipt, compare_build_receipts, verify_build_receipt
class ReproducibilityTests(unittest.TestCase):
    def plan(self): return build_reproducible_build_plan('a'*64,{'python':'3.13'},[{'action':'compile','inputs':['a'],'outputs':['b']}],{'TZ':'UTC'})
    def receipt(self, plan, digest='b'*64, noise=None): return build_build_receipt(plan,[{'path':'out.zip','sha256':digest,'size_bytes':3}],{'python':'3.13'},noise)
    def test_plan_is_deterministic(self): self.assertEqual(self.plan()['plan_sha256'],self.plan()['plan_sha256'])
    def test_missing_action_refused(self):
        with self.assertRaises(ValueError): build_reproducible_build_plan('a'*64,{},[{}])
    def test_identical_receipts_pass(self):
        p=self.plan(); a=self.receipt(p); self.assertEqual(compare_build_receipts(a,a)['verdict'],'PASS')
    def test_changed_output_holds(self):
        p=self.plan(); self.assertEqual(compare_build_receipts(self.receipt(p),self.receipt(p,'c'*64))['verdict'],'HOLD')
    def test_nondeterminism_holds(self):
        p=self.plan(); self.assertEqual(self.receipt(p,noise=['timestamp'])['status'],'HOLD')
    def test_receipt_verifies(self):
        p=self.plan(); self.assertTrue(verify_build_receipt(p,self.receipt(p))['valid'])
    def test_tamper_detected(self):
        p=self.plan(); r=self.receipt(p); r['outputs'][0]['size_bytes']=4; self.assertFalse(verify_build_receipt(p,r)['valid'])
if __name__=='__main__': unittest.main()
