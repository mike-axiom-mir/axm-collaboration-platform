from __future__ import annotations
import json
from .registry_v4 import load_registry_v4
from .runner_v3 import run_all_v3
from .attestation_v4 import CapabilityAttestation, validate_attestation, revoke
from .quorum_v4 import Vote, evaluate_quorum
from .custody_v4 import CustodyEvent, validate_custody
from .saga_v4 import SagaStep, execute_saga
from .metamorphic_v4 import metamorphic_equivalent, select_tests, evidence_reusable
from .claims_v4 import Claim, evaluate_claims, may_reopen
from .compatibility_v4 import ContractSurface, negotiate, validate_adapter
from .attention_v4 import ReviewItem, schedule_reviews
from .appeal_v4 import Appeal, evaluate_appeal
from .release_v4 import validate_release_bundle
from .scenarios_v4 import run_scenarios_v4

METRICS = [
'attestations_accepted','self_attest_high_impact_rejected','expired_attestations_rejected','revoked_attestations_rejected',
'independent_quorums_passed','correlated_quorums_rejected','human_vetoes_enforced',
'custody_chains_passed','start_without_acceptance_rejected','partial_returns_held',
'sagas_completed_as_proposals','saga_failures_compensated','irreversible_without_human_rejected','compensation_failures_held',
'metamorphic_equivalence_passed','semantic_changes_detected','metamorphic_sparse_selection_passed','root_full_selection_passed','changed_evidence_reuse_rejected',
'supported_claims_passed','stale_claims_rejected','contradictions_held','new_evidence_reopens_passed',
'compatible_surfaces_passed','major_mismatch_rejected','authority_widening_adapters_rejected','evidence_loss_adapters_rejected','deprecated_surfaces_held',
'attention_queues_prioritized','fatigue_holds_passed','backlog_autoapproval_rejected','aging_fairness_passed',
'appeals_reopened_with_basis','basisless_appeals_rejected','retaliatory_appeals_rejected','minority_reports_preserved',
'release_bundles_passed','incomplete_release_bundles_rejected','runtime_claims_rejected','self_approval_rejected','canon_claims_rejected'
]

def _event(kind, actor, task, payload, prior):
    return CustodyEvent(kind, actor, task, payload, prior)

def run_all_v4() -> dict:
    registry=load_registry_v4(); counts={k:0 for k in METRICS}; per_seed=[]; all_tests={f'test:{e["module_id"]}' for e in registry['entries']}
    for e in registry['entries']:
        n=e['seed_number']; mid=e['module_id']; ps=e['proof_slice_id']
        # 62 attestation
        p=e['attestation_profile']; good=CapabilityAttestation(f'a-{n}','human','HUMAN_OWNER',f'seat-{n}','propose',frozenset({mid}),0,p['expiry_ticks'],ps,False)
        self_high=CapabilityAttestation(f's-{n}',f'seat-{n}','LOCAL_REGISTRY',f'seat-{n}','write',frozenset({mid}),0,p['expiry_ticks'],ps,True)
        vg=validate_attestation(good,now_tick=10,trusted_issuer_classes=set(p['trusted_issuer_classes']),allowed_scope={mid})
        vs=validate_attestation(self_high,now_tick=10,trusted_issuer_classes=set(p['trusted_issuer_classes']),allowed_scope={mid})
        ve=validate_attestation(good,now_tick=p['expiry_ticks']+1,trusted_issuer_classes=set(p['trusted_issuer_classes']),allowed_scope={mid})
        vr=validate_attestation(revoke(good),now_tick=10,trusted_issuer_classes=set(p['trusted_issuer_classes']),allowed_scope={mid})
        counts['attestations_accepted']+=int(vg['ok']); counts['self_attest_high_impact_rejected']+=int(not vs['ok']); counts['expired_attestations_rejected']+=int(not ve['ok']); counts['revoked_attestations_rejected']+=int(not vr['ok'])
        # 63 quorum
        q=e['quorum_profile']; goodq=evaluate_quorum([Vote('a','ACCEPT','c1'),Vote('b','ACCEPT','c2'),Vote('h','ACCEPT','human',True)],minimum_independent_clusters=q['minimum_independent_clusters'])
        badq=evaluate_quorum([Vote('a','ACCEPT','same'),Vote('b','ACCEPT','same'),Vote('h','ACCEPT','human',True)],minimum_independent_clusters=max(2,q['minimum_independent_clusters']))
        veto=evaluate_quorum([Vote('a','ACCEPT','c1'),Vote('b','ACCEPT','c2'),Vote('h','REJECT','human',True,'human dissent')],minimum_independent_clusters=q['minimum_independent_clusters'])
        counts['independent_quorums_passed']+=int(goodq['ok']); counts['correlated_quorums_rejected']+=int(not badq['ok']); counts['human_vetoes_enforced']+=int(not veto['ok'] and 'HUMAN_VETO' in veto['errors'])
        # 64 custody
        expected={'artifact','evidence'}; ev=[]; prior=''
        for kind,actor,payload in [('PREPARED','sender',{}),('DELIVERED','sender',{}),('RECEIVER_ACCEPTED','receiver',{}),('STARTED','receiver',{}),('RETURNED','receiver',{'items':sorted(expected)}),('RESULT_REVIEWED','human',{'decision':'ACCEPT'})]:
            x=_event(kind,actor,f't-{n}',payload,prior); ev.append(x); prior=x.digest()
        custody=validate_custody(ev,expected_items=expected)
        evbad=[]; prior=''
        for kind,actor,payload in [('PREPARED','sender',{}),('DELIVERED','sender',{}),('STARTED','receiver',{})]:
            x=_event(kind,actor,f't-{n}',payload,prior); evbad.append(x); prior=x.digest()
        startbad=validate_custody(evbad,expected_items=expected)
        partial=[]; prior=''
        for kind,actor,payload in [('PREPARED','sender',{}),('DELIVERED','sender',{}),('RECEIVER_ACCEPTED','receiver',{}),('STARTED','receiver',{}),('RETURNED','receiver',{'items':['artifact']}),('RESULT_REVIEWED','human',{'decision':'ACCEPT'})]:
            x=_event(kind,actor,f't-{n}',payload,prior); partial.append(x); prior=x.digest()
        partialres=validate_custody(partial,expected_items=expected)
        counts['custody_chains_passed']+=int(custody['ok']); counts['start_without_acceptance_rejected']+=int(not startbad['ok']); counts['partial_returns_held']+=int(not partialres['ok'] and partialres['status']=='PARTIAL_HELD')
        # 65 saga
        steps=[SagaStep('prepare'),SagaStep('propose'),SagaStep('review')]
        complete=execute_saga(steps); rollback=execute_saga(steps,fail_at='review'); irreversible=execute_saga([SagaStep('publish',False)],human_irreversible_approval=False); compfail=execute_saga(steps,fail_at='review',compensation_fail_at='propose')
        counts['sagas_completed_as_proposals']+=int(complete['ok'] and complete['status']=='PROPOSAL_COMPLETE_NOT_COMMITTED'); counts['saga_failures_compensated']+=int(not rollback['ok'] and rollback['status']=='ROLLED_BACK'); counts['irreversible_without_human_rejected']+=int(not irreversible['ok']); counts['compensation_failures_held']+=int(compfail['status']=='HELD_RECOVERY_REQUIRED')
        # 66 metamorphic
        mp=e['metamorphic_profile']; base={'module_id':mid,'authority_scope':['read'],'privacy_scope':'INTERNAL','evidence_digest':ps,'decision_owner':'HUMAN','generated_at':1,'display_order':[1,2]}; equiv=dict(base); equiv['generated_at']=999; equiv['display_order']=[2,1]; semantic=dict(base); semantic['authority_scope']=['read','write']
        eq=metamorphic_equivalent(base,equiv,non_semantic_fields=set(mp['non_semantic_fields'])); neq=not metamorphic_equivalent(base,semantic,non_semantic_fields=set(mp['non_semantic_fields']))
        plan=select_tests(changed_fields={'generated_at'},semantic_fields=set(mp['semantic_fields']),root_change=False,module_test=f'test:{mid}',all_tests=all_tests); root=select_tests(changed_fields={'root'},semantic_fields=set(mp['semantic_fields']),root_change=True,module_test=f'test:{mid}',all_tests=all_tests)
        prior_ev={'contract_digest':'a','test_digest':'b','fixture_digest':'c','validator_digest':'d','semantic_digest':'e','passed':True}; changed_ev=dict(prior_ev); changed_ev['semantic_digest']='x'
        counts['metamorphic_equivalence_passed']+=int(eq); counts['semantic_changes_detected']+=int(neq); counts['metamorphic_sparse_selection_passed']+=int(plan['selected']==[f'test:{mid}'] and not plan['forced_full']); counts['root_full_selection_passed']+=int(root['forced_full'] and len(root['selected'])==100); counts['changed_evidence_reuse_rejected']+=int(not evidence_reusable(prior_ev,changed_ev))
        # 67 claims
        cp=e['claim_ledger_profile']; supported=evaluate_claims([Claim(f'c-{n}','supported',(ps,),10,cp['freshness_ticks'],'SUPPORT')],now_tick=20); stale=evaluate_claims([Claim(f's-{n}','stale',(ps,),0,1,'SUPPORT')],now_tick=20); contrad=evaluate_claims([Claim(f'a-{n}','x',(ps,),10,100,'SUPPORT'),Claim(f'b-{n}','x',(mid,),10,100,'CONTRADICT')],now_tick=20); reopen=may_reopen(prior_evidence_digest='old',new_evidence_digest='new',human_reopen=True)
        counts['supported_claims_passed']+=int(supported['ok']); counts['stale_claims_rejected']+=int(not stale['ok']); counts['contradictions_held']+=int(not contrad['ok'] and contrad['contradiction'] and len(contrad['preserved_claim_ids'])==2); counts['new_evidence_reopens_passed']+=int(reopen['ok'])
        # 68 compatibility
        comp=e['compatibility_profile']; prod=ContractSurface(4,max(comp['minimum_minor'],2),frozenset({'read','propose'}),frozenset({'read'}),frozenset({'source_digest','contract_digest'})); cons=ContractSurface(4,comp['minimum_minor'],frozenset({'read','propose'}),frozenset({'read'}),frozenset({'source_digest','contract_digest'})); goodc=negotiate(prod,cons,required_capabilities={'read'},required_evidence={'source_digest','contract_digest'}); badmajor=negotiate(ContractSurface(5,0,prod.capabilities,prod.authority_actions,prod.evidence_fields),cons,required_capabilities={'read'},required_evidence={'source_digest'}); wide=validate_adapter(source_actions={'read'},target_actions={'read','write'},source_evidence={'source_digest'},target_evidence={'source_digest'}); lossy=validate_adapter(source_actions={'read'},target_actions={'read'},source_evidence={'source_digest','contract_digest'},target_evidence={'source_digest'}); dep=negotiate(ContractSurface(4,2,prod.capabilities,prod.authority_actions,prod.evidence_fields,True),cons,required_capabilities={'read'},required_evidence={'source_digest'})
        counts['compatible_surfaces_passed']+=int(goodc['ok']); counts['major_mismatch_rejected']+=int(not badmajor['ok']); counts['authority_widening_adapters_rejected']+=int(not wide['ok']); counts['evidence_loss_adapters_rejected']+=int(not lossy['ok']); counts['deprecated_surfaces_held']+=int(not dep['ok'])
        # 69 attention
        ap=e['attention_profile']; items=[ReviewItem(f'high-{n}',9,9,1,ap['review_effort_units']),ReviewItem(f'aged-{n}',1,2,50,1),ReviewItem(f'low-{n}',1,1,0,1)]; scheduled=schedule_reviews(items,budget=ap['review_effort_units']+1,fatigue_used=0,fatigue_threshold=ap['fatigue_threshold']); fatigued=schedule_reviews(items,budget=10,fatigue_used=ap['fatigue_threshold'],fatigue_threshold=ap['fatigue_threshold'])
        counts['attention_queues_prioritized']+=int(scheduled['selected'] and scheduled['selected'][0]==f'high-{n}'); counts['fatigue_holds_passed']+=int(not fatigued['ok'] and fatigued['code']=='FATIGUE_HOLD'); counts['backlog_autoapproval_rejected']+=int(not scheduled['auto_approved'] and not fatigued['auto_approved']); counts['aging_fairness_passed']+=int(scheduled['selected'][:2]==[f'high-{n}',f'aged-{n}'] and f'low-{n}' in scheduled['held'])
        # 70 appeal
        gooda=evaluate_appeal(Appeal(f'a-{n}',f'd-{n}',mid,new_evidence_digest='new',minority_report='preserve'),expected_scope=mid,human_reopen=True); nobasis=evaluate_appeal(Appeal(f'b-{n}',f'd-{n}',mid),expected_scope=mid,human_reopen=True); retaliate=evaluate_appeal(Appeal(f'c-{n}',f'd-{n}',mid,new_evidence_digest='new',minority_report='preserve',retaliation_action='REMOVE_ACCESS'),expected_scope=mid,human_reopen=True)
        counts['appeals_reopened_with_basis']+=int(gooda['ok']); counts['basisless_appeals_rejected']+=int(not nobasis['ok']); counts['retaliatory_appeals_rejected']+=int(not retaliate['ok']); counts['minority_reports_preserved']+=int(gooda['minority_report_preserved']=='preserve')
        # 71 release
        evidence={k:f'{k}-{n}' for k in ['contract','positive','negative','recovery','human_projection','limitations']}; bundle={'evidence':evidence,'runtime_proven':False,'canon':False,'approval_owner':'HUMAN','producer_id':f'seat-{n}','approval_actor':'human'}; goodr=validate_release_bundle(bundle); incomplete=validate_release_bundle({**bundle,'evidence':{'contract':'x'}}); runtime=validate_release_bundle({**bundle,'runtime_proven':True}); selfa=validate_release_bundle({**bundle,'approval_actor':f'seat-{n}'}); canon=validate_release_bundle({**bundle,'canon':True})
        counts['release_bundles_passed']+=int(goodr['ok']); counts['incomplete_release_bundles_rejected']+=int(not incomplete['ok']); counts['runtime_claims_rejected']+=int(not runtime['ok']); counts['self_approval_rejected']+=int(not selfa['ok']); counts['canon_claims_rejected']+=int(not canon['ok'])
        per_seed.append({'seed_number':n,'module_id':mid,'proof_slice_id':ps,
            'run62':vg['ok'] and not vs['ok'] and not ve['ok'] and not vr['ok'],
            'run63':goodq['ok'] and not badq['ok'] and not veto['ok'],
            'run64':custody['ok'] and not startbad['ok'] and not partialres['ok'],
            'run65':complete['ok'] and rollback['status']=='ROLLED_BACK' and not irreversible['ok'] and compfail['status']=='HELD_RECOVERY_REQUIRED',
            'run66':eq and neq and len(root['selected'])==100 and not evidence_reusable(prior_ev,changed_ev),
            'run67':supported['ok'] and not stale['ok'] and not contrad['ok'] and reopen['ok'],
            'run68':goodc['ok'] and not badmajor['ok'] and not wide['ok'] and not lossy['ok'] and not dep['ok'],
            'run69':bool(scheduled['selected']) and not fatigued['ok'] and not scheduled['auto_approved'],
            'run70':gooda['ok'] and not nobasis['ok'] and not retaliate['ok'],
            'run71':goodr['ok'] and not incomplete['ok'] and not runtime['ok'] and not selfa['ok'] and not canon['ok']})
    v3=run_all_v3(); scenarios=run_scenarios_v4(); passed=all(v==100 for v in counts.values()) and all(all(row[f'run{x}'] for x in range(62,72)) for row in per_seed) and v3['passed'] and scenarios['passed']
    return {'harness_version':'0.4.0','registry_digest':registry['registry_digest'],'seed_count':100,'counts':counts,'per_seed':per_seed,'scenario_suite_v4':scenarios,'v3_regression_passed':v3['passed'],'passed':passed,'canon':False,'axm_runtime_integrated':False,'max_status':'READY_FOR_READ_ONLY_MANIFEST_BINDING_CANDIDATE'}
