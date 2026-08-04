
from __future__ import annotations
import copy
from typing import Any
from .authority_v3 import Lease, delegate
from .disclosure import public_export, reidentification_risk
from .human_decision import DecisionReceipt, revoke, validate_decision
from .incident import IncidentController
from .independence import Lineage, evaluate_consensus
from .orchestrator_v3 import DryRunOrchestrator
from .privacy_taint import filter_context, transform
from .proof_graph import ProofGraph, reusable_evidence
from .registry_v3 import load_registry_v3
from .resource_tree import BudgetTree, fair_schedule
from .runner_v2 import run_all_v2
from .scenarios_v3 import run_scenarios_v3
from .topology import SeatRouteLock, failover, reconcile_partition


def run_all_v3() -> dict[str, Any]:
    registry = load_registry_v3()
    metric_names = [
        'delegation_subsets_accepted','delegation_widening_rejected','delegation_deadline_reset_rejected',
        'context_minimization_passed','taint_laundering_rejected','reviewed_redaction_passed',
        'independent_consensus_passed','correlated_consensus_rejected','dissent_loss_rejected',
        'budget_conservation_passed','budget_oversubscription_rejected','fairness_windows_passed',
        'proof_graph_sparse_selection_passed','proof_graph_root_full_selection_passed','stale_evidence_reuse_rejected',
        'human_decisions_accepted','silence_consent_rejected','expired_decisions_rejected','revoked_decisions_rejected',
        'incident_stops_propagated','incident_unauthorized_restart_rejected','incident_authorized_restart_passed',
        'identity_safe_failovers_passed','identity_substitutions_rejected','split_brain_divergence_held',
        'public_safe_exports_passed','public_private_leaks_rejected','unsupported_claims_rejected',
        'dry_run_flows_completed','orchestrator_self_approval_rejected','dry_run_stop_controls_passed',
    ]
    counts = {name: 0 for name in metric_names}
    per_seed=[]
    all_test_ids={f'test:{e["module_id"]}' for e in registry['entries']}
    for e in registry['entries']:
        n=e['seed_number']; mid=e['module_id']; ps=e['proof_slice_id']
        # Run 52
        max_depth=e['delegation_profile']['max_depth']
        parent=Lease(f'parent-{n}', 'human', frozenset({'read','propose'}), frozenset({mid}), 2, 100, 0, max_depth)
        good=delegate(parent,child_id=f'child-{n}',holder=f'seat-{n}',actions={'read'},targets={mid},privacy_scope=1,deadline_tick=90)
        wide=delegate(parent,child_id=f'wide-{n}',holder=f'seat-{n}',actions={'write'},targets={mid},privacy_scope=1,deadline_tick=90)
        late=delegate(parent,child_id=f'late-{n}',holder=f'seat-{n}',actions={'read'},targets={mid},privacy_scope=1,deadline_tick=101)
        counts['delegation_subsets_accepted'] += int(good['ok'])
        counts['delegation_widening_rejected'] += int(not wide['ok'] and 'AUTHORITY_WIDENING' in wide['errors'])
        counts['delegation_deadline_reset_rejected'] += int(not late['ok'] and 'DEADLINE_RESET_OR_EXTENSION' in late['errors'])
        # Run 53
        fields=[{'name':'goal','value':mid,'label':'INTERNAL'},{'name':'private_memory','value':'never-send','label':'SECRET'},{'name':'evidence','value':ps,'label':'INTERNAL'}]
        capsule=filter_context(fields,maximum_label='INTERNAL',allowed_names={'goal','evidence'})
        laundering=transform(fields,{'label':'PUBLIC'})
        redacted=transform(fields,{'label':'PUBLIC'},redaction_receipt=f'redact-{n}')
        counts['context_minimization_passed'] += int(capsule['ok'] and {x['name'] for x in capsule['included']}=={'goal','evidence'} and any(x['name']=='private_memory' for x in capsule['excluded']))
        counts['taint_laundering_rejected'] += int(not laundering['ok'])
        counts['reviewed_redaction_passed'] += int(redacted['ok'])
        # Run 54
        min_dims=e['independence_profile']['minimum_dimensions']
        a=Lineage(f'a-{n}','family-a',f'source-a-{n}',f'prompt-a-{n}',f'ctx-a-{n}',f'method-a-{n}')
        b=Lineage(f'b-{n}','family-b',f'source-b-{n}',f'prompt-b-{n}',f'ctx-b-{n}',f'method-b-{n}')
        correlated=Lineage(f'c-{n}',a.model_family,a.source_digest,a.prompt_digest,a.context_digest,a.method_id)
        independent=evaluate_consensus([a,b],['claim','claim'],minimum_dimensions=min_dims,dissent_preserved=True)
        corr=evaluate_consensus([a,correlated],['claim','claim'],minimum_dimensions=min_dims,dissent_preserved=True)
        dissent=evaluate_consensus([a,b],['claim','counter'],minimum_dimensions=min_dims,dissent_preserved=False)
        counts['independent_consensus_passed'] += int(independent['ok'])
        counts['correlated_consensus_rejected'] += int(not corr['ok'])
        counts['dissent_loss_rejected'] += int(not dissent['ok'])
        # Run 55
        limit=e['resource_tree_profile']['parent_budget']; tree=BudgetTree(limit)
        r1=tree.reserve('a',limit//3); r2=tree.reserve('b',limit//3)
        overflow=tree.reserve('c',limit)
        schedule=fair_schedule([{'task_id':'low','priority':0,'age':10},{'task_id':'high','priority':5,'age':0},{'task_id':'mid','priority':2,'age':2}],3)
        counts['budget_conservation_passed'] += int(r1[0] and r2[0] and tree.reserved<=limit)
        counts['budget_oversubscription_rejected'] += int(not overflow[0])
        counts['fairness_windows_passed'] += int(set(schedule)=={'low','mid','high'} and len(schedule)==3)
        # Run 56
        graph=ProofGraph(); contract=f'contract:{mid}'; test=f'test:{mid}'
        graph.add(contract,digest=e['registry_entry_digest_v3'],kind='contract')
        graph.add(test,digest=ps,kind='test'); graph.depends_on(test,contract)
        sparse=graph.select_tests({contract},all_test_ids)
        root_node=f'root:{mid}'; graph.add(root_node,digest='root',kind='root_policy')
        root=graph.select_tests({root_node},all_test_ids)
        prior={'contract_digest':'a','test_digest':'b','fixture_digest':'c','validator_digest':'d','source_digest':'e','passed':True}
        changed=dict(prior); changed['fixture_digest']='changed'
        counts['proof_graph_sparse_selection_passed'] += int(sparse['selected']==[test] and not sparse['forced_full'])
        counts['proof_graph_root_full_selection_passed'] += int(len(root['selected'])==100 and root['forced_full'])
        counts['stale_evidence_reuse_rejected'] += int(not reusable_evidence(prior,changed))
        # Run 57
        receipt=DecisionReceipt(f'd-{n}','HUMAN',True,'ACCEPT',mid,0,100,True)
        current=validate_decision(receipt,required_scope=mid,now_tick=50)
        silence=validate_decision(None,required_scope=mid,now_tick=50)
        expired=validate_decision(receipt,required_scope=mid,now_tick=101)
        revoked=validate_decision(revoke(receipt),required_scope=mid,now_tick=50)
        counts['human_decisions_accepted'] += int(current['ok'])
        counts['silence_consent_rejected'] += int(not silence['ok'])
        counts['expired_decisions_rejected'] += int(not expired['ok'])
        counts['revoked_decisions_rejected'] += int(not revoked['ok'])
        # Run 58
        ic=IncidentController(); tasks=[f'root-{n}',f'child-{n}']; leases=[f'l1-{n}',f'l2-{n}']; ic.trip(tasks,leases,'test')
        stop_ok=not ic.may_act(tasks[1],leases[1])[0]
        no_restart=ic.restart(tasks,leases,human_receipt=None,recovery_checks_passed=True,new_authority_receipt='new')
        restart=ic.restart(tasks,leases,human_receipt=f'human-{n}',recovery_checks_passed=True,new_authority_receipt=f'new-{n}')
        counts['incident_stops_propagated'] += int(stop_ok and len(ic.evidence)>=1)
        counts['incident_unauthorized_restart_rejected'] += int(not no_restart['ok'])
        counts['incident_authorized_restart_passed'] += int(restart['ok'] and ic.may_act(tasks[1],leases[1])[0])
        # Run 59
        tp=e['topology_profile']; routes=frozenset(tp['approved_routes'])
        lock=SeatRouteLock(tp['seat_id'],tp['approved_routes'][0],routes,frozenset({'read','propose'}),2)
        fail=failover(lock,requested_route=tp['approved_routes'][1],claimed_identity=tp['seat_id'],requested_actions={'read'},requested_privacy_scope=1)
        swap=failover(lock,requested_route=tp['approved_routes'][1],claimed_identity='other',requested_actions={'read'},requested_privacy_scope=1)
        split=reconcile_partition({'base_revision':1,'value':'a'},{'base_revision':1,'value':'b'})
        counts['identity_safe_failovers_passed'] += int(fail['ok'] and fail['identity_id']==tp['seat_id'])
        counts['identity_substitutions_rejected'] += int(not swap['ok'])
        counts['split_brain_divergence_held'] += int(not split['ok'])
        # Run 60
        record={'module_id':mid,'name':e['name'],'status':'WORKING_CANDIDATE_NOT_CANON','evidence_summary':f'deterministic harness {ps}',
                'limitations':['Not AXM runtime proof.'],'claims':['deterministic_harness_tested'],
                'raw_prompt':'private','token':'never-export'}
        allow=set(e['disclosure_profile']['allowlist'])
        safe=public_export(record,allowlist=allow,supported_claims={'deterministic_harness_tested'})
        leaky=public_export(record,allowlist=allow|{'raw_prompt'},supported_claims={'deterministic_harness_tested'})
        unsupported=copy.deepcopy(record); unsupported['claims'].append('axm_runtime_proven')
        badclaim=public_export(unsupported,allowlist=allow,supported_claims={'deterministic_harness_tested'})
        counts['public_safe_exports_passed'] += int(safe['ok'] and reidentification_risk(safe['output'],quasi_identifiers={'seat_id','exact_timestamp','device_serial'})['ok'])
        counts['public_private_leaks_rejected'] += int(not leaky['ok'])
        counts['unsupported_claims_rejected'] += int(not badclaim['ok'])
        # Run 61
        orch=DryRunOrchestrator(); flow=orch.execute(task_id=f'task-{n}',authority_ok=True,handoff_accepted=True,independent_verification=True,human_decision='ACCEPT')
        self_approve=DryRunOrchestrator().execute(task_id=f'task-{n}',authority_ok=True,handoff_accepted=True,independent_verification=True,human_decision='ACCEPT',orchestrator_self_approval=True)
        stopped=DryRunOrchestrator(); stopped.stop('human stop'); denied=stopped.execute(task_id=f'task-{n}',authority_ok=True,handoff_accepted=True,independent_verification=True,human_decision='ACCEPT')
        counts['dry_run_flows_completed'] += int(flow['ok'] and not flow['integrated'] and not flow['canon'] and flow['max_status']=='READY_FOR_LOCAL_INTAKE_CANDIDATE')
        counts['orchestrator_self_approval_rejected'] += int(not self_approve['ok'])
        counts['dry_run_stop_controls_passed'] += int(not denied['ok'] and denied['code']=='ORCHESTRATOR_STOPPED')
        per_seed.append({
            'seed_number':n,'module_id':mid,'proof_slice_id':ps,
            'delegation_pass':good['ok'] and not wide['ok'] and not late['ok'],
            'privacy_pass':capsule['ok'] and not laundering['ok'] and redacted['ok'],
            'independence_pass':independent['ok'] and not corr['ok'] and not dissent['ok'],
            'resource_pass':r1[0] and r2[0] and not overflow[0] and len(schedule)==3,
            'proof_graph_pass':sparse['selected']==[test] and len(root['selected'])==100 and not reusable_evidence(prior,changed),
            'human_decision_pass':current['ok'] and not silence['ok'] and not expired['ok'] and not revoked['ok'],
            'incident_pass':stop_ok and not no_restart['ok'] and restart['ok'],
            'topology_pass':fail['ok'] and not swap['ok'] and not split['ok'],
            'disclosure_pass':safe['ok'] and not leaky['ok'] and not badclaim['ok'],
            'orchestrator_pass':flow['ok'] and not self_approve['ok'] and not denied['ok'],
        })
    regression=run_all_v2()
    scenarios=run_scenarios_v3()
    counts_ok=all(v==100 for v in counts.values())
    per_seed_ok=all(all(v for k,v in row.items() if k.endswith('_pass')) for row in per_seed)
    passed=bool(regression['passed'] and counts_ok and per_seed_ok and scenarios['passed'])
    return {'harness_version':'0.3.0','evidence_scope':'DETERMINISTIC_GOVERNANCE_HARNESS_ONLY_NOT_AXM_RUNTIME',
            'v2_regression_passed':regression['passed'],'counts':counts,'scenario_suite_v3':scenarios,
            'per_seed':per_seed,'passed':passed}
