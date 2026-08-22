import unittest
from axm_translation_core import build_capability_coverage,identify_capability_gaps,prioritize_gap_closure
MODULES=[{'id':'a','capabilities':['x','y'],'status':'LOCAL_PROTOTYPE','authority_mode':'inspect_only','dependencies':[]},{'id':'b','capabilities':['y'],'status':'LOCAL_PROTOTYPE','authority_mode':'inspect_only','dependencies':[]},{'id':'s','capabilities':['z'],'status':'CONTRACT_ONLY','authority_mode':'shadow_only','dependencies':[]}]
class CapabilityMapTests(unittest.TestCase):
    def test_covered(self): self.assertEqual(build_capability_coverage(MODULES,[{'capability':'x'}])['coverage'][0]['coverage'],'COVERED')
    def test_uncovered(self): self.assertEqual(build_capability_coverage(MODULES,[{'capability':'q'}])['coverage'][0]['coverage'],'UNCOVERED')
    def test_shadow_only(self): self.assertEqual(build_capability_coverage(MODULES,[{'capability':'z'}])['coverage'][0]['coverage'],'SHADOW_ONLY')
    def test_single_provider(self): self.assertIn('x',identify_capability_gaps(build_capability_coverage(MODULES))['single_provider'])
    def test_redundant_not_single(self): self.assertNotIn('y',identify_capability_gaps(build_capability_coverage(MODULES))['single_provider'])
    def test_gap_count(self):
        g=identify_capability_gaps(build_capability_coverage(MODULES,[{'capability':'q'},{'capability':'z'}])); self.assertEqual(g['gap_count'],2)
    def test_priority_orders_uncovered(self):
        p=prioritize_gap_closure({'uncovered':['q'],'shadow_only':['z'],'single_provider':['x']}); self.assertEqual(p['ranked'][0]['gap_type'],'uncovered')
    def test_no_automatic_growth(self): self.assertFalse(identify_capability_gaps(build_capability_coverage(MODULES))['automatic_growth'])
if __name__=='__main__': unittest.main()
