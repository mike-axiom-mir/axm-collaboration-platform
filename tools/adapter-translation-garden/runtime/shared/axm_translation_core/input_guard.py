from __future__ import annotations
import math
from typing import Any

_DEFAULTS={'max_depth':64,'max_nodes':100000,'max_string_bytes':1048576,'max_total_string_bytes':4194304,'max_list_items':100000,'max_mapping_items':100000}


def inspect_json_value(value: Any, budget: dict[str, Any] | None = None) -> dict[str, Any]:
    limits={**_DEFAULTS,**(budget or {})}; errors=[]; stats={'nodes':0,'max_depth':0,'string_bytes':0,'max_string_bytes':0,'lists':0,'mappings':0,'scalars':0}
    stack=[(value,'$',0)]
    while stack:
        current,path,depth=stack.pop(); stats['nodes']+=1; stats['max_depth']=max(stats['max_depth'],depth)
        if stats['nodes']>limits['max_nodes']: errors.append({'path':path,'reason':'max_nodes_exceeded'}); break
        if depth>limits['max_depth']: errors.append({'path':path,'reason':'max_depth_exceeded'}); continue
        if current is None or isinstance(current,(bool,int)):
            stats['scalars']+=1
        elif isinstance(current,float):
            stats['scalars']+=1
            if not math.isfinite(current): errors.append({'path':path,'reason':'non_finite_number'})
        elif isinstance(current,str):
            stats['scalars']+=1; size=len(current.encode('utf-8')); stats['string_bytes']+=size; stats['max_string_bytes']=max(stats['max_string_bytes'],size)
            if size>limits['max_string_bytes']: errors.append({'path':path,'reason':'max_string_bytes_exceeded'})
            if stats['string_bytes']>limits['max_total_string_bytes']: errors.append({'path':path,'reason':'max_total_string_bytes_exceeded'})
        elif isinstance(current,list):
            stats['lists']+=1
            if len(current)>limits['max_list_items']: errors.append({'path':path,'reason':'max_list_items_exceeded'})
            for i,item in reversed(list(enumerate(current))): stack.append((item,f'{path}[{i}]',depth+1))
        elif isinstance(current,dict):
            stats['mappings']+=1
            if len(current)>limits['max_mapping_items']: errors.append({'path':path,'reason':'max_mapping_items_exceeded'})
            for key,item in reversed(list(current.items())):
                if not isinstance(key,str): errors.append({'path':path,'reason':'non_string_mapping_key'}); continue
                stack.append((item,f'{path}.{key}',depth+1))
        else:
            errors.append({'path':path,'reason':'non_json_type','type':type(current).__name__})
    return {'schema':'axm.translation.input-guard/v1','verdict':'ACCEPT' if not errors else 'REFUSE','errors':errors,'stats':stats,'limits':limits,'executed':False}
