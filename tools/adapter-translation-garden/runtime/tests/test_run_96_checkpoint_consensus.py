import copy,unittest
from axm_translation_core import build_checkpoint_consensus,verify_checkpoint_consensus,checkpoint_consensus_action_report
C=[{'checkpoint_id':'a','verified':True,'claims':{'tests':904,'source':'x'}},{'checkpoint_id':'b','verified':True,'claims':{'tests':904,'source':'x'}}]
class T(unittest.TestCase):
 def report(self): return build_checkpoint_consensus(C,['tests','source'])
 def test_ready(self): self.assertEqual(self.report()['decision'],'REVIEWABLE_CONVERGENCE')
 def test_verify(self): self.assertEqual(verify_checkpoint_consensus(self.report())['verdict'],'PASS')
 def test_agreed(self): self.assertEqual(self.report()['agreed_claims']['tests'],904)
 def test_conflict(self):
  c=copy.deepcopy(C); c[1]['claims']['tests']=903; self.assertEqual(build_checkpoint_consensus(c,['tests'])['decision'],'HOLD')
 def test_missing(self): self.assertEqual(build_checkpoint_consensus([C[0],{'checkpoint_id':'b','verified':True,'claims':{}}],['tests'])['claims'][0]['status'],'MISSING')
 def test_invalid(self): self.assertEqual(build_checkpoint_consensus(C+[{}],['tests'])['invalid_indices'],[2])
 def test_no_majority(self): self.assertFalse(self.report()['majority_selection'])
 def test_no_truth_selection(self): self.assertFalse(self.report()['automatic_truth_selection'])
 def test_tamper(self):
  r=self.report(); r['blockers']=['x']; self.assertEqual(verify_checkpoint_consensus(r)['verdict'],'HOLD')
 def test_report(self): self.assertIn('Verified convergence',checkpoint_consensus_action_report(self.report()))
if __name__=='__main__': unittest.main()
