from __future__ import annotations
import unittest
from axm_translation_core import inspect_json_value,new_proof_chain,append_proof_event,verify_proof_chain,build_replay_record,verify_replay_record,evaluate_resource_budget,evaluate_output_expansion,new_provenance,merge_provenance,release_decision
class Run45HardenedIntegrationTests(unittest.TestCase):
    def flow(self,payload):
        guard=inspect_json_value(payload,{'max_nodes':1000}); budget=evaluate_resource_budget({'nodes':guard['stats']['nodes']},{'nodes':1000}); prov=new_provenance(source_id='input',classification='personal',consent_scopes=['translate']); merged=merge_provenance([prov],operation='inspect',module_id='axm.shared.input-guard'); release=release_decision(merged,target_max_classification='personal',required_scope='translate'); evidence={'guard':guard,'budget':budget,'release':release}; chain=append_proof_event(new_proof_chain('hard'),event_type='bounded_inspection',module_id='axm.shared.assurance',evidence=evidence,claims=['no_network','no_write','no_execution']); replay=build_replay_record(replay_id='hard-r',module_id='axm.shared.assurance',module_version='1',request=payload,output=evidence,authority={'mode':'inspect_only'},proof_tip=chain['tip']); return evidence,chain,replay
    def test_happy_guard(self): self.assertEqual(self.flow({'x':1})[0]['guard']['verdict'],'ACCEPT')
    def test_happy_budget(self): self.assertEqual(self.flow({'x':1})[0]['budget']['verdict'],'WITHIN_BUDGET')
    def test_happy_release(self): self.assertEqual(self.flow({'x':1})[0]['release']['verdict'],'ALLOW')
    def test_chain_passes(self): self.assertEqual(verify_proof_chain(self.flow({'x':1})[1])['verdict'],'PASS')
    def test_replay_matches(self):
        e,c,r=self.flow({'x':1}); self.assertEqual(verify_replay_record(r,request={'x':1},output=e,authority={'mode':'inspect_only'},proof_tip=c['tip'])['verdict'],'MATCH')
    def test_changed_payload_mismatch(self):
        e,c,r=self.flow({'x':1}); self.assertEqual(verify_replay_record(r,request={'x':2},output=e,authority={'mode':'inspect_only'},proof_tip=c['tip'])['verdict'],'MISMATCH')
    def test_oversized_refusal_is_provable(self):
        e,c,r=self.flow(list(range(2000))); self.assertEqual(e['guard']['verdict'],'REFUSE'); self.assertEqual(verify_proof_chain(c)['verdict'],'PASS')
    def test_evidence_claims_no_execution(self): self.assertIn('no_execution',self.flow({})[1]['events'][0]['claims'])
    def test_privacy_not_downgraded(self): self.assertEqual(self.flow({})[0]['release']['source_classification'],'personal')
    def test_release_not_performed(self): self.assertFalse(self.flow({})[0]['release']['released'])
    def test_output_expansion_ok(self): self.assertEqual(evaluate_output_expansion(input_bytes=10,output_bytes=20,max_output_bytes=100,max_expansion_ratio=2)['verdict'],'WITHIN_BUDGET')
    def test_output_expansion_refuse(self): self.assertEqual(evaluate_output_expansion(input_bytes=10,output_bytes=21,max_output_bytes=100,max_expansion_ratio=2)['verdict'],'REFUSE')
    def test_chain_deterministic(self): self.assertEqual(self.flow({'b':2,'a':1})[1]['tip'],self.flow({'a':1,'b':2})[1]['tip'])
    def test_provenance_source_preserved(self): self.assertEqual(self.flow({})[0]['release']['source_classification'],'personal')
    def test_no_network_claim(self): self.assertIn('no_network',self.flow({})[1]['events'][0]['claims'])
    def test_no_write_claim(self): self.assertIn('no_write',self.flow({})[1]['events'][0]['claims'])
    def test_authority_stays_inspect(self): self.assertEqual(self.flow({})[2]['authority']['mode'],'inspect_only')
    def test_replay_not_executed(self): self.assertFalse(self.flow({})[2]['executed'])
    def test_budget_not_measured(self): self.assertFalse(self.flow({})[0]['budget']['measured'])
    def test_guard_not_executed(self): self.assertFalse(self.flow({})[0]['guard']['executed'])
if __name__=='__main__': unittest.main()
