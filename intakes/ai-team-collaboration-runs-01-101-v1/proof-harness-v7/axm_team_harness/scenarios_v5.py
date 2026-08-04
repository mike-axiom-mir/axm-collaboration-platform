from __future__ import annotations
from .coalition_v5 import CoalitionMember,CoalitionCharter,validate_coalition,dissolve
from .freshness_v5 import EvidenceNode,evaluate_freshness
from .revocation_v5 import LeaseNode,cascade_revoke,authorize
from .workspace_v5 import BranchPatch,merge_patches
from .contestability_v5 import Challenge,evaluate_challenge
from .information_barrier_v5 import authorize_exchange
from .join_barrier_v5 import UpstreamReceipt,evaluate_join
from .role_reassignment_v5 import Assignment,validate_reassignment
from .intake_rehearsal_v5 import validate_intake_rehearsal

def run_scenarios_v5()->dict:
    scenarios=[]
    m=CoalitionMember('s',frozenset({'SCOUT'}),frozenset({'read'}),frozenset({'internal'})); c=CoalitionCharter('c','t','human',(m,),frozenset({'read'}),frozenset({'internal'}),0,5,1)
    scenarios.append(('coalition_expiry_rejected',not validate_coalition(c,now_tick=6,max_members=2,max_depth=2)['ok']))
    scenarios.append(('coalition_dissolution_no_residual',not dissolve(c,{'l1'})['residual_authority']))
    fr=evaluate_freshness([EvidenceNode('a',0,1),EvidenceNode('b',0,10,('a',))],now_tick=2); scenarios.append(('derived_staleness_propagates','b' in fr['stale']))
    nodes=[LeaseNode('r',None,'h',frozenset({'read'})),LeaseNode('c','r','s',frozenset({'read'}))]; rv=cascade_revoke(nodes,'r'); scenarios.append(('revocation_cascade_denies',not authorize(rv['nodes'],'c','read')['ok']))
    ws=merge_patches([BranchPatch('a',1,'x',frozenset({'p'}),frozenset({'k'}),'d1'),BranchPatch('b',1,'y',frozenset({'q'}),frozenset({'k'}),'d2')],current_revision=1); scenarios.append(('semantic_conflict_held',not ws['ok']))
    ch=evaluate_challenge(Challenge('c','h','d','s','why',True),expected_scope='s',explanation={'sources':[],'authority':'a','limitations':[],'decision_path':[]},resolver_id='v',producer_id='p'); scenarios.append(('challenge_pauses_high_impact',ch['ok'] and ch['action_state']=='PAUSED_FOR_CHALLENGE'))
    ib=authorize_exchange(sender_role='BUILDER',receiver_role='VERIFIER',payload_class='REASONING',phase='INDEPENDENT_WORK',receiver_output_sealed=False); scenarios.append(('independence_barrier_blocks',not ib['ok']))
    jb=evaluate_join([UpstreamReceipt('a',True,'d',True)],required_ids={'a','b'}); scenarios.append(('partial_join_held',not jb['ok'] and jb['status']=='PARTIAL_VISIBLE_HELD'))
    ra=validate_reassignment([Assignment('s',frozenset({'BUILDER','VERIFIER'}),frozenset({'read'}))],parent_authority={'read'},human_approved=True); scenarios.append(('role_accumulation_rejected',not ra['ok']))
    ev={k:'x' for k in ['contract','positive','negative','recovery','contestability','workspace_conflict','revocation','limitations']}; ir=validate_intake_rehearsal({'evidence':ev,'runtime_proven':False,'canon':False,'producer_id':'p','approval_actor':'h','novelty_status':'NOVEL_DELTA','human_owner':'HUMAN'}); scenarios.append(('intake_bounded',ir['ok'] and 'CANDIDATE' in ir['status']))
    return {'scenario_count':len(scenarios),'scenarios':[{'name':n,'passed':p} for n,p in scenarios],'passed':all(p for _,p in scenarios)}
