from __future__ import annotations
import json,unittest
from pathlib import Path
from axm_translation_core import *
ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/'compatibility'/'API_BASELINE_RUN_45.json').read_text()); CUR=json.loads((ROOT/'ASSURANCE_INDEX.json').read_text())
class Run50ResilienceTests(unittest.TestCase):
    def flow(self):
        comp=summarize_baseline(BASE['entries'],CUR['entries']); fail=aggregate_failures([]); rollback=build_rollback_plan(change_id='none',before={},after={},current={}); trace=build_decision_trace(decision='READY_FOR_HUMAN_REVIEW',factors=[{'name':'compatibility','effect':'allow','value':'PASS','reason':'All module APIs match Run 45'}],limitations=['Detached evidence only'],human_review_required=True); valid=validate_decision_trace(trace); return resilience_summary(compatibility=comp,failure_summary=fail,rollback_plan=rollback,trace_validation=valid)
    def test_ready(self): self.assertEqual(self.flow()['verdict'],'READY_FOR_HUMAN_REVIEW')
    def test_no_auto_action(self): self.assertFalse(self.flow()['automatic_action'])
    def test_compatibility_blocker(self): self.assertEqual(resilience_summary(compatibility={'verdict':'FAIL'},failure_summary={'verdict':'PASS'},rollback_plan={'verdict':'NO_CHANGE'},trace_validation={'verdict':'PASS'})['verdict'],'HOLD')
    def test_failure_blocker(self): self.assertIn('failures',resilience_summary(compatibility={'verdict':'PASS'},failure_summary={'verdict':'QUARANTINE'},rollback_plan={'verdict':'NO_CHANGE'},trace_validation={'verdict':'PASS'})['blockers'])
    def test_drift_blocker(self): self.assertIn('rollback_drift',resilience_summary(compatibility={'verdict':'PASS'},failure_summary={'verdict':'PASS'},rollback_plan={'verdict':'BLOCKED_BY_DRIFT'},trace_validation={'verdict':'PASS'})['blockers'])
    def test_trace_blocker(self): self.assertIn('explainability',resilience_summary(compatibility={'verdict':'PASS'},failure_summary={'verdict':'PASS'},rollback_plan={'verdict':'NO_CHANGE'},trace_validation={'verdict':'INCOMPLETE'})['blockers'])
    def test_checkpoint_tip_deterministic(self):
        a=build_checkpoint_evidence(run=50,source_sha256='s',assurance_index_sha256='a',tests_passed=1,tests_run=1,shadow_locks=10); b=build_checkpoint_evidence(run=50,source_sha256='s',assurance_index_sha256='a',tests_passed=1,tests_run=1,shadow_locks=10); self.assertEqual(a['tip'],b['tip'])
    def test_checkpoint_pass(self): self.assertEqual(build_checkpoint_evidence(run=50,source_sha256='s',assurance_index_sha256='a',tests_passed=1,tests_run=1,shadow_locks=10)['verdict'],'PASS')
    def test_checkpoint_review_on_failure(self): self.assertEqual(build_checkpoint_evidence(run=50,source_sha256='s',assurance_index_sha256='a',tests_passed=0,tests_run=1,shadow_locks=10)['verdict'],'REVIEW')
    def test_lineage_pass(self):
        p=build_checkpoint_evidence(run=45,source_sha256='s',assurance_index_sha256='a',tests_passed=1,tests_run=1,shadow_locks=10); c=build_checkpoint_evidence(run=50,source_sha256='s',assurance_index_sha256='b',tests_passed=1,tests_run=1,shadow_locks=10,previous_tip=p['tip']); self.assertEqual(verify_checkpoint_lineage(p,c)['verdict'],'PASS')
    def test_lineage_wrong_tip_fails(self):
        p=build_checkpoint_evidence(run=45,source_sha256='s',assurance_index_sha256='a',tests_passed=1,tests_run=1,shadow_locks=10); c=build_checkpoint_evidence(run=50,source_sha256='s',assurance_index_sha256='b',tests_passed=1,tests_run=1,shadow_locks=10,previous_tip='bad'); self.assertEqual(verify_checkpoint_lineage(p,c)['verdict'],'FAIL')
    def test_shadow_lock_count(self): self.assertEqual(json.loads((ROOT/'garden_manifest.json').read_text())['shadow_only_count'],10)
if __name__=='__main__': unittest.main()
