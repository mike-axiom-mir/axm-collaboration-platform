import copy,unittest
from axm_translation_core import build_evidence_conflict_report,rank_conflict_candidates,verify_evidence_conflict_report
class EvidenceConflictTests(unittest.TestCase):
    def items(self): return [{'claim':'format','source_id':'a','value':'json','authority':'verified_fixture','verified':True,'confidence':.9},{'claim':'format','source_id':'b','value':'xml','authority':'declared','confidence':.8}]
    def test_conflict(self): self.assertEqual(build_evidence_conflict_report(self.items())['conflict_claims'],['format'])
    def test_verify(self): self.assertEqual(verify_evidence_conflict_report(build_evidence_conflict_report(self.items()))['verdict'],'PASS')
    def test_ranking_holds(self): self.assertEqual(rank_conflict_candidates(build_evidence_conflict_report(self.items()))['decision'],'HOLD')
    def test_no_auto_select(self): self.assertFalse(rank_conflict_candidates(build_evidence_conflict_report(self.items()))['automatic_selection'])
    def test_single_reviewable(self): self.assertEqual(rank_conflict_candidates(build_evidence_conflict_report(self.items()[:1]))['decision'],'REVIEWABLE')
    def test_malformed(self): self.assertEqual(build_evidence_conflict_report([{}])['malformed_indices'],[0])
    def test_superseded_ignored_for_conflict(self):
        x=self.items(); x[1]['superseded']=True; self.assertEqual(build_evidence_conflict_report(x)['conflict_claims'],[])
    def test_tamper(self):
        r=build_evidence_conflict_report(self.items()); r['conflict_claims']=[]; self.assertEqual(verify_evidence_conflict_report(r)['verdict'],'HOLD')
    def test_bounded(self):
        with self.assertRaises(ValueError): build_evidence_conflict_report([{}]*1025)
if __name__=='__main__': unittest.main()
