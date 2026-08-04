from __future__ import annotations
import copy,unittest
from axm_translation_core import new_proof_chain,append_proof_event,verify_proof_chain
class Run37ProofChainTests(unittest.TestCase):
    def test_new_chain(self): self.assertIsNone(new_proof_chain('c')['tip'])
    def test_empty_id_refused(self):
        with self.assertRaises(ValueError): new_proof_chain('')
    def test_append_sets_sequence(self): self.assertEqual(append_proof_event(new_proof_chain('c'),event_type='inspect',module_id='m',evidence={})['events'][0]['sequence'],0)
    def test_append_updates_tip(self): self.assertIsNotNone(append_proof_event(new_proof_chain('c'),event_type='inspect',module_id='m',evidence={})['tip'])
    def test_source_chain_immutable(self):
        c=new_proof_chain('c'); append_proof_event(c,event_type='x',module_id='m',evidence={}); self.assertEqual(c['events'],[])
    def test_two_event_chain_passes(self):
        c=append_proof_event(new_proof_chain('c'),event_type='a',module_id='m1',evidence={'x':1}); c=append_proof_event(c,event_type='b',module_id='m2',evidence={'y':2}); self.assertEqual(verify_proof_chain(c)['verdict'],'PASS')
    def test_evidence_order_is_canonical(self):
        a=append_proof_event(new_proof_chain('c'),event_type='x',module_id='m',evidence={'a':1,'b':2}); b=append_proof_event(new_proof_chain('c'),event_type='x',module_id='m',evidence={'b':2,'a':1}); self.assertEqual(a['tip'],b['tip'])
    def test_tampered_evidence_refused(self):
        c=append_proof_event(new_proof_chain('c'),event_type='x',module_id='m',evidence={'x':1}); c['events'][0]['evidence']['x']=2; self.assertEqual(verify_proof_chain(c)['verdict'],'REFUSE')
    def test_tampered_hash_refused(self):
        c=append_proof_event(new_proof_chain('c'),event_type='x',module_id='m',evidence={}); c['events'][0]['event_hash']='0'*64; self.assertIn('event_hash_mismatch:0',verify_proof_chain(c)['errors'])
    def test_broken_previous_refused(self):
        c=append_proof_event(new_proof_chain('c'),event_type='a',module_id='m',evidence={}); c=append_proof_event(c,event_type='b',module_id='m',evidence={}); c['events'][1]['previous_hash']='bad'; self.assertIn('previous_hash_mismatch:1',verify_proof_chain(c)['errors'])
    def test_broken_sequence_refused(self):
        c=append_proof_event(new_proof_chain('c'),event_type='x',module_id='m',evidence={}); c['events'][0]['sequence']=7; self.assertIn('sequence_mismatch:0',verify_proof_chain(c)['errors'])
    def test_broken_tip_refused(self):
        c=append_proof_event(new_proof_chain('c'),event_type='x',module_id='m',evidence={}); c['tip']='bad'; self.assertIn('tip_mismatch',verify_proof_chain(c)['errors'])
    def test_claims_preserved(self): self.assertEqual(append_proof_event(new_proof_chain('c'),event_type='x',module_id='m',evidence={},claims=['bounded'])['events'][0]['claims'],['bounded'])
    def test_no_execution_claim(self): self.assertFalse(verify_proof_chain(new_proof_chain('c'))['executed'])
    def test_missing_event_fields_refused(self):
        c={'schema':'axm.translation.proof-chain/v1','chain_id':'c','events':[{}],'tip':None}; self.assertEqual(verify_proof_chain(c)['verdict'],'REFUSE')
if __name__=='__main__': unittest.main()
