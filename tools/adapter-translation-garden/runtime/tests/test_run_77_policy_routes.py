import copy,unittest
from axm_translation_core import evaluate_route_policy,compare_policy_routes,policy_route_gate
ROUTE={'id':'r1','authorities':['inspect_only'],'providers':['p1'],'privacy_classification':'internal','loss_score':.1,'latency_ms':10,'consent_evidence':'c','evidence':['proof'],'uncertainty':.1}
POLICY={'id':'pol','allowed_providers':['p1'],'max_privacy_classification':'internal','max_loss_score':.2,'max_latency_ms':20,'require_consent':True,'required_evidence':['proof']}
class PolicyRouteTests(unittest.TestCase):
    def test_reviewable(self): self.assertEqual(evaluate_route_policy(ROUTE,POLICY)['decision'],'REVIEWABLE_ROUTE')
    def test_gate(self): self.assertEqual(policy_route_gate(evaluate_route_policy(ROUTE,POLICY))['verdict'],'PASS')
    def test_denied_authority(self): self.assertIn('denied_authority',evaluate_route_policy({**ROUTE,'authorities':['shadow_only']},POLICY)['holds'])
    def test_privacy_limit(self): self.assertIn('privacy_limit',evaluate_route_policy({**ROUTE,'privacy_classification':'secret'},POLICY)['holds'])
    def test_consent_missing(self): self.assertIn('consent_missing',evaluate_route_policy({**ROUTE,'consent_evidence':None},POLICY)['holds'])
    def test_silent_degradation(self): self.assertIn('silent_degradation',evaluate_route_policy({**ROUTE,'degraded':True},POLICY)['holds'])
    def test_compare(self):
        r2={**ROUTE,'id':'r2','loss_score':.2}; reviews=[evaluate_route_policy(ROUTE,POLICY),evaluate_route_policy(r2,POLICY)]; self.assertEqual(compare_policy_routes(reviews,[ROUTE,r2])['recommended_for_review'],'r1')
    def test_tamper(self):
        review=evaluate_route_policy(ROUTE,POLICY); review['holds'].append('x'); self.assertEqual(policy_route_gate(review)['verdict'],'HOLD')
    def test_no_dispatch(self): self.assertFalse(evaluate_route_policy(ROUTE,POLICY)['automatic_dispatch'])
if __name__=='__main__': unittest.main()
