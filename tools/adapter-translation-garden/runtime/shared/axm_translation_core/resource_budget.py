from __future__ import annotations
from typing import Any

def evaluate_resource_budget(usage: dict[str,Any], budget: dict[str,Any]) -> dict[str,Any]:
    errors=[]; checks={}
    for metric,limit in budget.items():
        observed=usage.get(metric)
        if not isinstance(limit,(int,float)) or isinstance(limit,bool) or limit<0: errors.append({'metric':metric,'reason':'invalid_limit'}); continue
        if not isinstance(observed,(int,float)) or isinstance(observed,bool) or observed<0: errors.append({'metric':metric,'reason':'missing_or_invalid_usage','observed':observed}); continue
        passed=float(observed)<=float(limit); checks[metric]={'observed':observed,'limit':limit,'passed':passed}
        if not passed: errors.append({'metric':metric,'reason':'budget_exceeded','observed':observed,'limit':limit})
    return {'schema':'axm.translation.resource-budget/v1','verdict':'WITHIN_BUDGET' if not errors else 'REFUSE','checks':checks,'errors':errors,'measured':False,'executed':False}

def evaluate_output_expansion(*, input_bytes: int, output_bytes: int, max_output_bytes: int, max_expansion_ratio: float) -> dict[str,Any]:
    values=(input_bytes,output_bytes,max_output_bytes,max_expansion_ratio)
    if any(not isinstance(v,(int,float)) or isinstance(v,bool) or v<0 for v in values): return {'verdict':'REFUSE','reason':'invalid_non_negative_values','executed':False}
    ratio=float(output_bytes)/max(float(input_bytes),1.0); errors=[]
    if output_bytes>max_output_bytes: errors.append('max_output_bytes_exceeded')
    if ratio>max_expansion_ratio: errors.append('max_expansion_ratio_exceeded')
    return {'schema':'axm.translation.output-expansion/v1','verdict':'WITHIN_BUDGET' if not errors else 'REFUSE','input_bytes':input_bytes,'output_bytes':output_bytes,'expansion_ratio':ratio,'limits':{'max_output_bytes':max_output_bytes,'max_expansion_ratio':max_expansion_ratio},'errors':errors,'measured':False,'executed':False}
