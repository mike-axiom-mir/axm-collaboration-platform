from __future__ import annotations
import unittest
from axm_team_harness.registry_v5 import load_registry_v5
from axm_team_harness.runner_v5 import run_all_v5
from axm_team_harness.coalition_v5 import CoalitionMember,CoalitionCharter,validate_coalition,dissolve
from axm_team_harness.freshness_v5 import EvidenceNode,evaluate_freshness
from axm_team_harness.revocation_v5 import LeaseNode,cascade_revoke,authorize,resume_with_new_lease
from axm_team_harness.workspace_v5 import BranchPatch,merge_patches
from axm_team_harness.proof_frontier_v5 import minimal_proof_frontier,evaluate_novelty,select_change_tests
from axm_team_harness.contestability_v5 import Challenge,evaluate_challenge
from axm_team_harness.information_barrier_v5 import authorize_exchange
from axm_team_harness.join_barrier_v5 import UpstreamReceipt,evaluate_join
from axm_team_harness.role_reassignment_v5 import Assignment,validate_reassignment
from axm_team_harness.intake_rehearsal_v5 import validate_intake_rehearsal
from axm_team_harness.scenarios_v5 import run_scenarios_v5
class TestHarnessV5(unittest.TestCase):
 @classmethod
 def setUpClass(cls): cls.r=run_all_v5()
 def test_registry(self): self.assertEqual(len(load_registry_v5()['entries']),100)
 def test_full(self): self.assertTrue(self.r['passed'])
 def test_regression(self): self.assertTrue(self.r['v4_regression_passed'])
 def test_metrics(self): self.assertTrue(all(v==100 for v in self.r['counts'].values()))
 def test_scenarios(self): self.assertTrue(run_scenarios_v5()['passed'])
 def test_coalition_valid(self):
  m=CoalitionMember('s',frozenset({'SCOUT'}),frozenset({'read'}),frozenset({'i'})); c=CoalitionCharter('c','t','h',(m,),frozenset({'read'}),frozenset({'i'}),0,10,1); self.assertTrue(validate_coalition(c,now_tick=1,max_members=2,max_depth=2)['ok'])
 def test_coalition_widening(self):
  m=CoalitionMember('s',frozenset({'SCOUT'}),frozenset({'write'}),frozenset({'i'})); c=CoalitionCharter('c','t','h',(m,),frozenset({'read'}),frozenset({'i'}),0,10,1); self.assertFalse(validate_coalition(c,now_tick=1,max_members=2,max_depth=2)['ok'])
 def test_dissolution(self):
  m=CoalitionMember('s',frozenset(),frozenset(),frozenset()); c=CoalitionCharter('c','t','h',(m,),frozenset(),frozenset(),0,10,1); self.assertFalse(dissolve(c,{'l'})['residual_authority'])
 def test_transitive_stale(self): self.assertIn('b',evaluate_freshness([EvidenceNode('a',0,1),EvidenceNode('b',0,10,('a',))],now_tick=2)['stale'])
 def test_missing_parent(self): self.assertFalse(evaluate_freshness([EvidenceNode('b',0,10,('x',))],now_tick=1)['ok'])
 def test_revocation_cascade(self):
  n=[LeaseNode('r',None,'h',frozenset({'read'})),LeaseNode('c','r','s',frozenset({'read'}))]; rv=cascade_revoke(n,'r'); self.assertFalse(authorize(rv['nodes'],'c','read')['ok'])
 def test_new_lease_resume(self): self.assertTrue(resume_with_new_lease(LeaseNode('o',None,'s',frozenset({'r'}),True,True),LeaseNode('n',None,'s',frozenset({'r'})),human_receipt=True)['ok'])
 def test_workspace_nonoverlap(self): self.assertTrue(merge_patches([BranchPatch('a',1,'x',frozenset({'a'}),frozenset({'x'}),'d'),BranchPatch('b',1,'y',frozenset({'b'}),frozenset({'y'}),'e')],current_revision=1)['ok'])
 def test_workspace_semantic_conflict(self): self.assertFalse(merge_patches([BranchPatch('a',1,'x',frozenset({'a'}),frozenset({'x'}),'d'),BranchPatch('b',1,'y',frozenset({'b'}),frozenset({'x'}),'e')],current_revision=1)['ok'])
 def test_frontier(self): self.assertTrue(minimal_proof_frontier({'a','b'},{'t1':{'a'},'t2':{'b'}})['ok'])
 def test_frontier_incomplete(self): self.assertFalse(minimal_proof_frontier({'a','b'},{'t1':{'a'}})['ok'])
 def test_novelty(self): self.assertEqual(evaluate_novelty(delta_digest='x',prior_digests={'x'},new_test=False,new_evidence=False,new_boundary=False)['status'],'NO_NOVEL_DELTA')
 def test_root_selection(self): self.assertEqual(len(select_change_tests(root_change=True,semantic_change=True,module_test='m',all_tests={str(i) for i in range(100)})['selected']),100)
 def test_challenge(self): self.assertTrue(evaluate_challenge(Challenge('c','h','d','s','why',True),expected_scope='s',explanation={'sources':[],'authority':'a','limitations':[],'decision_path':[]},resolver_id='v',producer_id='p')['ok'])
 def test_challenge_producer_only(self): self.assertFalse(evaluate_challenge(Challenge('c','h','d','s','why',False),expected_scope='s',explanation={'sources':[],'authority':'a','limitations':[],'decision_path':[]},resolver_id='p',producer_id='p')['ok'])
 def test_barrier(self): self.assertFalse(authorize_exchange(sender_role='BUILDER',receiver_role='VERIFIER',payload_class='REASONING',phase='INDEPENDENT_WORK',receiver_output_sealed=False)['ok'])
 def test_barrier_postseal_evidence(self): self.assertTrue(authorize_exchange(sender_role='BUILDER',receiver_role='VERIFIER',payload_class='EVIDENCE',phase='POST_SEAL',receiver_output_sealed=True)['ok'])
 def test_join(self): self.assertTrue(evaluate_join([UpstreamReceipt('a',True,'d',True)],required_ids={'a'})['ok'])
 def test_join_partial(self): self.assertFalse(evaluate_join([UpstreamReceipt('a',True,'d',True)],required_ids={'a','b'})['ok'])
 def test_reassignment(self): self.assertTrue(validate_reassignment([Assignment('b',frozenset({'BUILDER'}),frozenset({'read'})),Assignment('v',frozenset({'VERIFIER'}),frozenset({'read'}))],parent_authority={'read'},human_approved=True)['ok'])
 def test_reassignment_conflict(self): self.assertFalse(validate_reassignment([Assignment('x',frozenset({'BUILDER','VERIFIER'}),frozenset({'read'}))],parent_authority={'read'},human_approved=True)['ok'])
 def test_intake(self):
  e={k:'x' for k in ['contract','positive','negative','recovery','contestability','workspace_conflict','revocation','limitations']}; self.assertTrue(validate_intake_rehearsal({'evidence':e,'runtime_proven':False,'canon':False,'producer_id':'p','approval_actor':'h','novelty_status':'NOVEL_DELTA','human_owner':'HUMAN'})['ok'])
 def test_intake_runtime_rejected(self):
  e={k:'x' for k in ['contract','positive','negative','recovery','contestability','workspace_conflict','revocation','limitations']}; self.assertFalse(validate_intake_rehearsal({'evidence':e,'runtime_proven':True,'canon':False,'producer_id':'p','approval_actor':'h','novelty_status':'NOVEL_DELTA','human_owner':'HUMAN'})['ok'])
if __name__=='__main__': unittest.main()
