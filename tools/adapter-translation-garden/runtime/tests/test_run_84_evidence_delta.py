import copy,unittest
from axm_translation_core import build_evidence_delta,apply_evidence_delta,verify_evidence_delta
B={'a':1,'b':{'x':2},'c':[1,2]}; A={'a':2,'b':{'y':3},'c':[1,2,3],'d':True}
class DeltaTests(unittest.TestCase):
    def delta(self): return build_evidence_delta(B,A)
    def test_apply_exact(self): self.assertEqual(apply_evidence_delta(B,self.delta()),A)
    def test_verify(self): self.assertEqual(verify_evidence_delta(B,self.delta())['verdict'],'PASS')
    def test_deterministic(self): self.assertEqual(self.delta()['delta_sha256'],self.delta()['delta_sha256'])
    def test_add_remove_replace(self): self.assertTrue({'add','remove','replace'} & {x['op'] for x in self.delta()['operations']})
    def test_before_mismatch(self):
        with self.assertRaises(ValueError): apply_evidence_delta({'a':0},self.delta())
    def test_tamper(self):
        d=copy.deepcopy(self.delta()); d['operations'][0]['after']='bad'; self.assertEqual(verify_evidence_delta(B,d)['verdict'],'HOLD')
    def test_lossless(self): self.assertTrue(self.delta()['lossless'])
    def test_no_external(self): self.assertFalse(self.delta()['executed_external_actions'])
    def test_root_replace(self):
        d=build_evidence_delta(1,{'x':2}); self.assertEqual(apply_evidence_delta(1,d),{'x':2})
if __name__=='__main__': unittest.main()
