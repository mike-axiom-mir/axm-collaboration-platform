
from __future__ import annotations
import unittest
from axm_team_harness.authority_v3 import Lease, delegate
from axm_team_harness.disclosure import public_export
from axm_team_harness.human_decision import DecisionReceipt, revoke, validate_decision
from axm_team_harness.incident import IncidentController
from axm_team_harness.independence import Lineage, evaluate_consensus
from axm_team_harness.orchestrator_v3 import DryRunOrchestrator
from axm_team_harness.privacy_taint import filter_context, transform
from axm_team_harness.proof_graph import ProofGraph, reusable_evidence
from axm_team_harness.registry_v3 import load_registry_v3
from axm_team_harness.resource_tree import BudgetTree, fair_schedule
from axm_team_harness.runner_v3 import run_all_v3
from axm_team_harness.scenarios_v3 import run_scenarios_v3
from axm_team_harness.topology import SeatRouteLock, failover, reconcile_partition

class HarnessV3Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.registry=load_registry_v3()

    def test_23_registry_v3(self):
        self.assertEqual(self.registry['registry_version'],'3.0.0'); self.assertEqual(len(self.registry['entries']),100)
        for key in ('delegation_profile','taint_profile','independence_profile','resource_tree_profile','proof_graph_profile','human_decision_profile','incident_profile','topology_profile','disclosure_profile','dry_run_profile'):
            self.assertEqual(len({e[key]['profile_id'] for e in self.registry['entries']}),100,key)

    def test_24_delegation_conservation(self):
        for e in self.registry['entries']:
            p=Lease('p','h',frozenset({'read','propose'}),frozenset({e['module_id']}),2,10,0,e['delegation_profile']['max_depth'])
            self.assertTrue(delegate(p,child_id='c',holder='a',actions={'read'},targets={e['module_id']},privacy_scope=1,deadline_tick=9)['ok'])
            self.assertFalse(delegate(p,child_id='c',holder='a',actions={'write'},targets={e['module_id']},privacy_scope=1,deadline_tick=9)['ok'])
            self.assertFalse(delegate(p,child_id='c',holder='a',actions={'read'},targets={e['module_id']},privacy_scope=1,deadline_tick=11)['ok'])

    def test_25_privacy_taint(self):
        fields=[{'name':'goal','label':'INTERNAL'},{'name':'private','label':'SECRET'}]
        r=filter_context(fields,maximum_label='INTERNAL',allowed_names={'goal'})
        self.assertTrue(r['ok']); self.assertEqual([x['name'] for x in r['included']],['goal'])
        self.assertFalse(transform(fields,{'label':'PUBLIC'})['ok'])
        self.assertTrue(transform(fields,{'label':'PUBLIC'},redaction_receipt='r')['ok'])

    def test_26_independence(self):
        a=Lineage('a','fa','sa','pa','ca','ma'); b=Lineage('b','fb','sb','pb','cb','mb'); c=Lineage('c','fa','sa','pa','ca','ma')
        self.assertTrue(evaluate_consensus([a,b],['x','x'],minimum_dimensions=2,dissent_preserved=True)['ok'])
        self.assertFalse(evaluate_consensus([a,c],['x','x'],minimum_dimensions=2,dissent_preserved=True)['ok'])
        self.assertFalse(evaluate_consensus([a,b],['x','y'],minimum_dimensions=2,dissent_preserved=False)['ok'])

    def test_27_resources_and_fairness(self):
        t=BudgetTree(100); self.assertTrue(t.reserve('a',60)[0]); self.assertFalse(t.reserve('b',50)[0])
        self.assertTrue(t.consume('a',50)[0]); self.assertFalse(t.consume('a',20)[0])
        self.assertEqual(set(fair_schedule([{'task_id':'a','priority':0,'age':8},{'task_id':'b','priority':3,'age':0}],2)),{'a','b'})

    def test_28_proof_graph_and_reuse(self):
        all_tests={f'test:{i}' for i in range(100)}
        g=ProofGraph(); g.add('c',digest='c',kind='contract'); g.add('test:0',digest='t',kind='test'); g.depends_on('test:0','c')
        self.assertEqual(g.select_tests({'c'},all_tests)['selected'],['test:0'])
        g.add('root',digest='r',kind='root_policy'); self.assertEqual(len(g.select_tests({'root'},all_tests)['selected']),100)
        a={'contract_digest':'a','test_digest':'b','fixture_digest':'c','validator_digest':'d','source_digest':'e','passed':True}; b=dict(a); b['test_digest']='x'
        self.assertFalse(reusable_evidence(a,b))

    def test_29_human_decision_freshness_and_reversal(self):
        r=DecisionReceipt('d','HUMAN',True,'ACCEPT','scope',0,10,True)
        self.assertTrue(validate_decision(r,required_scope='scope',now_tick=5)['ok'])
        self.assertFalse(validate_decision(None,required_scope='scope',now_tick=5)['ok'])
        self.assertFalse(validate_decision(r,required_scope='scope',now_tick=11)['ok'])
        self.assertFalse(validate_decision(revoke(r),required_scope='scope',now_tick=5)['ok'])

    def test_30_incident_containment(self):
        c=IncidentController(); c.trip(['a','b'],['l1','l2'],'x'); self.assertFalse(c.may_act('b','l2')[0])
        self.assertFalse(c.restart(['a','b'],['l1','l2'],human_receipt=None,recovery_checks_passed=True,new_authority_receipt='n')['ok'])
        self.assertTrue(c.restart(['a','b'],['l1','l2'],human_receipt='h',recovery_checks_passed=True,new_authority_receipt='n')['ok'])

    def test_31_identity_safe_failover(self):
        lock=SeatRouteLock('id','a',frozenset({'a','b'}),frozenset({'read'}),1)
        self.assertTrue(failover(lock,requested_route='b',claimed_identity='id',requested_actions={'read'},requested_privacy_scope=1)['ok'])
        self.assertFalse(failover(lock,requested_route='b',claimed_identity='other',requested_actions={'read'},requested_privacy_scope=1)['ok'])
        self.assertFalse(reconcile_partition({'base_revision':1,'value':'a'},{'base_revision':1,'value':'b'})['ok'])

    def test_32_disclosure(self):
        record={'module_id':'m','name':'n','status':'s','evidence_summary':'e','claims':['tested'],'raw_prompt':'secret'}
        self.assertTrue(public_export(record,allowlist={'module_id','name','status','evidence_summary'},supported_claims={'tested'})['ok'])
        self.assertFalse(public_export(record,allowlist={'module_id','raw_prompt'},supported_claims={'tested'})['ok'])
        record['claims'].append('runtime'); self.assertFalse(public_export(record,allowlist={'module_id'},supported_claims={'tested'})['ok'])

    def test_33_orchestrator_boundaries(self):
        o=DryRunOrchestrator(); r=o.execute(task_id='t',authority_ok=True,handoff_accepted=True,independent_verification=True,human_decision='ACCEPT')
        self.assertTrue(r['ok']); self.assertFalse(r['integrated']); self.assertFalse(r['canon'])
        self.assertFalse(DryRunOrchestrator().execute(task_id='t',authority_ok=True,handoff_accepted=True,independent_verification=True,human_decision='ACCEPT',orchestrator_self_approval=True)['ok'])
        stopped=DryRunOrchestrator(); stopped.stop('x'); self.assertFalse(stopped.execute(task_id='t',authority_ok=True,handoff_accepted=True,independent_verification=True,human_decision='ACCEPT')['ok'])

    def test_34_compound_scenarios_v3(self):
        r=run_scenarios_v3(); self.assertEqual(r['scenario_count'],10); self.assertTrue(r['passed'])

    def test_35_full_runner_v3(self):
        r=run_all_v3(); self.assertTrue(r['passed']); self.assertTrue(r['v2_regression_passed'])
        for k,v in r['counts'].items(): self.assertEqual(v,100,k)

if __name__=='__main__': unittest.main()
