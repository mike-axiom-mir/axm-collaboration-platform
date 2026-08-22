from __future__ import annotations
from .registry_v5 import load_registry_v5
from .runner_v4 import run_all_v4
from .coalition_v5 import CoalitionMember,CoalitionCharter,validate_coalition,dissolve
from .freshness_v5 import EvidenceNode,evaluate_freshness
from .revocation_v5 import LeaseNode,cascade_revoke,authorize,resume_with_new_lease
from .workspace_v5 import BranchPatch,merge_patches
from .proof_frontier_v5 import minimal_proof_frontier,evaluate_novelty,select_change_tests
from .contestability_v5 import Challenge,evaluate_challenge
from .information_barrier_v5 import authorize_exchange
from .join_barrier_v5 import UpstreamReceipt,evaluate_join
from .role_reassignment_v5 import Assignment,validate_reassignment
from .intake_rehearsal_v5 import validate_intake_rehearsal
from .scenarios_v5 import run_scenarios_v5

METRICS=['coalitions_valid','coalition_widening_rejected','expired_coalitions_rejected','coalition_dissolution_clean',
'evidence_fresh','expired_evidence_rejected','transitive_staleness_detected','missing_parent_held',
'revocation_cascade_complete','revoked_actions_denied','orphans_quarantined','new_lease_resume_passed',
'workspace_nonoverlap_passed','path_conflicts_held','semantic_conflicts_held','stale_bases_held',
'proof_frontiers_complete','uncovered_obligations_rejected','root_full_tests_selected','no_novel_delta_rejected',
'challenges_accepted','high_impact_paused','incomplete_explanations_rejected','producer_only_resolution_rejected','retaliation_rejected',
'private_payloads_blocked','preseal_reasoning_blocked','postseal_evidence_allowed',
'joins_ready','missing_upstreams_held','stale_upstreams_held','partial_results_preserved',
'reassignments_valid','role_conflicts_rejected','authority_widening_rejected','unapproved_reassignments_rejected',
'intake_rehearsals_passed','incomplete_intake_held','runtime_claims_rejected_v5','canon_claims_rejected_v5','self_approval_rejected_v5','no_novel_intake_rejected']

def run_all_v5()->dict:
    reg=load_registry_v5(); counts={k:0 for k in METRICS}; per=[]; all_tests={f'test:{e["module_id"]}' for e in reg['entries']}
    for e in reg['entries']:
        n=e['seed_number']; mid=e['module_id']; ps=e['proof_slice_id']
        # 72 coalition
        cp=e['coalition_profile']; goodm=CoalitionMember('s',frozenset({'SCOUT'}),frozenset({'read'}),frozenset({'internal'})); badm=CoalitionMember('b',frozenset({'BUILDER'}),frozenset({'write'}),frozenset({'secret'})); c=CoalitionCharter(f'c{n}',f't{n}','human',(goodm,),frozenset({'read','propose'}),frozenset({'internal'}),0,cp['expires_ticks'],1)
        vg=validate_coalition(c,now_tick=1,max_members=cp['max_members'],max_depth=cp['max_depth']); vw=validate_coalition(CoalitionCharter(f'x{n}',f't{n}','human',(badm,),c.parent_actions,c.parent_privacy,0,cp['expires_ticks'],1),now_tick=1,max_members=cp['max_members'],max_depth=cp['max_depth']); ve=validate_coalition(c,now_tick=cp['expires_ticks']+1,max_members=cp['max_members'],max_depth=cp['max_depth']); ds=dissolve(c,{f'l{n}',f'l{n}b'})
        counts['coalitions_valid']+=int(vg['ok']); counts['coalition_widening_rejected']+=int(not vw['ok']); counts['expired_coalitions_rejected']+=int(not ve['ok']); counts['coalition_dissolution_clean']+=int(not ds['residual_authority'] and len(ds['revoked_leases'])==2)
        # 73 freshness
        fp=e['freshness_graph_profile']; fresh=evaluate_freshness([EvidenceNode('a',0,fp['source_ttl']),EvidenceNode('b',0,fp['derived_ttl'],('a',))],now_tick=1); expired=evaluate_freshness([EvidenceNode('a',0,1)],now_tick=2); trans=evaluate_freshness([EvidenceNode('a',0,1),EvidenceNode('b',0,100,('a',))],now_tick=2); missing=evaluate_freshness([EvidenceNode('b',0,100,('x',))],now_tick=2)
        counts['evidence_fresh']+=int(fresh['ok']); counts['expired_evidence_rejected']+=int(not expired['ok']); counts['transitive_staleness_detected']+=int('b' in trans['stale']); counts['missing_parent_held']+=int('b' in missing['held'])
        # 74 revocation
        nodes=[LeaseNode('r',None,'h',frozenset({'read'})),LeaseNode('c','r','s',frozenset({'read'})),LeaseNode('g','c','x',frozenset({'read'})),LeaseNode('o','missing','z',frozenset({'read'}))]; rv=cascade_revoke(nodes,'r'); denied=authorize(rv['nodes'],'g','read'); resumed=resume_with_new_lease(next(x for x in rv['nodes'] if x.lease_id=='c'),LeaseNode('new','r','s',frozenset({'read'})),human_receipt=True)
        counts['revocation_cascade_complete']+=int(set(rv['affected'])=={'r','c','g'} and rv['all_acknowledged']); counts['revoked_actions_denied']+=int(not denied['ok']); counts['orphans_quarantined']+=int(rv['orphans']==['o']); counts['new_lease_resume_passed']+=int(resumed['ok'])
        # 75 workspace
        p1=BranchPatch('a',1,'x',frozenset({'a.txt'}),frozenset({'alpha'}),ps); p2=BranchPatch('b',1,'y',frozenset({'b.txt'}),frozenset({'beta'}),mid); goodws=merge_patches([p1,p2],current_revision=1); path=merge_patches([p1,BranchPatch('b',1,'y',frozenset({'a.txt'}),frozenset({'beta'}),mid)],current_revision=1); sem=merge_patches([p1,BranchPatch('b',1,'y',frozenset({'b.txt'}),frozenset({'alpha'}),mid)],current_revision=1); stale=merge_patches([BranchPatch('a',0,'x',frozenset({'a'}),frozenset({'x'}),ps)],current_revision=1)
        counts['workspace_nonoverlap_passed']+=int(goodws['ok']); counts['path_conflicts_held']+=int(not path['ok']); counts['semantic_conflicts_held']+=int(not sem['ok']); counts['stale_bases_held']+=int(not stale['ok'])
        # 76 frontier
        obligations=set(e['proof_frontier_profile']['obligations']); coverage={'t1':{'authority','privacy'},'t2':{'evidence','recovery'},'t3':{'human'}}; frontier=minimal_proof_frontier(obligations,coverage); uncovered=minimal_proof_frontier(obligations,{'t1':{'authority'}}); root=select_change_tests(root_change=True,semantic_change=True,module_test=f'test:{mid}',all_tests=all_tests); no=evaluate_novelty(delta_digest='x',prior_digests={'x'},new_test=False,new_evidence=False,new_boundary=False)
        counts['proof_frontiers_complete']+=int(frontier['ok']); counts['uncovered_obligations_rejected']+=int(not uncovered['ok']); counts['root_full_tests_selected']+=int(root['forced_full'] and len(root['selected'])==100); counts['no_novel_delta_rejected']+=int(not no['ok'])
        # 77 contestability
        exp={'sources':[ps],'authority':'human','limitations':['not runtime'],'decision_path':['propose','review']}; goodch=evaluate_challenge(Challenge('c','h','d',mid,'evidence concern',True),expected_scope=mid,explanation=exp,resolver_id='verifier',producer_id='builder'); incomplete=evaluate_challenge(Challenge('c','h','d',mid,'why',False),expected_scope=mid,explanation={'sources':[]},resolver_id='v',producer_id='b'); producer=evaluate_challenge(Challenge('c','h','d',mid,'why',False),expected_scope=mid,explanation=exp,resolver_id='b',producer_id='b'); retaliation=evaluate_challenge(Challenge('c','h','d',mid,'why',False,'REMOVE_ACCESS'),expected_scope=mid,explanation=exp,resolver_id='v',producer_id='b')
        counts['challenges_accepted']+=int(goodch['ok']); counts['high_impact_paused']+=int(goodch['action_state']=='PAUSED_FOR_CHALLENGE'); counts['incomplete_explanations_rejected']+=int(not incomplete['ok']); counts['producer_only_resolution_rejected']+=int(not producer['ok']); counts['retaliation_rejected']+=int(not retaliation['ok'])
        # 78 barrier
        priv=authorize_exchange(sender_role='SCOUT',receiver_role='BUILDER',payload_class='PRIVATE_MEMORY',phase='POST_SEAL',receiver_output_sealed=True); pre=authorize_exchange(sender_role='BUILDER',receiver_role='VERIFIER',payload_class='REASONING',phase='INDEPENDENT_WORK',receiver_output_sealed=False); post=authorize_exchange(sender_role='BUILDER',receiver_role='VERIFIER',payload_class='EVIDENCE',phase='POST_SEAL',receiver_output_sealed=True)
        counts['private_payloads_blocked']+=int(not priv['ok']); counts['preseal_reasoning_blocked']+=int(not pre['ok']); counts['postseal_evidence_allowed']+=int(post['ok'])
        # 79 join
        goodj=evaluate_join([UpstreamReceipt('a',True,ps,True),UpstreamReceipt('b',True,mid,True)],required_ids={'a','b'}); miss=evaluate_join([UpstreamReceipt('a',True,ps,True)],required_ids={'a','b'}); st=evaluate_join([UpstreamReceipt('a',True,ps,False),UpstreamReceipt('b',True,mid,True)],required_ids={'a','b'})
        counts['joins_ready']+=int(goodj['ok']); counts['missing_upstreams_held']+=int(not miss['ok']); counts['stale_upstreams_held']+=int(not st['ok']); counts['partial_results_preserved']+=int(miss['partial_results_preserved']==['a'])
        # 80 reassignment
        goodra=validate_reassignment([Assignment('b',frozenset({'BUILDER'}),frozenset({'read','propose'})),Assignment('v',frozenset({'VERIFIER'}),frozenset({'read'}))],parent_authority={'read','propose'},human_approved=True); conflict=validate_reassignment([Assignment('x',frozenset({'BUILDER','VERIFIER'}),frozenset({'read'}))],parent_authority={'read'},human_approved=True); wide=validate_reassignment([Assignment('x',frozenset({'BUILDER'}),frozenset({'write'}))],parent_authority={'read'},human_approved=True); unapproved=validate_reassignment([Assignment('x',frozenset({'BUILDER'}),frozenset({'read'}))],parent_authority={'read'},human_approved=False)
        counts['reassignments_valid']+=int(goodra['ok']); counts['role_conflicts_rejected']+=int(not conflict['ok']); counts['authority_widening_rejected']+=int(not wide['ok']); counts['unapproved_reassignments_rejected']+=int(not unapproved['ok'])
        # 81 intake rehearsal
        evd={k:f'{k}-{n}' for k in ['contract','positive','negative','recovery','contestability','workspace_conflict','revocation','limitations']}; base={'evidence':evd,'runtime_proven':False,'canon':False,'producer_id':f'p{n}','approval_actor':'human','novelty_status':'NOVEL_DELTA','human_owner':'HUMAN'}; ir=validate_intake_rehearsal(base); inc=validate_intake_rehearsal({**base,'evidence':{'contract':'x'}}); runtime=validate_intake_rehearsal({**base,'runtime_proven':True}); canon=validate_intake_rehearsal({**base,'canon':True}); selfa=validate_intake_rehearsal({**base,'approval_actor':f'p{n}'}); nond=validate_intake_rehearsal({**base,'novelty_status':'NO_NOVEL_DELTA'})
        counts['intake_rehearsals_passed']+=int(ir['ok']); counts['incomplete_intake_held']+=int(not inc['ok']); counts['runtime_claims_rejected_v5']+=int(not runtime['ok']); counts['canon_claims_rejected_v5']+=int(not canon['ok']); counts['self_approval_rejected_v5']+=int(not selfa['ok']); counts['no_novel_intake_rejected']+=int(not nond['ok'])
        per.append({'seed_number':n,'module_id':mid,'proof_slice_id':ps,
            'run72':vg['ok'] and not vw['ok'] and not ve['ok'] and not ds['residual_authority'],
            'run73':fresh['ok'] and not expired['ok'] and 'b' in trans['stale'] and 'b' in missing['held'],
            'run74':set(rv['affected'])=={'r','c','g'} and not denied['ok'] and resumed['ok'],
            'run75':goodws['ok'] and not path['ok'] and not sem['ok'] and not stale['ok'],
            'run76':frontier['ok'] and not uncovered['ok'] and len(root['selected'])==100 and not no['ok'],
            'run77':goodch['ok'] and not incomplete['ok'] and not producer['ok'] and not retaliation['ok'],
            'run78':not priv['ok'] and not pre['ok'] and post['ok'],
            'run79':goodj['ok'] and not miss['ok'] and not st['ok'],
            'run80':goodra['ok'] and not conflict['ok'] and not wide['ok'] and not unapproved['ok'],
            'run81':ir['ok'] and not inc['ok'] and not runtime['ok'] and not canon['ok'] and not selfa['ok'] and not nond['ok']})
    v4=run_all_v4(); scenarios=run_scenarios_v5(); passed=all(v==100 for v in counts.values()) and all(all(r[f'run{x}'] for x in range(72,82)) for r in per) and v4['passed'] and scenarios['passed']
    return {'harness_version':'0.5.0','registry_digest':reg['registry_digest'],'seed_count':100,'counts':counts,'per_seed':per,'scenario_suite_v5':scenarios,'v4_regression_passed':v4['passed'],'passed':passed,'canon':False,'axm_runtime_integrated':False,'max_status':'READY_FOR_BOUNDED_READ_ONLY_INTAKE_REHEARSAL_CANDIDATE'}
