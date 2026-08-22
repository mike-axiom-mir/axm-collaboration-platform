import copy, hashlib, io, json, tempfile, unittest, zipfile
from pathlib import Path
from axm_team_harness.registry_v7 import load_registry_v7
from axm_team_harness.runner_v7 import run_all_v7
from axm_team_harness.decision_snapshot_v7 import DecisionSnapshot,seal_decision,validate_decision
from axm_team_harness.receipt_auth_v7 import sign_receipt,verify_receipt
from axm_team_harness.canonical_package_v7 import canonical_manifest,verify_manifest
from axm_team_harness.transaction_rehearsal_v7 import prepare_transaction,commit_rehearsal,abort_rehearsal
from axm_team_harness.invariant_bundle_v7 import build_bundle,verify_member,select_tests
from axm_team_harness.launch_selftest_v7 import run_launch_selftest,environment_fingerprint
from axm_team_harness.human_handoff_v7 import validate_handoff_kit
from axm_team_harness.archive_safety_v7 import inspect_zip_bytes
from axm_team_harness.lineage_audit_v7 import audit_lineage
from axm_team_harness.final_gate_v7 import evaluate_final_gate,MAX_STATUS

def z(entries):
 b=io.BytesIO()
 with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as f:
  for n,d in entries:f.writestr(n,d)
 return b.getvalue()
class TestV7(unittest.TestCase):
 def setUp(self): self.cur={k:hashlib.sha256(k.encode()).hexdigest() for k in ['source','contract','policy','task','options']}
 def test_registry(self): self.assertEqual(len(load_registry_v7()['entries']),100)
 def test_full_runner(self): self.assertTrue(run_all_v7()['passed'])
 def test_decision_valid(self):
  s=DecisionSnapshot('d','h','HUMAN','p','x',self.cur['source'],self.cur['contract'],self.cur['policy'],self.cur['task'],self.cur['options'],True);self.assertTrue(validate_decision(seal_decision(s),current=self.cur)['ok'])
 def test_decision_drift(self):
  s=DecisionSnapshot('d','h','HUMAN','p','x',self.cur['source'],self.cur['contract'],self.cur['policy'],self.cur['task'],self.cur['options'],True);self.assertFalse(validate_decision(seal_decision(s),current={**self.cur,'policy':'x'})['ok'])
 def test_decision_self_approval(self):
  s=DecisionSnapshot('d','p','HUMAN','p','x',self.cur['source'],self.cur['contract'],self.cur['policy'],self.cur['task'],self.cur['options'],True);self.assertFalse(validate_decision(seal_decision(s),current=self.cur)['ok'])
 def test_receipt_valid(self):
  e=sign_receipt({'a':1},key_id='k',key=b's',epoch=1);self.assertTrue(verify_receipt(e,keyring={'k':b's'},current_epoch=1,revoked_keys=set())['ok'])
 def test_receipt_tamper(self):
  e=sign_receipt({'a':1},key_id='k',key=b's',epoch=1);e['payload']['a']=2;self.assertFalse(verify_receipt(e,keyring={'k':b's'},current_epoch=1,revoked_keys=set())['ok'])
 def test_receipt_revoked(self):
  e=sign_receipt({'a':1},key_id='k',key=b's',epoch=1);self.assertFalse(verify_receipt(e,keyring={'k':b's'},current_epoch=1,revoked_keys={'k'})['ok'])
 def test_manifest(self):
  e=[{'path':'a','sha256':'0'*64,'bytes':1}];m=canonical_manifest(e);self.assertTrue(verify_manifest(m,e)['ok'])
 def test_manifest_case_collision(self): self.assertFalse(canonical_manifest([{'path':'a','sha256':'0'*64},{'path':'A','sha256':'0'*64}])['ok'])
 def test_manifest_unicode_collision(self): self.assertFalse(canonical_manifest([{'path':'caf\u00e9','sha256':'0'*64},{'path':'cafe\u0301','sha256':'0'*64}])['ok'])
 def test_transaction_commit(self):
  p=prepare_transaction([{'phase':'PROPOSE','irreversible':False}],manifest_digest='m',human_prepare_receipt='h');self.assertTrue(commit_rehearsal(p,presented_digest=p['prepared_digest'],human_commit_receipt='h2')['ok'])
 def test_transaction_mismatch(self):
  p=prepare_transaction([{'phase':'PROPOSE','irreversible':False}],manifest_digest='m',human_prepare_receipt='h');self.assertFalse(commit_rehearsal(p,presented_digest='x',human_commit_receipt='h2')['ok'])
 def test_transaction_abort(self): self.assertTrue(abort_rehearsal({'prepared_digest':'x'})['ok'])
 def test_irreversible_scope(self): self.assertFalse(prepare_transaction([{'phase':'PROPOSE','irreversible':True}],manifest_digest='m',human_prepare_receipt='h')['ok'])
 def test_bundle(self):
  m={'module_id':'a','invariant':'i','witness':'w'};b=build_bundle('x',[m]);self.assertTrue(verify_member(b,m)['ok'])
 def test_bundle_tamper(self):
  m={'module_id':'a','invariant':'i','witness':'w'};b=build_bundle('x',[m]);self.assertFalse(verify_member(b,{**m,'witness':'z'})['ok'])
 def test_sparse_selection(self): self.assertEqual(select_tests(changed_members={'a'},dependency_map={'a':['b']},root_risk=False,all_modules=['a','b','c']),['a','b'])
 def test_root_selection(self): self.assertEqual(len(select_tests(changed_members={'a'},dependency_map={},root_risk=True,all_modules=['a','b','c'])),3)
 def test_launch(self): self.assertTrue(run_launch_selftest()['ok'])
 def test_launch_stable(self): self.assertEqual(environment_fingerprint(),environment_fingerprint())
 def test_handoff(self):
  s={k:'x' for k in ['purpose','start','stop','rollback','truth_boundary','checksums','human_decision']};self.assertTrue(validate_handoff_kit({'sections':s,'auto_execute':False,'start_file_count':1,'beginner_safe_language':True})['ok'])
 def test_handoff_auto(self):
  s={k:'x' for k in ['purpose','start','stop','rollback','truth_boundary','checksums','human_decision']};self.assertFalse(validate_handoff_kit({'sections':s,'auto_execute':True,'start_file_count':1,'beginner_safe_language':True})['ok'])
 def test_archive_safe(self): self.assertTrue(inspect_zip_bytes(z([('a','b')]))['ok'])
 def test_archive_traversal(self): self.assertFalse(inspect_zip_bytes(z([('../a','b')]))['ok'])
 def test_archive_case_collision(self): self.assertFalse(inspect_zip_bytes(z([('a','b'),('A','c')]))['ok'])
 def test_archive_ratio(self): self.assertFalse(inspect_zip_bytes(z([('a',b'0'*100000)]),max_ratio=2)['ok'])
 def test_lineage(self):
  with tempfile.TemporaryDirectory() as d:
   r=Path(d); ids={'a'}
   for n in range(1,3):
    p=(r/'R1' if n==1 else r/'R2');p.mkdir();(p/f'AXM_AI_TEAM_COLLABORATION_STEWARD_RUN_{n:02d}_LOCAL_INTAKE.jsonl').write_text(json.dumps({'module_id':'a'})+'\n')
   self.assertTrue(audit_lineage(r,expected_ids=ids,start_run=1,end_run=2)['ok'])
 def test_lineage_missing(self):
  with tempfile.TemporaryDirectory() as d:self.assertFalse(audit_lineage(Path(d),expected_ids={'a'},start_run=1,end_run=2)['ok'])
 def _gate(self):
  e={k:'x' for k in ['decision_snapshot','receipt_auth','canonical_package','transaction_rehearsal','invariant_bundle','launch_selftest','human_handoff','archive_safety','lineage_audit','limitations','human_decision']};return {'evidence':e,'runtime_proven':False,'canon':False,'auto_apply':False,'producer_id':'p','approval_actor':'h','approval_actor_kind':'HUMAN','unresolved_defects':False,'lineage_complete':True,'novelty_status':'NOVEL_DELTA'}
 def test_final_gate(self): self.assertEqual(evaluate_final_gate(self._gate())['status'],MAX_STATUS)
 def test_final_runtime(self): self.assertFalse(evaluate_final_gate({**self._gate(),'runtime_proven':True})['ok'])
 def test_final_canon(self): self.assertFalse(evaluate_final_gate({**self._gate(),'canon':True})['ok'])
 def test_final_auto(self): self.assertFalse(evaluate_final_gate({**self._gate(),'auto_apply':True})['ok'])
 def test_final_self(self): self.assertFalse(evaluate_final_gate({**self._gate(),'producer_id':'x','approval_actor':'x'})['ok'])
if __name__=='__main__':unittest.main()
