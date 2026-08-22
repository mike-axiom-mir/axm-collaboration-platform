import unittest
from axm_translation_core import build_interoperability_matrix,evaluate_interop_observations,interoperability_gate
P=[{'id':'p1','format':['json'],'version':['1'],'encoding':['utf-8'],'schema':['a']},{'id':'p2','format':['xml'],'version':['1'],'encoding':['utf-8'],'schema':['b']}]
C=[{'id':'c1','format':['json'],'version':['1'],'encoding':['utf-8'],'schema':['a']},{'id':'c2','format':['json'],'version':['2'],'encoding':['utf-8'],'schema':['a']}]
class InteropTests(unittest.TestCase):
    def matrix(self): return build_interoperability_matrix(P,C)
    def test_four_pairs(self): self.assertEqual(len(self.matrix()['pairs']),4)
    def test_declared_compatible(self): self.assertTrue(next(x for x in self.matrix()['pairs'] if x['id']=='p1->c1')['declared_compatible'])
    def test_declared_incompatible(self): self.assertFalse(next(x for x in self.matrix()['pairs'] if x['id']=='p2->c1')['declared_compatible'])
    def test_complete_report(self):
        obs=[{'pair_id':x['id'],'status':'PASS' if x['declared_compatible'] else 'FAIL','evidence_id':'e'} for x in self.matrix()['pairs']]; self.assertTrue(evaluate_interop_observations(self.matrix(),obs)['complete'])
    def test_gate_pass(self):
        m=self.matrix(); obs=[{'pair_id':x['id'],'status':'PASS' if x['declared_compatible'] else 'FAIL'} for x in m['pairs']]; self.assertEqual(interoperability_gate(evaluate_interop_observations(m,obs))['decision'],'REVIEWABLE')
    def test_missing_holds(self): self.assertEqual(interoperability_gate(evaluate_interop_observations(self.matrix(),[]))['decision'],'HOLD')
    def test_contradiction_holds(self):
        m=self.matrix(); r=evaluate_interop_observations(m,[{'pair_id':'p1->c1','status':'FAIL'}]); self.assertIn('declared_observed_contradiction',interoperability_gate(r,False)['holds'])
    def test_bound(self): self.assertTrue(build_interoperability_matrix(P,C,max_pairs=1)['truncated'])
    def test_no_conversion(self): self.assertFalse(self.matrix()['executed_conversions'])
if __name__=='__main__': unittest.main()
