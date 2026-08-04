from __future__ import annotations
import copy,unittest
from axm_translation_core import build_replay_record,verify_replay_record,compare_replay_outputs
class Run38ReplayTests(unittest.TestCase):
    def rec(self): return build_replay_record(replay_id='r',module_id='m',module_version='1',request={'b':2,'a':1},output={'ok':True},authority={'mode':'preview'},proof_tip='t')
    def test_build(self): self.assertEqual(self.rec()['schema'],'axm.translation.replay-record/v1')
    def test_not_executed(self): self.assertFalse(self.rec()['executed'])
    def test_exact_match(self): self.assertEqual(verify_replay_record(self.rec(),request={'a':1,'b':2},output={'ok':True},authority={'mode':'preview'},proof_tip='t')['verdict'],'MATCH')
    def test_request_change(self): self.assertIn('request',verify_replay_record(self.rec(),request={'a':2,'b':2},output={'ok':True},authority={'mode':'preview'},proof_tip='t')['mismatches'])
    def test_output_change(self): self.assertIn('output',verify_replay_record(self.rec(),request={'a':1,'b':2},output={'ok':False},authority={'mode':'preview'},proof_tip='t')['mismatches'])
    def test_authority_change(self): self.assertIn('authority',verify_replay_record(self.rec(),request={'a':1,'b':2},output={'ok':True},authority={'mode':'write'},proof_tip='t')['mismatches'])
    def test_tip_change(self): self.assertIn('proof_tip',verify_replay_record(self.rec(),request={'a':1,'b':2},output={'ok':True},authority={'mode':'preview'},proof_tip='x')['mismatches'])
    def test_no_reexecution(self): self.assertFalse(verify_replay_record(self.rec(),request={'a':1,'b':2},output={'ok':True},authority={'mode':'preview'},proof_tip='t')['reexecuted'])
    def test_order_independent(self): self.assertTrue(compare_replay_outputs({'a':1,'b':2},{'b':2,'a':1})['equal'])
    def test_value_sensitive(self): self.assertFalse(compare_replay_outputs({'a':1},{'a':2})['equal'])
    def test_source_values_copied(self):
        req={'a':1}; r=build_replay_record(replay_id='r',module_id='m',module_version='1',request=req,output={},authority={},proof_tip=None); req['a']=2; self.assertEqual(r['request']['a'],1)
    def test_required_identity(self):
        with self.assertRaises(ValueError): build_replay_record(replay_id='',module_id='m',module_version='1',request={},output={},authority={},proof_tip=None)
if __name__=='__main__': unittest.main()
