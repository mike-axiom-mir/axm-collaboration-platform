from __future__ import annotations
from typing import Any

def analyze_failure_blast_radius(plan: dict[str,Any], failed_modules: list[str], shared_resources: list[dict[str,Any]]|None=None) -> dict[str,Any]:
    nodes=set(map(str,plan.get('selected_modules',[]))); failed=set(map(str,failed_modules)) & nodes
    outgoing={n:set() for n in nodes}
    for edge in plan.get('edges',[]):
        if isinstance(edge,(list,tuple)) and len(edge)==2 and str(edge[0]) in nodes and str(edge[1]) in nodes: outgoing[str(edge[0])].add(str(edge[1]))
    impacted=set(failed); frontier=list(failed)
    while frontier:
        current=frontier.pop(0)
        for nxt in sorted(outgoing.get(current,set())):
            if nxt not in impacted: impacted.add(nxt); frontier.append(nxt)
    resource_impacts=[]
    for resource in shared_resources or []:
        members=set(map(str,resource.get('modules',[]))) & nodes
        if failed & members and str(resource.get('isolation','shared'))!='dedicated':
            newly=members-impacted; impacted.update(members)
            resource_impacts.append({'resource_id':resource.get('id'),'modules':sorted(members),'newly_impacted':sorted(newly)})
    unaffected=nodes-impacted
    ratio=(len(impacted)/len(nodes)) if nodes else 0.0
    return {'schema':'axm.translation.failure-blast-radius/v1','failed':sorted(failed),'impacted':sorted(impacted),'unaffected':sorted(unaffected),'resource_impacts':resource_impacts,'blast_radius_ratio':round(ratio,8),'executed_actions':False}

def build_containment_plan(analysis: dict[str,Any], max_blast_radius_ratio: float=0.5) -> dict[str,Any]:
    impacted=list(analysis.get('impacted',[])); unaffected=list(analysis.get('unaffected',[])); ratio=float(analysis.get('blast_radius_ratio',0))
    holds=[]
    if not impacted: holds.append('no_failed_or_impacted_modules')
    if ratio>max_blast_radius_ratio: holds.append('blast_radius_above_limit')
    return {'schema':'axm.translation.failure-containment-plan/v1','quarantine_candidates':impacted,'preserve_candidates':unaffected,'steps':['freeze_plan','preserve_evidence','quarantine_impacted_candidates','review_shared_resources','human_decide_retry_or_rollback'],'holds':holds,'decision':'REVIEWABLE_CONTAINMENT' if not holds else 'HOLD','automatic_stop':False,'automatic_retry':False,'automatic_rollback':False,'executed':False}

def containment_gate(analysis: dict[str,Any], plan: dict[str,Any]) -> dict[str,Any]:
    holds=list(plan.get('holds',[]))
    if set(analysis.get('impacted',[]))!=set(plan.get('quarantine_candidates',[])): holds.append('quarantine_mismatch')
    if any(plan.get(k) is not False for k in ('automatic_stop','automatic_retry','automatic_rollback','executed')): holds.append('automatic_authority')
    return {'schema':'axm.translation.containment-gate/v1','decision':'REVIEWABLE' if not holds else 'HOLD','holds':holds}
