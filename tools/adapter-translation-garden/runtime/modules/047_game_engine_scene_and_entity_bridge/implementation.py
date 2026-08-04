from __future__ import annotations
import copy
from typing import Any


def run(scene: dict[str, Any], *, component_map: dict[str,str], target_capabilities: list[str], unsupported_policy: str = 'sidecar') -> dict[str, Any]:
    entities=scene.get('entities',[]) if isinstance(scene.get('entities',[]),list) else []
    ids=set(); output=[]; sidecars=[]; losses=[]; errors=[]; caps=set(target_capabilities)
    for entity in entities:
        if not isinstance(entity,dict) or not entity.get('id'): errors.append({'reason':'entity missing id'}); continue
        eid=str(entity['id'])
        if eid in ids: errors.append({'entity_id':eid,'reason':'duplicate id'}); continue
        ids.add(eid); mapped=[]; unsupported=[]
        for comp in entity.get('components',[]) if isinstance(entity.get('components',[]),list) else []:
            if not isinstance(comp,dict) or not comp.get('type'): unsupported.append(copy.deepcopy(comp)); continue
            source_type=comp['type']; target_type=component_map.get(source_type)
            if target_type and target_type in caps: mapped.append({'type':target_type,'source_type':source_type,'data':copy.deepcopy(comp.get('data',{}))})
            else: unsupported.append(copy.deepcopy(comp)); losses.append({'entity_id':eid,'component':source_type,'kind':'unsupported_component','severity':'blocking' if unsupported_policy=='refuse' else 'visible'})
        if unsupported:
            if unsupported_policy=='refuse': errors.append({'entity_id':eid,'reason':'unsupported components'})
            else: sidecars.append({'entity_id':eid,'components':unsupported})
        output.append({'id':eid,'name':entity.get('name'),'parent_id':entity.get('parent_id'),'components':mapped})
    for entity in output:
        if entity['parent_id'] is not None and str(entity['parent_id']) not in ids: errors.append({'entity_id':entity['id'],'reason':'missing parent'})
    return {'schema':'axm.translation.engine-scene-plan/v1','verdict':'PLAN_READY' if not errors else ('PARTIAL' if output else 'REFUSE'),'target_scene':{'name':scene.get('name'),'entities':output},'sidecars':sidecars,'losses':losses,'errors':errors,'written':False,'engine_loaded':False}
