from __future__ import annotations
import unittest
from axm_team_harness.registry_v4 import load_registry_v4
from axm_team_harness.runner_v4 import run_all_v4
from axm_team_harness.attestation_v4 import CapabilityAttestation, validate_attestation
from axm_team_harness.quorum_v4 import Vote, evaluate_quorum
from axm_team_harness.custody_v4 import CustodyEvent, validate_custody
from axm_team_harness.saga_v4 import SagaStep, execute_saga
from axm_team_harness.metamorphic_v4 import metamorphic_equivalent, evidence_reusable
from axm_team_harness.claims_v4 import Claim, evaluate_claims, may_reopen
from axm_team_harness.compatibility_v4 import ContractSurface, negotiate, validate_adapter
from axm_team_harness.attention_v4 import ReviewItem, schedule_reviews
from axm_team_harness.appeal_v4 import Appeal, evaluate_appeal
from axm_team_harness.release_v4 import validate_release_bundle
from axm_team_harness.scenarios_v4 import run_scenarios_v4

class TestHarnessV4(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result=run_all_v4()
    def test_registry(self): self.assertEqual(len(load_registry_v4()['entries']),100)
    def test_full_runner(self): self.assertTrue(self.result['passed'])
    def test_v3_regression(self): self.assertTrue(self.result['v3_regression_passed'])
    def test_all_metrics(self): self.assertTrue(all(v==100 for v in self.result['counts'].values()))
    def test_scenarios(self): self.assertTrue(run_scenarios_v4()['passed'])
    def test_attestation_good(self):
        a=CapabilityAttestation('a','h','HUMAN_OWNER','s','read',frozenset({'x'}),0,10,'e')
        self.assertTrue(validate_attestation(a,now_tick=1,trusted_issuer_classes={'HUMAN_OWNER'},allowed_scope={'x'})['ok'])
    def test_attestation_self_high_rejected(self):
        a=CapabilityAttestation('a','s','MODEL','s','write',frozenset({'x'}),0,10,'e',True)
        self.assertFalse(validate_attestation(a,now_tick=1,trusted_issuer_classes={'MODEL'},allowed_scope={'x'})['ok'])
    def test_quorum_independent(self): self.assertTrue(evaluate_quorum([Vote('a','ACCEPT','1'),Vote('b','ACCEPT','2'),Vote('h','ACCEPT','h',True)],minimum_independent_clusters=2)['ok'])
    def test_quorum_correlated_rejected(self): self.assertFalse(evaluate_quorum([Vote('a','ACCEPT','1'),Vote('b','ACCEPT','1'),Vote('h','ACCEPT','h',True)],minimum_independent_clusters=2)['ok'])
    def test_human_veto(self): self.assertFalse(evaluate_quorum([Vote('a','ACCEPT','1'),Vote('b','ACCEPT','2'),Vote('h','REJECT','h',True)],minimum_independent_clusters=2)['ok'])
    def test_custody_start_without_acceptance(self):
        a=CustodyEvent('PREPARED','s','t',{},''); b=CustodyEvent('DELIVERED','s','t',{},a.digest()); c=CustodyEvent('STARTED','r','t',{},b.digest())
        self.assertFalse(validate_custody([a,b,c],expected_items={'x'})['ok'])
    def test_saga_compensates(self): self.assertEqual(execute_saga([SagaStep('a'),SagaStep('b')],fail_at='b')['status'],'ROLLED_BACK')
    def test_saga_irreversible_hold(self): self.assertFalse(execute_saga([SagaStep('publish',False)])['ok'])
    def test_metamorphic_nonsemantic(self): self.assertTrue(metamorphic_equivalent({'a':1,'generated_at':1},{'a':1,'generated_at':2},non_semantic_fields={'generated_at'}))
    def test_evidence_reuse_exact_only(self):
        a={'contract_digest':'a','test_digest':'b','fixture_digest':'c','validator_digest':'d','semantic_digest':'e','passed':True}; b=dict(a); b['semantic_digest']='x'; self.assertFalse(evidence_reusable(a,b))
    def test_stale_claim(self): self.assertFalse(evaluate_claims([Claim('c','x',('s',),0,1)],now_tick=2)['ok'])
    def test_contradiction(self): self.assertTrue(evaluate_claims([Claim('a','x',('s',),0,10,'SUPPORT'),Claim('b','x',('t',),0,10,'CONTRADICT')],now_tick=1)['contradiction'])
    def test_reopen_new_evidence(self): self.assertTrue(may_reopen(prior_evidence_digest='a',new_evidence_digest='b',human_reopen=True)['ok'])
    def test_compatibility(self):
        a=ContractSurface(4,2,frozenset({'read'}),frozenset({'read'}),frozenset({'source_digest'})); b=ContractSurface(4,1,a.capabilities,a.authority_actions,a.evidence_fields); self.assertTrue(negotiate(a,b,required_capabilities={'read'},required_evidence={'source_digest'})['ok'])
    def test_adapter_widening(self): self.assertFalse(validate_adapter(source_actions={'read'},target_actions={'read','write'},source_evidence={'a'},target_evidence={'a'})['ok'])
    def test_attention_fatigue(self): self.assertFalse(schedule_reviews([ReviewItem('x',1,1,1,1)],budget=1,fatigue_used=5,fatigue_threshold=5)['ok'])
    def test_attention_no_autoapprove(self): self.assertEqual(schedule_reviews([ReviewItem('x',1,1,1,2)],budget=0,fatigue_used=0,fatigue_threshold=5)['auto_approved'],[])
    def test_appeal_basis(self): self.assertTrue(evaluate_appeal(Appeal('a','d','s',new_evidence_digest='e'),expected_scope='s',human_reopen=True)['ok'])
    def test_appeal_retaliation(self): self.assertFalse(evaluate_appeal(Appeal('a','d','s',new_evidence_digest='e',retaliation_action='ban'),expected_scope='s',human_reopen=True)['ok'])
    def test_release_good(self):
        b={'evidence':{k:'x' for k in ['contract','positive','negative','recovery','human_projection','limitations']},'runtime_proven':False,'canon':False,'approval_owner':'HUMAN','producer_id':'p','approval_actor':'h'}; self.assertTrue(validate_release_bundle(b)['ok'])
    def test_release_runtime_rejected(self):
        b={'evidence':{k:'x' for k in ['contract','positive','negative','recovery','human_projection','limitations']},'runtime_proven':True,'canon':False,'approval_owner':'HUMAN','producer_id':'p','approval_actor':'h'}; self.assertFalse(validate_release_bundle(b)['ok'])
    def test_release_self_approval_rejected(self):
        b={'evidence':{k:'x' for k in ['contract','positive','negative','recovery','human_projection','limitations']},'runtime_proven':False,'canon':False,'approval_owner':'HUMAN','producer_id':'p','approval_actor':'p'}; self.assertFalse(validate_release_bundle(b)['ok'])

if __name__ == '__main__': unittest.main()
