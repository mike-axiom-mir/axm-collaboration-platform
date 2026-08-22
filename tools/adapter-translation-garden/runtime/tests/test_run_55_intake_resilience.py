from __future__ import annotations
import unittest
from axm_translation_core import *
class Run55IntakeTests(unittest.TestCase):
    def flow(self):
        old={'module_id':'m','module_number':1,'authority_mode':'inspect_only','default_enabled':False,'pack_revision':1,'files_sha256':{'module/implementation.py':'x'}}; new={'module_id':'m','module_number':1,'authority_mode':'inspect_only','default_enabled':False,'pack_revision':2,'payload_files_sha256':{'module/implementation.py':'x'}}
        upgrade=build_upgrade_plan(old,new,previous_pack_sha256='a'*64); mini=purpose_bound_selection({'contract':'x','secret':'y'},purpose='inspect',required_fields=['contract']); deps=analyze_dependency_closure([{'id':'m','hard_dependencies':[],'authority_mode':'inspect_only','default_enabled':False,'implementation':{'network_access':False,'native_writes':False}}],['m']); quarantine=quarantine_decision(integrity_passed=True,compatibility_passed=True,authority_unchanged=True,tests_passed=True,provenance_present=True,dependency_passed=True); trace=build_decision_trace(decision='READY',factors=[{'name':'all','effect':'allow','reason':'all declared checks passed'}],human_review_required=True); return build_intake_decision(compatibility={'verdict':'COMPATIBLE'},payload_verification={'verdict':'PASS'},minimization=mini,dependencies=deps,quarantine=quarantine,upgrade_plan=upgrade,explanation=validate_decision_trace(trace))
    def test_ready_for_human(self): self.assertEqual(self.flow()['verdict'],'READY_FOR_HUMAN_DECISION')
    def test_no_auto_install(self): self.assertFalse(self.flow()['automatic_install'])
    def test_no_auto_merge(self): self.assertFalse(self.flow()['automatic_merge'])
    def test_not_canon(self): self.assertFalse(self.flow()['canon'])
    def test_report_human_required(self): self.assertIn('human decision',intake_action_report(self.flow()))
    def test_integrity_holds(self):
        d=self.flow(); d2=build_intake_decision(compatibility={'verdict':'COMPATIBLE'},payload_verification={'verdict':'FAIL'},minimization={'verdict':'MINIMIZED'},dependencies={'verdict':'PASS'},quarantine={'verdict':'READY_FOR_HUMAN_REVIEW'},upgrade_plan={'verdict':'REVIEWABLE'},explanation={'verdict':'PASS'}); self.assertIn('integrity',d2['failed_checks'])
    def test_minimization_holds(self): self.assertEqual(build_intake_decision(compatibility={'verdict':'COMPATIBLE'},payload_verification={'verdict':'PASS'},minimization={'verdict':'REFUSE'},dependencies={'verdict':'PASS'},quarantine={'verdict':'READY_FOR_HUMAN_REVIEW'},upgrade_plan={'verdict':'REVIEWABLE'},explanation={'verdict':'PASS'})['verdict'],'HOLD')
    def test_dependency_holds(self): self.assertIn('dependencies',build_intake_decision(compatibility={'verdict':'COMPATIBLE'},payload_verification={'verdict':'PASS'},minimization={'verdict':'MINIMIZED'},dependencies={'verdict':'HOLD'},quarantine={'verdict':'READY_FOR_HUMAN_REVIEW'},upgrade_plan={'verdict':'REVIEWABLE'},explanation={'verdict':'PASS'})['failed_checks'])
    def test_quarantine_holds(self): self.assertIn('quarantine',build_intake_decision(compatibility={'verdict':'COMPATIBLE'},payload_verification={'verdict':'PASS'},minimization={'verdict':'MINIMIZED'},dependencies={'verdict':'PASS'},quarantine={'verdict':'QUARANTINE'},upgrade_plan={'verdict':'REVIEWABLE'},explanation={'verdict':'PASS'})['failed_checks'])
    def test_explanation_holds(self): self.assertIn('explanation',build_intake_decision(compatibility={'verdict':'COMPATIBLE'},payload_verification={'verdict':'PASS'},minimization={'verdict':'MINIMIZED'},dependencies={'verdict':'PASS'},quarantine={'verdict':'READY_FOR_HUMAN_REVIEW'},upgrade_plan={'verdict':'REVIEWABLE'},explanation={'verdict':'INCOMPLETE'})['failed_checks'])
    def test_no_execution(self): self.assertFalse(self.flow()['executed'])
    def test_secret_dropped(self): self.assertEqual(purpose_bound_selection({'contract':'x','secret':'y'},purpose='inspect',required_fields=['contract'])['dropped_fields'],['secret'])
if __name__=='__main__': unittest.main()
