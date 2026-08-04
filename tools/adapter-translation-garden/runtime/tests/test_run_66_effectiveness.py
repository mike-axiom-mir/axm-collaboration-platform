import unittest
from axm_translation_core import score_steward_candidate,rank_steward_candidates,compare_steward_checkpoints,effectiveness_gate
GOOD={'id':'a','expected_value':.9,'coverage_gain':.8,'risk_reduction':.9,'reuse':.8,'reversibility':.9,'complexity':.2,'compute_cost':.2,'coupling':.1}
class EffectivenessTests(unittest.TestCase):
    def test_good_reviewable(self): self.assertEqual(score_steward_candidate(GOOD)['verdict'],'REVIEWABLE')
    def test_out_of_range_holds(self):
        x=dict(GOOD); x['complexity']=2; self.assertEqual(score_steward_candidate(x)['verdict'],'HOLD')
    def test_missing_id_holds(self):
        x=dict(GOOD); x.pop('id'); self.assertEqual(score_steward_candidate(x)['verdict'],'HOLD')
    def test_rank_prefers_lower_burden(self):
        b=dict(GOOD,id='b',complexity=.8); self.assertEqual(rank_steward_candidates([b,GOOD])['ranked'][0]['id'],'a')
    def test_minimum_score_holds_low(self):
        x=dict(GOOD,id='x',expected_value=0,coverage_gain=0,risk_reduction=0,reuse=0,reversibility=0); self.assertEqual(len(rank_steward_candidates([x],minimum_score=.1)['ranked']),0)
    def test_comparison_gain(self):
        c=compare_steward_checkpoints({'tests':10,'capability_systems':1,'proof_gates':1,'authority_violations':0,'complexity_units':5,'shadow_locks':10},{'tests':30,'capability_systems':3,'proof_gates':3,'authority_violations':0,'complexity_units':8,'shadow_locks':10}); self.assertGreater(c['effective_gain'],0)
    def test_authority_change_not_stable(self):
        c=compare_steward_checkpoints({'authority_violations':0},{'authority_violations':1}); self.assertFalse(c['authority_stable'])
    def test_gate_reviewable(self):
        c=compare_steward_checkpoints({'tests':1,'capability_systems':0,'proof_gates':0,'authority_violations':0,'complexity_units':0,'shadow_locks':10},{'tests':2,'capability_systems':1,'proof_gates':1,'authority_violations':0,'complexity_units':1,'shadow_locks':10}); self.assertEqual(effectiveness_gate(c)['decision'],'REVIEWABLE')
    def test_gate_holds_no_gain(self):
        c=compare_steward_checkpoints({'capability_systems':1,'shadow_locks':10},{'capability_systems':1,'shadow_locks':10}); self.assertEqual(effectiveness_gate(c)['decision'],'HOLD')
if __name__=='__main__': unittest.main()
