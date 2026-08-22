from __future__ import annotations
import copy
from typing import Any


def run(component: dict[str, Any], *, host_capabilities: dict[str, Any], grants: list[str], limits: dict[str, Any]) -> dict[str, Any]:
    imports=component.get('imports',[]) if isinstance(component.get('imports',[]),list) else []
    exports=component.get('exports',[]) if isinstance(component.get('exports',[]),list) else []
    grant_set=set(grants); errors=[]; bindings=[]
    for item in imports:
        if not isinstance(item,dict) or not item.get('name'): errors.append({'reason':'invalid import descriptor'}); continue
        name=item['name']; required_cap=item.get('capability')
        if name not in host_capabilities: errors.append({'import':name,'reason':'unsupported import'}); continue
        if required_cap and required_cap not in grant_set: errors.append({'import':name,'reason':'missing explicit grant','capability':required_cap}); continue
        bindings.append({'import':name,'host_binding':copy.deepcopy(host_capabilities[name]),'granted_capability':required_cap})
    normalized_limits={}
    for key in ('memory_bytes','fuel','wall_time_ms','open_resources'):
        value=limits.get(key)
        if value is not None:
            if not isinstance(value,int) or value<=0: errors.append({'limit':key,'reason':'must be positive integer'})
            else: normalized_limits[key]=value
    verdict='PLAN_READY' if not errors else ('PARTIAL' if bindings else 'REFUSE')
    return {'schema':'axm.translation.wasm-host-plan/v1','verdict':verdict,'component_id':component.get('id'),'bindings':bindings,'exports':copy.deepcopy(exports),'grants':sorted(grant_set),'limits':normalized_limits,'errors':errors,'instantiated':False,'executed':False}
