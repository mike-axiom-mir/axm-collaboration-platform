import unittest
from axm_translation_core import select_checkpoint_candidate, build_restoration_plan, verify_restoration_evidence, recovery_readiness
H='a'*64; J='b'*64
class RecoveryTests(unittest.TestCase):
    def candidates(self): return [{'run':55,'source_sha256':H,'checkpoint_sha256':J,'verified':True},{'run':60,'source_sha256':H,'checkpoint_sha256':'c'*64,'verified':True}]
    def test_latest_eligible_selected(self): self.assertEqual(select_checkpoint_candidate(self.candidates(),60,H)['candidate']['run'],60)
    def test_future_candidate_excluded(self): self.assertEqual(select_checkpoint_candidate(self.candidates(),55,H)['candidate']['run'],55)
    def test_wrong_source_holds(self): self.assertEqual(select_checkpoint_candidate(self.candidates(),60,'d'*64)['decision'],'HOLD')
    def test_plan_no_candidate_holds(self): self.assertEqual(build_restoration_plan({'candidate':None},[],[])['verdict'],'HOLD')
    def test_plan_is_nonexecuting(self):
        s=select_checkpoint_candidate(self.candidates(),60,H); self.assertFalse(build_restoration_plan(s,[{'path':'a','sha256':H}],['tests'])['executed'])
    def test_matching_evidence_passes(self):
        s=select_checkpoint_candidate(self.candidates(),60,H); p=build_restoration_plan(s,[{'path':'a','sha256':H}],['tests']); self.assertEqual(verify_restoration_evidence(p,[{'path':'a','sha256':H}],{'tests':True})['verdict'],'PASS')
    def test_inventory_mismatch_holds(self):
        s=select_checkpoint_candidate(self.candidates(),60,H); p=build_restoration_plan(s,[{'path':'a','sha256':H}],['tests']); self.assertEqual(verify_restoration_evidence(p,[{'path':'a','sha256':J}],{'tests':True})['verdict'],'HOLD')
    def test_readiness_remains_review_only(self):
        s=select_checkpoint_candidate(self.candidates(),60,H); p=build_restoration_plan(s,[{'path':'a','sha256':H}],['tests']); e=verify_restoration_evidence(p,[{'path':'a','sha256':H}],{'tests':True}); self.assertFalse(recovery_readiness(s,e)['executed'])
if __name__=='__main__': unittest.main()
