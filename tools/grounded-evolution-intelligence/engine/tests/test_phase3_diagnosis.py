from __future__ import annotations
import json, subprocess, sys, unittest
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE/'detectors')); sys.path.insert(0,str(BASE/'need_generator'))
from run_diagnosis import run
from generate_needs import build as build_needs

class Phase3DiagnosisTests(unittest.TestCase):
    def test_diagnosis_is_deterministic_and_has_all_detectors(self):
        a=run(); b=run(); self.assertEqual(a['diagnosis_hash'],b['diagnosis_hash']); self.assertEqual(a['totals']['detectors'],18)
    def test_known_grounded_findings_are_preserved(self):
        d={x['detector_id']:x for x in run()['detectors']}
        self.assertEqual(d['conflicting_versions']['finding_count'],2)
        self.assertEqual(d['declared_but_unproven']['finding_count'],15)
        self.assertEqual(d['unresolved_research_blocker']['finding_count'],3)
        self.assertEqual(d['unused_reusable_component']['finding_count'],9)
        self.assertEqual(d['repeated_failure_pattern']['status'],'NOT_APPLICABLE')
        self.assertEqual(d['excessive_resource_cost']['status'],'INSUFFICIENT_DATA')
    def test_placeholder_boundary_is_not_misreported_as_real_module2_proof(self):
        d={x['detector_id']:x for x in run()['detectors']}
        self.assertEqual(d['missing_human_interface']['finding_count'],15)
        for f in d['missing_human_interface']['findings']:
            self.assertIn('axm:need:import-real-module1-module2-artifacts',f['matched_need_ids'])
    def test_need_generator_keeps_candidate_noncanonical(self):
        x=build_needs(); self.assertEqual(x['candidate_count'],1)
        nid=x['candidate_needs'][0]['need_id']
        self.assertFalse((BASE/'registry/needs'/f"{nid.split(':')[-1]}.json").exists())
    def test_three_module_preflight_passes_and_conflict_holds(self):
        p=BASE/'interop_preflight/preflight_three_module_intake.py'
        c=BASE/'interop_preflight/fixtures/compatible'; f=BASE/'interop_preflight/fixtures/conflict'
        good=subprocess.run([sys.executable,str(p),str(c/'module1.json'),str(c/'module2.json'),str(c/'module3.json')],capture_output=True,text=True)
        bad=subprocess.run([sys.executable,str(p),str(f/'module1.json'),str(f/'module2.json'),str(f/'module3.json')],capture_output=True,text=True)
        self.assertEqual(good.returncode,0,good.stdout+good.stderr); self.assertEqual(bad.returncode,2,bad.stdout+bad.stderr)
        self.assertIn('silent overwrite is forbidden',bad.stdout)
    def test_phase3_validator_passes(self):
        r=subprocess.run([sys.executable,str(BASE/'detector_tests/validate_phase3.py')],capture_output=True,text=True)
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)

if __name__=='__main__':unittest.main()
