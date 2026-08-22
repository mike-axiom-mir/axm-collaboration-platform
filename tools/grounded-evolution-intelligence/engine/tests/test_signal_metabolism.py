from __future__ import annotations
import json,subprocess,sys,unittest
from pathlib import Path
from jsonschema import Draft202012Validator
BASE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE/'signal_metabolism'));sys.path.insert(0,str(BASE/'interop_preflight'))
from signal_engine import build,validate
from preflight_three_module_intake_v2 import run as preflight_v2

class SignalMetabolismTests(unittest.TestCase):
    def setUp(self): self.inputs=json.loads((BASE/'signal_metabolism/fixtures/signal_inputs.json').read_text())['signals']
    def test_signal_engine_deterministic_and_valid(self):
        a=build(self.inputs);b=build(self.inputs);self.assertEqual(a['report_hash'],b['report_hash']);self.assertTrue(validate(a));self.assertEqual(a['unique_signals'],7);self.assertEqual(a['occurrences'],8);self.assertEqual(a['exact_duplicates'],1)
    def test_wrong_signal_is_retained_and_can_yield_candidate_without_truth_promotion(self):
        r=build(self.inputs);x=next(s for s in r['signals'] if s['statement']=='Game Hub contract version is v0.4.')
        self.assertEqual(x['maturity_state'],'DISCONFIRMED');self.assertEqual(x['occurrence_count'],2);self.assertEqual(x['attention']['tier'],'WARM');self.assertTrue(any(d['kind']=='VALIDATOR_CANDIDATE' for d in x['derivative_candidates']));self.assertFalse(x['authority']['evidence_promotion']);self.assertFalse(x['authority']['need_creation'])
    def test_signal_ledger_does_not_modify_canonical_registries(self):
        before={str(p.relative_to(BASE)):p.read_bytes() for folder in ['registry/evidence','registry/needs','registry/directions'] for p in sorted((BASE/folder).glob('*.json'))}
        build(self.inputs)
        after={str(p.relative_to(BASE)):p.read_bytes() for folder in ['registry/evidence','registry/needs','registry/directions'] for p in sorted((BASE/folder).glob('*.json'))}
        self.assertEqual(before,after)
    def test_yield_refuses_fake_help_without_outcomes(self):
        r=subprocess.run([sys.executable,str(BASE/'signal_metabolism/signal_yield.py')],capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stdout+r.stderr);x=json.loads((BASE/'signal_metabolism/generated/signal_yield_report.json').read_text());self.assertEqual(x['status'],'NOT_APPLICABLE');self.assertEqual(x['measured_outcomes'],0)
    def test_preflight_v2_separates_merge_from_signal_capture(self):
        c=BASE/'interop_preflight/fixtures/compatible';f=BASE/'interop_preflight/fixtures/conflict';u=BASE/'interop_preflight/fixtures/unsafe'
        good=preflight_v2([c/'module1.json',c/'module2.json',c/'module3.json']);hold=preflight_v2([f/'module1.json',f/'module2.json',f/'module3.json']);bad=preflight_v2([u/'module1.json',u/'module2.json',u/'module3.json'])
        self.assertEqual(good['merge_status'],'MERGE_READY');self.assertTrue(good['active_merge_allowed'])
        self.assertEqual(hold['merge_status'],'MERGE_HOLD');self.assertFalse(hold['active_merge_allowed']);self.assertEqual(hold['signal_capture_status'],'CAPTURED_PRECANONICAL')
        self.assertEqual(bad['merge_status'],'ACTIVE_MERGE_REJECTED');self.assertFalse(bad['active_merge_allowed']);self.assertEqual(bad['signal_capture_status'],'CAPTURED_PRECANONICAL')
    def test_attention_score_cannot_grant_authority(self):
        r=build(self.inputs)
        for x in r['signals']:
            self.assertIn(x['attention']['tier'],{'HOT','WARM','COLD'});self.assertTrue(all(v is False for v in x['authority'].values()))

if __name__=='__main__':unittest.main()
