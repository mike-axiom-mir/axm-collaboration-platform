from __future__ import annotations
import hashlib,json
from typing import Any
MISSING=object()

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def _get(value: Any, path: list[Any]) -> Any:
    cur=value
    for part in path:
        if isinstance(cur,dict) and part in cur: cur=cur[part]
        elif isinstance(cur,list) and isinstance(part,int) and 0<=part<len(cur): cur=cur[part]
        else: return MISSING
    return cur

def evaluate_invariants(evidence: dict[str,Any], invariant_specs: list[dict[str,Any]]) -> dict[str,Any]:
    results=[]
    for spec in invariant_specs:
        actual=_get(evidence,list(spec.get('path',[]))); op=str(spec.get('operator','equals')); expected=spec.get('expected'); passed=False
        if op=='present': passed=actual is not MISSING
        elif op=='equals': passed=actual is not MISSING and actual==expected
        elif op=='is_false': passed=actual is False
        elif op=='is_true': passed=actual is True
        elif op=='maximum': passed=actual is not MISSING and isinstance(actual,(int,float)) and not isinstance(actual,bool) and actual<=expected
        elif op=='minimum': passed=actual is not MISSING and isinstance(actual,(int,float)) and not isinstance(actual,bool) and actual>=expected
        elif op=='contains_all': passed=actual is not MISSING and set(expected or []).issubset(set(actual or []))
        elif op=='disjoint': passed=actual is not MISSING and set(expected or []).isdisjoint(set(actual or []))
        results.append({'id':str(spec.get('id','')),'path':list(spec.get('path',[])),'operator':op,'expected':expected,'actual':None if actual is MISSING else actual,'passed':passed,'severity':str(spec.get('severity','blocking'))})
    blocking=[r for r in results if not r['passed'] and r['severity']=='blocking']; advisory=[r for r in results if not r['passed'] and r['severity']!='blocking']
    return {'schema':'axm.translation.invariant-evaluation/v1','results':results,'blocking_failures':blocking,'advisory_failures':advisory,'verdict':'PASS' if not blocking else 'HOLD'}

def build_invariant_checkpoint(evidence: dict[str,Any], invariant_specs: list[dict[str,Any]]) -> dict[str,Any]:
    evaluation=evaluate_invariants(evidence,invariant_specs)
    body={'evidence_sha256':_hash(evidence),'invariant_specs_sha256':_hash(invariant_specs),'evaluation':evaluation,'automatic_promotion':False,'automatic_execution':False}
    return {'schema':'axm.translation.invariant-checkpoint/v1',**body,'checkpoint_sha256':_hash(body),'decision':'REVIEWABLE' if evaluation['verdict']=='PASS' else 'HOLD'}

def verify_invariant_checkpoint(checkpoint: dict[str,Any]) -> dict[str,Any]:
    body={k:checkpoint.get(k) for k in ('evidence_sha256','invariant_specs_sha256','evaluation','automatic_promotion','automatic_execution')}
    valid=_hash(body)==checkpoint.get('checkpoint_sha256')
    coherent=(checkpoint.get('decision')=='REVIEWABLE')==(checkpoint.get('evaluation',{}).get('verdict')=='PASS')
    bounded=checkpoint.get('automatic_promotion') is False and checkpoint.get('automatic_execution') is False
    return {'valid':valid and coherent and bounded,'hash_valid':valid,'coherent':coherent,'bounded':bounded,'verdict':'PASS' if valid and coherent and bounded else 'HOLD'}
