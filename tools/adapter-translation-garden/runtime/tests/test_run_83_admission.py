import copy,unittest
from axm_translation_core import evaluate_admission_envelope,build_admission_plan,verify_admission_review
REQ={'id':'r','memory_mb':10,'storage_mb':20,'latency_ms':5,'energy_wh':1,'bandwidth_kbps':100,'expansion_ratio':2,'evidence':['proof'],'authority_mode':'inspect_only'}
ENV={'id':'e','max_memory_mb':20,'max_storage_mb':30,'max_latency_ms':10,'max_energy_wh':2,'max_bandwidth_kbps':200,'max_expansion_ratio':3,'required_evidence':['proof']}
class AdmissionTests(unittest.TestCase):
    def review(self): return evaluate_admission_envelope(REQ,ENV)
    def test_reviewable(self): self.assertEqual(self.review()['decision'],'REVIEWABLE_ADMISSION')
    def test_verify(self): self.assertEqual(verify_admission_review(self.review())['verdict'],'PASS')
    def test_budget_hold(self): self.assertIn('memory_mb_budget_exceeded',evaluate_admission_envelope({**REQ,'memory_mb':99},ENV)['holds'])
    def test_evidence_hold(self): self.assertIn('required_evidence_missing',evaluate_admission_envelope({**REQ,'evidence':[]},ENV)['holds'])
    def test_shadow_hold(self): self.assertIn('authority_denied',evaluate_admission_envelope({**REQ,'authority_mode':'shadow_only'},ENV)['holds'])
    def test_plan(self): self.assertEqual(build_admission_plan([self.review()])['reviewable_requests'],['r'])
    def test_no_allocate(self): self.assertFalse(self.review()['allocated'])
    def test_tamper(self):
        r=self.review(); r['margins']['memory_mb']=999; self.assertEqual(verify_admission_review(r)['verdict'],'HOLD')
    def test_missing_budget(self):
        e=dict(ENV); e.pop('max_memory_mb'); self.assertIn('budget_fields_missing',evaluate_admission_envelope(REQ,e)['holds'])
if __name__=='__main__': unittest.main()
