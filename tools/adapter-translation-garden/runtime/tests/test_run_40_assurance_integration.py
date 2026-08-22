from __future__ import annotations
import unittest
from axm_translation_core import inspect_json_value,new_proof_chain,append_proof_event,verify_proof_chain,build_replay_record,verify_replay_record
class Run40AssuranceIntegrationTests(unittest.TestCase):
    def pipeline(self,value,budget=None):
        guard=inspect_json_value(value,budget); chain=new_proof_chain('integration'); chain=append_proof_event(chain,event_type='input_guard',module_id='axm.shared.input-guard',evidence=guard,claims=['no_execution']); replay=build_replay_record(replay_id='r',module_id='axm.shared.input-guard',module_version='1',request=value,output=guard,authority={'mode':'inspect_only'},proof_tip=chain['tip']); return guard,chain,replay
    def test_pipeline_accept(self): self.assertEqual(self.pipeline({'x':1})[0]['verdict'],'ACCEPT')
    def test_chain_pass(self): self.assertEqual(verify_proof_chain(self.pipeline({'x':1})[1])['verdict'],'PASS')
    def test_replay_match(self):
        g,c,r=self.pipeline({'x':1}); self.assertEqual(verify_replay_record(r,request={'x':1},output=g,authority={'mode':'inspect_only'},proof_tip=c['tip'])['verdict'],'MATCH')
    def test_replay_detects_changed_guard(self):
        g,c,r=self.pipeline({'x':1}); changed=dict(g); changed['verdict']='REFUSE'; self.assertEqual(verify_replay_record(r,request={'x':1},output=changed,authority={'mode':'inspect_only'},proof_tip=c['tip'])['verdict'],'MISMATCH')
    def test_refusal_can_be_proven(self):
        g,c,r=self.pipeline([1,2,3,4],{'max_nodes':3}); self.assertEqual(g['verdict'],'REFUSE'); self.assertEqual(verify_proof_chain(c)['verdict'],'PASS')
    def test_chain_tip_binds_replay(self):
        g,c,r=self.pipeline({'x':1}); self.assertEqual(r['proof_tip'],c['tip'])
    def test_chain_event_keeps_guard_evidence(self): self.assertEqual(self.pipeline({'x':1})[1]['events'][0]['evidence']['verdict'],'ACCEPT')
    def test_no_action_authority(self): self.assertEqual(self.pipeline({'x':1})[2]['authority']['mode'],'inspect_only')
    def test_replay_does_not_run(self): self.assertFalse(self.pipeline({'x':1})[2]['executed'])
    def test_pipeline_is_deterministic(self): self.assertEqual(self.pipeline({'b':2,'a':1})[1]['tip'],self.pipeline({'a':1,'b':2})[1]['tip'])
if __name__=='__main__': unittest.main()
