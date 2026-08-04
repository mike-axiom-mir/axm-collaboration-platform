import unittest
from axm_translation_core import evaluate_intake_under_uncertainty,build_uncertainty_budget,verify_uncertain_intake_review
C=[{'candidate_id':'good','confidence':.9,'evidence_count':3},{'candidate_id':'unknown','confidence':.9,'evidence_count':3,'unknowns':['x']},{'candidate_id':'conflict','confidence':.9,'evidence_count':3,'conflicts':['x']},{'candidate_id':'weak','confidence':.2,'evidence_count':1}]
class IntakeTests(unittest.TestCase):
    def review(self): return evaluate_intake_under_uncertainty(C)
    def test_good(self): self.assertEqual(self.review()['reviewable_candidate_ids'],['good'])
    def test_three_held(self): self.assertEqual(len(self.review()['held_candidate_ids']),3)
    def test_unknown_reason(self): self.assertIn('unknowns',self.review()['reviews'][1]['hold_reasons'])
    def test_conflict_reason(self): self.assertIn('conflicts',self.review()['reviews'][2]['hold_reasons'])
    def test_weak_reasons(self): self.assertCountEqual(self.review()['reviews'][3]['hold_reasons'],['confidence','evidence_count'])
    def test_verify(self): self.assertEqual(verify_uncertain_intake_review(self.review())['verdict'],'PASS')
    def test_budget(self): self.assertEqual(build_uncertainty_budget(self.review())['candidates'][0]['unknown_count'],0)
    def test_no_auto_accept(self): self.assertFalse(self.review()['automatic_acceptance'])
    def test_tamper(self):
        r=self.review(); r['reviewable_candidate_ids']=[]; self.assertEqual(verify_uncertain_intake_review(r)['verdict'],'HOLD')
if __name__=='__main__': unittest.main()
