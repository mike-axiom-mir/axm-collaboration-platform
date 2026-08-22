from __future__ import annotations
import copy
from typing import Any


def _message(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict): return None
    if '$ref' in value: return {'ref':value['$ref']}
    return {'name':value.get('name'),'title':value.get('title'),'content_type':value.get('contentType'),'headers':copy.deepcopy(value.get('headers')),'payload':copy.deepcopy(value.get('payload')),'correlation_id':copy.deepcopy(value.get('correlationId')),'bindings':copy.deepcopy(value.get('bindings',{}))}


def _refs(value: Any) -> list[str]:
    out=[]
    if isinstance(value,dict):
        if isinstance(value.get('$ref'),str): out.append(value['$ref'])
        for child in value.values(): out.extend(_refs(child))
    elif isinstance(value,list):
        for child in value: out.extend(_refs(child))
    return out


def run(document: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(document,dict): raise TypeError('AsyncAPI document must be an object')
    version=str(document.get('asyncapi',''))
    if not (version.startswith('2.') or version.startswith('3.')):
        return {'verdict':'REFUSE','reason':'only AsyncAPI 2.x/3.x is supported','operations':[],'connected':False}
    operations=[]; errors=[]
    if version.startswith('2.'):
        channels=document.get('channels',{})
        if not isinstance(channels,dict): return {'verdict':'REFUSE','reason':'channels must be object','operations':[],'connected':False}
        for channel_name in sorted(channels):
            channel=channels[channel_name]
            if not isinstance(channel,dict): errors.append({'channel':channel_name,'reason':'channel must be object'}); continue
            for action in ('publish','subscribe'):
                op=channel.get(action)
                if not isinstance(op,dict): continue
                operations.append({'operation_id':op.get('operationId') or f'{action}:{channel_name}','action':action,'channel':channel_name,'message':_message(op.get('message')),'bindings':copy.deepcopy(op.get('bindings',channel.get('bindings',{}))),'declared_security':copy.deepcopy(op.get('security',[])),'performed':False})
    else:
        channels=document.get('channels',{}) if isinstance(document.get('channels',{}),dict) else {}
        ops=document.get('operations',{})
        if not isinstance(ops,dict): return {'verdict':'REFUSE','reason':'operations must be object','operations':[],'connected':False}
        for op_id in sorted(ops):
            op=ops[op_id]
            if not isinstance(op,dict): errors.append({'operation_id':op_id,'reason':'operation must be object'}); continue
            channel_ref=op.get('channel',{}).get('$ref') if isinstance(op.get('channel'),dict) else op.get('channel')
            channel_name=channel_ref.split('/')[-1] if isinstance(channel_ref,str) else None
            channel=channels.get(channel_name,{}) if channel_name else {}
            messages=[]
            for msg in op.get('messages',[]) if isinstance(op.get('messages',[]),list) else []:
                messages.append(_message(msg))
            operations.append({'operation_id':op_id,'action':op.get('action'),'channel':channel_name or channel_ref,'messages':messages,'bindings':copy.deepcopy(op.get('bindings',channel.get('bindings',{}) if isinstance(channel,dict) else {})),'declared_security':copy.deepcopy(op.get('security',[])),'performed':False})
    refs=_refs(document)
    return {'schema':'axm.translation.asyncapi-import/v1','verdict':'IMPORTED' if operations and not errors else ('PARTIAL' if operations else 'REFUSE'),'asyncapi_version':version,'operations':operations,'errors':errors,'external_references_unresolved':[r for r in refs if not r.startswith('#/')],'authority_granted':False,'connected':False,'source_preserved':copy.deepcopy(document)}
