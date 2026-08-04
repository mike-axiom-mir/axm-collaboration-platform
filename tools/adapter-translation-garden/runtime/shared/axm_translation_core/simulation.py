from __future__ import annotations
import copy,hashlib,json
from typing import Any

MISSING=object()

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def _nodes(value: Any) -> int:
    if isinstance(value,dict): return 1+sum(_nodes(k)+_nodes(v) for k,v in value.items())
    if isinstance(value,list): return 1+sum(_nodes(v) for v in value)
    return 1

def _get(root: Any, path: list[Any]) -> Any:
    cur=root
    for part in path:
        if isinstance(cur,dict) and part in cur: cur=cur[part]
        elif isinstance(cur,list) and isinstance(part,int) and 0<=part<len(cur): cur=cur[part]
        else: return MISSING
    return cur

def _parent(root: Any, path: list[Any]) -> tuple[Any,Any]:
    if not path: raise ValueError('empty path')
    cur=root
    for part in path[:-1]:
        if isinstance(cur,dict):
            if part not in cur or not isinstance(cur[part],(dict,list)): cur[part]={}
            cur=cur[part]
        elif isinstance(cur,list) and isinstance(part,int) and 0<=part<len(cur): cur=cur[part]
        else: raise ValueError('invalid path')
    return cur,path[-1]

def _set(root: Any, path: list[Any], value: Any) -> None:
    parent,key=_parent(root,path)
    if isinstance(parent,dict): parent[key]=copy.deepcopy(value)
    elif isinstance(parent,list) and isinstance(key,int) and 0<=key<len(parent): parent[key]=copy.deepcopy(value)
    else: raise ValueError('invalid set target')

def _delete(root: Any, path: list[Any]) -> bool:
    parent,key=_parent(root,path)
    if isinstance(parent,dict) and key in parent: del parent[key]; return True
    if isinstance(parent,list) and isinstance(key,int) and 0<=key<len(parent): parent.pop(key); return True
    return False

def simulate_declared_plan(initial_state: Any, steps: list[dict[str,Any]], max_steps: int=100, max_state_nodes: int=10000) -> dict[str,Any]:
    if max_steps<0 or max_state_nodes<1: return {'schema':'axm.translation.declarative-simulation/v1','decision':'HOLD','holds':['invalid_limits'],'executed_modules':False}
    if len(steps)>max_steps: return {'schema':'axm.translation.declarative-simulation/v1','decision':'HOLD','holds':['step_limit'],'executed_modules':False}
    state=copy.deepcopy(initial_state); trace=[]; losses=[]; holds=[]
    allowed={'set','copy','rename','delete','assert_equal'}
    for index,step in enumerate(steps):
        op=str(step.get('op','')); record={'index':index,'id':str(step.get('id',index)),'op':op,'status':'PASS'}
        try:
            if op not in allowed: raise ValueError('unsupported_operation')
            if op=='set': _set(state,list(step.get('path',[])),step.get('value'))
            elif op=='copy':
                value=_get(state,list(step.get('from',[])))
                if value is MISSING: raise ValueError('copy_source_missing')
                _set(state,list(step.get('to',[])),value)
            elif op=='rename':
                source=list(step.get('from',[])); value=_get(state,source)
                if value is MISSING: raise ValueError('rename_source_missing')
                _set(state,list(step.get('to',[])),value); _delete(state,source)
            elif op=='delete':
                removed=_delete(state,list(step.get('path',[])))
                if removed: losses.append({'step_id':record['id'],'kind':'explicit_delete','path':list(step.get('path',[])),'acknowledged':bool(step.get('acknowledged_loss',False))})
                elif step.get('required',False): raise ValueError('delete_target_missing')
            elif op=='assert_equal':
                actual=_get(state,list(step.get('path',[])))
                if actual is MISSING or actual!=step.get('expected'): raise ValueError('assertion_failed')
            if _nodes(state)>max_state_nodes: raise ValueError('state_node_limit')
        except (ValueError,TypeError,IndexError) as exc:
            record['status']='HOLD'; record['reason']=str(exc); holds.append({'step_id':record['id'],'reason':str(exc)})
        trace.append(record)
        if holds: break
    body={'input_sha256':_hash(initial_state),'steps_sha256':_hash(steps),'output_state':state,'output_sha256':_hash(state),'trace':trace,'losses':losses,'holds':holds,'limits':{'max_steps':max_steps,'max_state_nodes':max_state_nodes},'executed_modules':False,'external_effects':False}
    return {'schema':'axm.translation.declarative-simulation/v1',**body,'simulation_sha256':_hash(body),'decision':'REVIEWABLE_SIMULATION' if not holds else 'HOLD'}

def compare_simulation_outcomes(left: dict[str,Any], right: dict[str,Any]) -> dict[str,Any]:
    equal=left.get('output_sha256')==right.get('output_sha256') and left.get('losses')==right.get('losses')
    return {'schema':'axm.translation.simulation-comparison/v1','equal':equal,'left_output_sha256':left.get('output_sha256'),'right_output_sha256':right.get('output_sha256'),'executed_modules':False}

def simulation_gate(simulation: dict[str,Any], require_acknowledged_loss: bool=True) -> dict[str,Any]:
    holds=list(simulation.get('holds',[]))
    if simulation.get('executed_modules') is not False or simulation.get('external_effects') is not False: holds.append({'reason':'authority_boundary'})
    if require_acknowledged_loss and any(not x.get('acknowledged') for x in simulation.get('losses',[])): holds.append({'reason':'unacknowledged_loss'})
    return {'schema':'axm.translation.simulation-gate/v1','decision':'REVIEWABLE' if not holds else 'HOLD','holds':holds,'automatic_apply':False}
