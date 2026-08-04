import unittest
from axm_translation_core import append_dissent_record, verify_dissent_ledger, merge_gate_decision
class DissentTests(unittest.TestCase):
    def test_empty_ledger_valid(self): self.assertTrue(verify_dissent_ledger([])['valid'])
    def test_append_and_verify(self):
        l=append_dissent_record([],'d1','tester','missing proof','BLOCK',['e1']); self.assertTrue(verify_dissent_ledger(l)['valid'])
    def test_chain_two_records(self):
        l=append_dissent_record([],'d1','tester','x','WARN'); l=append_dissent_record(l,'d2','human','y','BLOCK',resolved_by='r1'); self.assertTrue(verify_dissent_ledger(l)['valid'])
    def test_tamper_detected(self):
        l=append_dissent_record([],'d1','tester','x','BLOCK'); l[0]['concern']='changed'; self.assertFalse(verify_dissent_ledger(l)['valid'])
    def test_unresolved_block_holds(self):
        l=append_dissent_record([],'d1','tester','x','BLOCK'); self.assertEqual(merge_gate_decision(l,[],[],True)['decision'],'HOLD')
    def test_missing_evidence_holds(self): self.assertEqual(merge_gate_decision([],['proof'],[],True)['decision'],'HOLD')
    def test_human_approval_required(self): self.assertEqual(merge_gate_decision([],[],[],False)['decision'],'HOLD')
    def test_ready_is_manual_only(self):
        d=merge_gate_decision([],['proof'],['proof'],True); self.assertEqual(d['decision'],'ALLOW_MANUAL_MERGE_REVIEW'); self.assertFalse(d['executed'])
if __name__=='__main__': unittest.main()
