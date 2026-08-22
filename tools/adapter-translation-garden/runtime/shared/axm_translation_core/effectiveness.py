from __future__ import annotations
from typing import Any

DEFAULT_WEIGHTS={'expected_value':0.28,'coverage_gain':0.20,'risk_reduction':0.22,'reuse':0.15,'reversibility':0.15,'complexity':0.42,'compute_cost':0.30,'coupling':0.28}
METRICS=('expected_value','coverage_gain','risk_reduction','reuse','reversibility','complexity','compute_cost','coupling')

def _metric(candidate: dict[str,Any], name: str) -> float:
    value=candidate.get(name)
    if isinstance(value,bool) or not isinstance(value,(int,float)):
        raise ValueError(name+' must be numeric')
    value=float(value)
    if value<0 or value>1:
        raise ValueError(name+' must be between 0 and 1')
    return value

def score_steward_candidate(candidate: dict[str,Any], weights: dict[str,float]|None=None) -> dict[str,Any]:
    weights={**DEFAULT_WEIGHTS,**(weights or {})}; issues=[]
    if not isinstance(candidate.get('id'),str) or not candidate.get('id'): issues.append('missing id')
    values={}
    for name in METRICS:
        try: values[name]=_metric(candidate,name)
        except ValueError as exc: issues.append(str(exc))
    if issues:
        return {'schema':'axm.translation.steward-candidate-score/v1','id':candidate.get('id'),'verdict':'HOLD','issues':issues,'score':None}
    benefit=sum(values[k]*weights[k] for k in ('expected_value','coverage_gain','risk_reduction','reuse','reversibility'))
    burden=sum(values[k]*weights[k] for k in ('complexity','compute_cost','coupling'))
    score=benefit/(1.0+burden)
    return {'schema':'axm.translation.steward-candidate-score/v1','id':candidate['id'],'verdict':'REVIEWABLE','issues':[],'benefit':round(benefit,8),'burden':round(burden,8),'score':round(score,8),'metrics':values,'heuristic_only':True}

def rank_steward_candidates(candidates: list[dict[str,Any]], weights: dict[str,float]|None=None, minimum_score: float=0.0) -> dict[str,Any]:
    scored=[score_steward_candidate(c,weights) for c in candidates]
    reviewable=[x for x in scored if x['verdict']=='REVIEWABLE' and x['score']>=minimum_score]
    reviewable.sort(key=lambda x:(-x['score'],x['burden'],x['id']))
    held=[x for x in scored if x not in reviewable]
    return {'schema':'axm.translation.steward-ranking/v1','ranked':reviewable,'held':held,'candidate_count':len(candidates),'automatic_execution':False,'heuristic_only':True}

def compare_steward_checkpoints(before: dict[str,Any], after: dict[str,Any]) -> dict[str,Any]:
    keys=('tests','capability_systems','proof_gates','authority_violations','complexity_units','shadow_locks')
    delta={k:float(after.get(k,0))-float(before.get(k,0)) for k in keys}
    gain=max(0.0,delta['capability_systems'])+max(0.0,delta['proof_gates'])+max(0.0,delta['tests'])/20.0
    burden=max(0.0,delta['complexity_units'])
    effective_gain=gain/(1.0+burden)
    authority_stable=delta['authority_violations']<=0 and delta['shadow_locks']==0
    return {'schema':'axm.translation.steward-effectiveness-comparison/v1','before':before,'after':after,'delta':delta,'effective_gain':round(effective_gain,8),'authority_stable':authority_stable,'structural_measure_not_runtime_benchmark':True}

def effectiveness_gate(comparison: dict[str,Any], minimum_effective_gain: float=0.0) -> dict[str,Any]:
    holds=[]
    if not comparison.get('authority_stable'): holds.append('authority_changed')
    if comparison.get('delta',{}).get('capability_systems',0)<=0: holds.append('no_capability_gain')
    if comparison.get('effective_gain',0)<minimum_effective_gain: holds.append('below_effectiveness_floor')
    return {'schema':'axm.translation.effectiveness-gate/v1','decision':'REVIEWABLE' if not holds else 'HOLD','holds':holds,'automatic_action':False}
