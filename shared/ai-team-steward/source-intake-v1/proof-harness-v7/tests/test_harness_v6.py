from __future__ import annotations
import hashlib, unittest
from axm_team_harness.registry_v6 import load_registry_v6
from axm_team_harness.runner_v6 import run_all_v6
from axm_team_harness.scenarios_v6 import run_scenarios_v6
from axm_team_harness.delegation_closure_v6 import ChildDelegation,evaluate_parent_close
from axm_team_harness.authority_epoch_v6 import AuthorityPacket,validate_packet,rotate_epoch
from axm_team_harness.evidence_custody_v6 import EvidenceRecord,disclose,verify_view
from axm_team_harness.partial_failure_v6 import Step,plan_recovery
from axm_team_harness.proof_compaction_v6 import build_merkle,inclusion_proof,verify
from axm_team_harness.review_session_v6 import ReviewSession,review_next,resume
from axm_team_harness.causal_reconciliation_v6 import VersionedPacket,reconcile
from axm_team_harness.proof_summary_v6 import make_summary,validate_summary
from axm_team_harness.sandbox_intake_v6 import rehearse
from axm_team_harness.readiness_gate_v6 import evaluate_readiness
class TestHarnessV6(unittest.TestCase):
 @classmethod
 def setUpClass(cls): cls.r=run_all_v6()
 def test_registry(self): self.assertEqual(len(load_registry_v6()['entries']),100)
 def test_full(self): self.assertTrue(self.r['passed'])
 def test_regression(self): self.assertTrue(self.r['v5_regression_passed'])
 def test_metrics(self): self.assertTrue(all(v==100 for v in self.r['counts'].values()))
 def test_scenarios(self): self.assertTrue(run_scenarios_v6()['passed'])
 def test_close_valid(self): self.assertTrue(evaluate_parent_close('p',[ChildDelegation('c','p','COMPLETED','r',True,True)])['ok'])
 def test_active_child_blocks(self): self.assertFalse(evaluate_parent_close('p',[ChildDelegation('c','p','ACTIVE','r',True,True)])['ok'])
 def test_missing_receipt_blocks(self): self.assertFalse(evaluate_parent_close('p',[ChildDelegation('c','p','COMPLETED',None,True,True)])['ok'])
 def test_stale_epoch(self): self.assertFalse(validate_packet(AuthorityPacket('p',1,1,9,'read'),current_epoch=2,current_seq=2,allowed_actions={'read'})['ok'])
 def test_epoch_rotation_human(self): self.assertTrue(rotate_epoch(1,human_receipt=True)['ok'])
 def test_epoch_rotation_no_human(self): self.assertFalse(rotate_epoch(1,human_receipt=False)['ok'])
 def test_disclosure(self):
  r=EvidenceRecord('e',{'claim':'x','private_memory':'y'},'h'); d=disclose(r,allowed_fields={'claim'},requested_fields={'claim'},redaction_reason='min'); self.assertTrue(verify_view(r,d)['ok'])
 def test_forbidden_disclosure(self):
  r=EvidenceRecord('e',{'claim':'x','private_memory':'y'},'h'); self.assertFalse(disclose(r,allowed_fields={'claim'},requested_fields={'private_memory'},redaction_reason='bad')['ok'])
 def test_partial_failure(self): self.assertIn('b',plan_recovery([Step('a',(),True,False,True),Step('b',('a',),True,True,True)])['rollback'])
 def test_irreversible_hold(self): self.assertEqual(plan_recovery([Step('a',(),True,False,False)])['status'],'HELD_RECOVERY_REQUIRED')
 def test_merkle(self):
  t=build_merkle(['a','b']); self.assertTrue(verify('b',1,inclusion_proof(t,1),t['root']))
 def test_merkle_tamper(self):
  t=build_merkle(['a','b']); self.assertFalse(verify('x',1,inclusion_proof(t,1),t['root']))
 def test_review_resume(self):
  s=ReviewSession('s','h',('i',),0,1); r=review_next(s,'REVIEWED'); self.assertTrue(resume(r['session'],r['digest'])['ok'])
 def test_review_bad_digest(self): self.assertFalse(resume(ReviewSession('s','h',('i',),0,1),'bad')['ok'])
 def test_concurrent_hold(self):
  a=VersionedPacket('a',{'a':1},1,'x'); b=VersionedPacket('b',{'b':1},1,'y'); self.assertFalse(reconcile(a,b,current_epoch=1)['ok'])
 def test_dominance(self):
  a=VersionedPacket('a',{'a':2},1,'x'); b=VersionedPacket('b',{'a':1},1,'y'); self.assertTrue(reconcile(a,b,current_epoch=1)['ok'])
 def test_summary(self):
  e={'a':'b'}; s=make_summary(claim='c',support_refs=['a'],limitations=['l'],unknowns=[],status='W',evidence=e); self.assertTrue(validate_summary(s,evidence=e,supported_claims={'c'},required_limitations={'l'})['ok'])
 def test_summary_unsupported(self):
  e={'a':'b'}; s=make_summary(claim='x',support_refs=['a'],limitations=['l'],unknowns=[],status='W',evidence=e); self.assertFalse(validate_summary(s,evidence=e,supported_claims={'c'},required_limitations={'l'})['ok'])
 def test_sandbox(self):
  d=b'x'; m={'a':hashlib.sha256(d).hexdigest()}; self.assertTrue(rehearse({'a':d},m,[('out',b'y')])['ok'])
 def test_sandbox_escape(self):
  d=b'x'; m={'a':hashlib.sha256(d).hexdigest()}; self.assertFalse(rehearse({'a':d},m,[('../out',b'y')])['ok'])
 def test_readiness(self):
  e={k:'x' for k in ['delegation_closure','authority_epoch','evidence_custody','partial_failure','proof_compaction','review_session','causal_reconciliation','proof_summary','sandbox_intake','limitations']}; b={'evidence':e,'runtime_proven':False,'canon':False,'producer_id':'p','approval_actor':'h','approval_actor_kind':'HUMAN','novelty_status':'NOVEL_DELTA','rollback_clean':True}; self.assertTrue(evaluate_readiness(b)['ok'])
 def test_readiness_runtime_reject(self):
  e={k:'x' for k in ['delegation_closure','authority_epoch','evidence_custody','partial_failure','proof_compaction','review_session','causal_reconciliation','proof_summary','sandbox_intake','limitations']}; b={'evidence':e,'runtime_proven':True,'canon':False,'producer_id':'p','approval_actor':'h','approval_actor_kind':'HUMAN','novelty_status':'NOVEL_DELTA','rollback_clean':True}; self.assertFalse(evaluate_readiness(b)['ok'])
if __name__=='__main__': unittest.main()
