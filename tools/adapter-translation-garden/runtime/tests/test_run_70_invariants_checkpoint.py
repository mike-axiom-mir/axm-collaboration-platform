import unittest
from axm_translation_core import evaluate_invariants,build_invariant_checkpoint,verify_invariant_checkpoint,build_capability_checkpoint,verify_capability_checkpoint
SPECS=[{'id':'no_network','path':['network'],'operator':'is_false','severity':'blocking'},{'id':'tests','path':['tests'],'operator':'minimum','expected':1,'severity':'blocking'}]
class InvariantCheckpointTests(unittest.TestCase):
    def test_invariants_pass(self): self.assertEqual(evaluate_invariants({'network':False,'tests':2},SPECS)['verdict'],'PASS')
    def test_blocking_failure(self): self.assertEqual(evaluate_invariants({'network':True,'tests':2},SPECS)['verdict'],'HOLD')
    def test_advisory_does_not_block(self): self.assertEqual(evaluate_invariants({},[{'id':'x','path':['x'],'operator':'present','severity':'advisory'}])['verdict'],'PASS')
    def test_checkpoint_verifies(self): self.assertTrue(verify_invariant_checkpoint(build_invariant_checkpoint({'network':False,'tests':2},SPECS))['valid'])
    def test_checkpoint_tamper(self):
        c=build_invariant_checkpoint({'network':False,'tests':2},SPECS); c['decision']='HOLD'; self.assertFalse(verify_invariant_checkpoint(c)['valid'])
    def good(self): return build_capability_checkpoint({'decision':'REVIEWABLE'},{'verdict':'PASS'},{'decision':'REVIEWABLE'},{'decision':'REVIEWABLE'},build_invariant_checkpoint({'network':False,'tests':2},SPECS))
    def test_capability_ready(self): self.assertEqual(self.good()['decision'],'READY_FOR_BOUNDED_CAPABILITY_REVIEW')
    def test_capability_verifies(self): self.assertTrue(verify_capability_checkpoint(self.good())['valid'])
    def test_capability_hold_visible(self): self.assertIn('simulation',build_capability_checkpoint({'decision':'REVIEWABLE'},{'verdict':'PASS'},{'decision':'HOLD'},{'decision':'REVIEWABLE'},build_invariant_checkpoint({'network':False,'tests':2},SPECS))['holds'])
if __name__=='__main__': unittest.main()
