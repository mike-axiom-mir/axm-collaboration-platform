import unittest
from axm_translation_core import analyze_failure_blast_radius,build_containment_plan,containment_gate
PLAN={'selected_modules':['a','b','c'],'edges':[['a','b'],['b','c']]}
class ContainmentTests(unittest.TestCase):
    def test_downstream_impacted(self): self.assertEqual(analyze_failure_blast_radius(PLAN,['b'])['impacted'],['b','c'])
    def test_upstream_unaffected(self): self.assertIn('a',analyze_failure_blast_radius(PLAN,['b'])['unaffected'])
    def test_shared_resource_expands(self):
        r=analyze_failure_blast_radius(PLAN,['a'],[{'id':'r','modules':['a','c'],'isolation':'shared'}]); self.assertIn('c',r['impacted'])
    def test_dedicated_resource_does_not_expand(self):
        r=analyze_failure_blast_radius(PLAN,['a'],[{'id':'r','modules':['a','c'],'isolation':'dedicated'}]); self.assertNotIn('c',r['resource_impacts'])
    def test_high_ratio_holds(self): self.assertEqual(build_containment_plan(analyze_failure_blast_radius(PLAN,['a']),.5)['decision'],'HOLD')
    def test_reviewable_small_failure(self):
        p={'selected_modules':['a','b','c'],'edges':[]}; self.assertEqual(build_containment_plan(analyze_failure_blast_radius(p,['a']),.5)['decision'],'REVIEWABLE_CONTAINMENT')
    def test_no_automatic_actions(self):
        p=build_containment_plan(analyze_failure_blast_radius({'selected_modules':['a'],'edges':[]},['a']),1); self.assertFalse(p['automatic_retry'])
    def test_gate_detects_mismatch(self):
        a=analyze_failure_blast_radius({'selected_modules':['a'],'edges':[]},['a']); p=build_containment_plan(a,1); p['quarantine_candidates']=[]; self.assertEqual(containment_gate(a,p)['decision'],'HOLD')
if __name__=='__main__': unittest.main()
