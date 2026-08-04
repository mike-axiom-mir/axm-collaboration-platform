from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def _dominates(a: dict[str,Any], b: dict[str,Any], minimize: list[str], maximize: list[str]) -> bool:
    weak=True; strict=False
    for k in minimize:
        av=float(a.get(k,0)); bv=float(b.get(k,0)); weak=weak and av<=bv; strict=strict or av<bv
    for k in maximize:
        av=float(a.get(k,0)); bv=float(b.get(k,0)); weak=weak and av>=bv; strict=strict or av>bv
    return weak and strict

def compare_counterfactual_plans(plans: list[dict[str,Any]], minimize: list[str]|None=None, maximize: list[str]|None=None) -> dict[str,Any]:
    minimize=list(minimize or ['loss','risk','latency','cost']); maximize=list(maximize or ['coverage','reversibility','proof'])
    eligible=[p for p in plans if not p.get('policy_holds') and p.get('authority_mode')!='shadow_only']; held=[{'id':p.get('id'),'holds':p.get('policy_holds') or (['shadow_authority'] if p.get('authority_mode')=='shadow_only' else [])} for p in plans if p not in eligible]
    frontier=[]; dominated=[]
    for p in eligible:
        dominators=[q for q in eligible if q is not p and _dominates(q,p,minimize,maximize)]
        if dominators: dominated.append({'id':p.get('id'),'dominated_by':sorted(str(q.get('id')) for q in dominators)})
        else: frontier.append(p)
    frontier=sorted(frontier,key=lambda p:str(p.get('id')))
    body={'minimize':minimize,'maximize':maximize,'frontier_ids':[p.get('id') for p in frontier],'dominated':dominated,'held':held,'automatic_selection':False,'executed':False}
    return {'schema':'axm.translation.counterfactual-comparison/v1',**body,'comparison_sha256':_hash(body)}

def build_counterfactual_decision(comparison: dict[str,Any], human_preference: str|None=None) -> dict[str,Any]:
    frontier=list(comparison.get('frontier_ids',[])); holds=[]
    if not frontier: holds.append('no_admissible_frontier')
    if human_preference is not None and human_preference not in frontier: holds.append('preference_not_on_frontier')
    return {'schema':'axm.translation.counterfactual-decision/v1','frontier_ids':frontier,'human_preference':human_preference,'decision':'REVIEWABLE_CHOICE' if not holds else 'HOLD','holds':holds,'selected':human_preference if not holds else None,'automatic_selection':False,'executed':False}

def verify_counterfactual_comparison(comparison: dict[str,Any]) -> dict[str,Any]:
    body={k:comparison.get(k) for k in ('minimize','maximize','frontier_ids','dominated','held','automatic_selection','executed')}; valid=_hash(body)==comparison.get('comparison_sha256') and comparison.get('automatic_selection') is False and comparison.get('executed') is False
    return {'valid':valid,'verdict':'PASS' if valid else 'HOLD'}
