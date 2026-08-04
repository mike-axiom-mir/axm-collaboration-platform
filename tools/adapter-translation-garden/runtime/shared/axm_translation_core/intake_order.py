from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def plan_local_intake(selected_module_ids: list[str], manifests: list[dict[str,Any]], shadow_module_ids: list[str], max_batch_size: int=10) -> dict[str,Any]:
    if max_batch_size<1: raise ValueError('max_batch_size')
    by_id={str(m.get('id') or m.get('module_id')):m for m in manifests}; selected=sorted(set(map(str,selected_module_ids))); closure=set(); missing=set(); cycles=set(); visiting=set(); visited=set()
    def visit(mid: str):
        if mid in visiting: cycles.add(mid); return
        if mid in visited: return
        m=by_id.get(mid)
        if m is None: missing.add(mid); return
        visiting.add(mid)
        for dep in m.get('hard_dependencies',[]): visit(str(dep))
        visiting.remove(mid); visited.add(mid); closure.add(mid)
    for mid in selected: visit(mid)
    shadow=sorted(set(closure)&set(map(str,shadow_module_ids))); order=[]; temp=set(); perm=set()
    def topo(mid: str):
        if mid in perm or mid not in closure: return
        if mid in temp: cycles.add(mid); return
        temp.add(mid)
        for dep in by_id[mid].get('hard_dependencies',[]): topo(str(dep))
        temp.remove(mid); perm.add(mid); order.append(mid)
    for mid in sorted(closure): topo(mid)
    batches=[order[i:i+max_batch_size] for i in range(0,len(order),max_batch_size)]
    body={'selected_module_ids':selected,'dependency_closure':sorted(closure),'missing_module_ids':sorted(missing),'cycle_module_ids':sorted(cycles),'shadow_module_ids':shadow,'ordered_module_ids':order,'batches':[{'batch':i+1,'module_ids':b} for i,b in enumerate(batches)],'decision':'READY_FOR_STAGED_INTAKE' if not missing and not cycles and not shadow else 'HOLD','automatic_install':False,'default_enabled':False}
    return {'schema':'axm.translation.local-intake-order-plan/v1',**body,'plan_sha256':_hash(body)}

def verify_local_intake_order(plan: dict[str,Any], manifests: list[dict[str,Any]]) -> dict[str,Any]:
    body={k:plan.get(k) for k in ('selected_module_ids','dependency_closure','missing_module_ids','cycle_module_ids','shadow_module_ids','ordered_module_ids','batches','decision','automatic_install','default_enabled')}; errors=[]
    if _hash(body)!=plan.get('plan_sha256'): errors.append('hash')
    pos={m:i for i,m in enumerate(plan.get('ordered_module_ids',[]))}; by_id={str(m.get('id') or m.get('module_id')):m for m in manifests}
    for mid in plan.get('ordered_module_ids',[]):
        for dep in by_id.get(mid,{}).get('hard_dependencies',[]):
            if dep in pos and pos[dep]>pos[mid]: errors.append('dependency_order')
    if plan.get('automatic_install') is not False or plan.get('default_enabled') is not False: errors.append('authority')
    if plan.get('decision')=='READY_FOR_STAGED_INTAKE' and (plan.get('missing_module_ids') or plan.get('cycle_module_ids') or plan.get('shadow_module_ids')): errors.append('decision')
    return {'schema':'axm.translation.local-intake-order-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':sorted(set(errors))}
