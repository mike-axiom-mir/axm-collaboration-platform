from __future__ import annotations
import unittest
from axm_translation_core import quarantine_decision,human_release_gate,revoke_release
class Run53QuarantineTests(unittest.TestCase):
    def ready(self): return quarantine_decision(integrity_passed=True,compatibility_passed=True,authority_unchanged=True,tests_passed=True,provenance_present=True,dependency_passed=True)
    def test_ready_for_review(self): self.assertEqual(self.ready()['verdict'],'READY_FOR_HUMAN_REVIEW')
    def test_integrity_failure_quarantines(self): self.assertEqual(quarantine_decision(integrity_passed=False,compatibility_passed=True,authority_unchanged=True,tests_passed=True,provenance_present=True)['verdict'],'QUARANTINE')
    def test_compatibility_failure_quarantines(self): self.assertIn('compatibility',quarantine_decision(integrity_passed=True,compatibility_passed=False,authority_unchanged=True,tests_passed=True,provenance_present=True)['failed_checks'])
    def test_authority_failure_quarantines(self): self.assertIn('authority',quarantine_decision(integrity_passed=True,compatibility_passed=True,authority_unchanged=False,tests_passed=True,provenance_present=True)['failed_checks'])
    def test_no_auto_release(self): self.assertFalse(self.ready()['automatic_release'])
    def test_no_install(self): self.assertFalse(self.ready()['installed'])
    def test_human_approval_required(self): self.assertEqual(human_release_gate(self.ready(),human_approved=False)['verdict'],'HOLD')
    def test_reference_required(self): self.assertEqual(human_release_gate(self.ready(),human_approved=True,approval_reference=None)['verdict'],'HOLD')
    def test_manual_intake_approval(self): self.assertEqual(human_release_gate(self.ready(),human_approved=True,approval_reference='review-1')['verdict'],'APPROVED_FOR_MANUAL_INTAKE')
    def test_approval_does_not_install(self): self.assertFalse(human_release_gate(self.ready(),human_approved=True,approval_reference='r')['installed'])
    def test_revocation_no_auto_uninstall(self): self.assertFalse(revoke_release(module_id='m',reason='drift',prior_approval_reference='r')['automatic_uninstall'])
    def test_never_executes(self): self.assertFalse(self.ready()['executed'])
if __name__=='__main__': unittest.main()
