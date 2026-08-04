from __future__ import annotations
import copy,json
from typing import Any

def _canonical(value: Any) -> str:
    return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False)

def generate_metamorphic_cases(value: Any, relations: list[str]|None=None, max_cases: int=16) -> dict[str,Any]:
    enabled=set(relations or ['exact_repeat','dict_key_order','list_copy','whitespace_boundary','numeric_identity','null_identity']); cases=[]
    def add(relation: str, transformed: Any) -> None:
        if relation in enabled and len(cases)<max_cases: cases.append({'case_id':f'{relation}:{len(cases):02d}','relation':relation,'base_input':copy.deepcopy(value),'transformed_input':copy.deepcopy(transformed),'expected_relation':'equal_output'})
    add('exact_repeat',value)
    if isinstance(value,dict) and len(value)>1: add('dict_key_order',{k:value[k] for k in reversed(list(value.keys()))})
    if isinstance(value,list): add('list_copy',list(value))
    if isinstance(value,str): add('whitespace_boundary',' '+value+' ')
    if isinstance(value,(int,float)) and not isinstance(value,bool): add('numeric_identity',value+0)
    if value is None: add('null_identity',None)
    return {'schema':'axm.translation.metamorphic-case-set/v1','cases':cases,'case_count':len(cases),'max_cases':max_cases,'executed_module':False}

def evaluate_metamorphic_observations(case_set: dict[str,Any], observations: dict[str,dict[str,Any]]) -> dict[str,Any]:
    results=[]
    for case in case_set.get('cases',[]):
        cid=case['case_id']; obs=observations.get(cid)
        if obs is None: results.append({'case_id':cid,'relation':case['relation'],'status':'MISSING'}); continue
        try: equal=_canonical(obs.get('base_output'))==_canonical(obs.get('transformed_output'))
        except (TypeError,ValueError): equal=False
        results.append({'case_id':cid,'relation':case['relation'],'status':'PASS' if equal else 'FAIL'})
    failures=[r for r in results if r['status']=='FAIL']; missing=[r for r in results if r['status']=='MISSING']
    return {'schema':'axm.translation.metamorphic-observation-report/v1','results':results,'failures':failures,'missing':missing,'observed':len(results)-len(missing),'verdict':'PASS' if not failures and not missing and results else 'HOLD','executed_module':False}

def metamorphic_gate(report: dict[str,Any], minimum_observed: int=1) -> dict[str,Any]:
    holds=[]
    if report.get('failures'): holds.append('relation_failures')
    if report.get('missing'): holds.append('missing_observations')
    if int(report.get('observed',0))<minimum_observed: holds.append('insufficient_observations')
    return {'schema':'axm.translation.metamorphic-gate/v1','decision':'REVIEWABLE' if not holds else 'HOLD','holds':holds,'automatic_promotion':False}
