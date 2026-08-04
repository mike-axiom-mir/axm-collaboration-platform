from __future__ import annotations
from copy import deepcopy
from typing import Any

from axm_translation_core import add_loss, new_loss_ledger

_DIALECTS={'draft4':'http://json-schema.org/draft-04/schema#','draft7':'http://json-schema.org/draft-07/schema#','2020-12':'https://json-schema.org/draft/2020-12/schema'}
_UNSUPPORTED_DRAFT7={'unevaluatedProperties','unevaluatedItems','dependentSchemas','dependentRequired','prefixItems','$dynamicRef','$dynamicAnchor'}

def detect(schema: dict[str,Any]) -> str:
    uri=schema.get('$schema','')
    if '2020-12' in uri: return '2020-12'
    if 'draft-07' in uri: return 'draft7'
    if 'draft-04' in uri: return 'draft4'
    return 'unknown'

def translate(schema: dict[str,Any], *, target_dialect: str) -> dict[str,Any]:
    if target_dialect not in _DIALECTS: raise ValueError('target dialect must be draft4, draft7, or 2020-12')
    ledger=new_loss_ledger(); source=detect(schema)
    def walk(node: Any, path: str) -> Any:
        if isinstance(node,list): return [walk(v,f'{path}[{i}]') for i,v in enumerate(node)]
        if not isinstance(node,dict): return deepcopy(node)
        out={}; unsupported={}
        for key,value in node.items():
            new_key=key
            if target_dialect=='2020-12' and key=='definitions': new_key='$defs'
            if target_dialect in {'draft4','draft7'} and key=='$defs': new_key='definitions'
            if target_dialect=='draft4' and key=='$id': new_key='id'
            if target_dialect!='draft4' and key=='id' and path=='$': new_key='$id'
            if target_dialect in {'draft4','draft7'} and key in _UNSUPPORTED_DRAFT7:
                unsupported[key]=walk(value,f'{path}.{key}')
                add_loss(ledger,kind='unsupported_schema_keyword',path=f'{path}.{key}',source_value=value,reason=f'{key} is not supported by target {target_dialect}',severity='blocking',reversible=True)
                continue
            out[new_key]=walk(value,f'{path}.{key}')
        if source=='draft4' and target_dialect!='draft4':
            for name in ['Minimum','Maximum']:
                ex='exclusive'+name; base=name[0].lower()+name[1:]
                if out.get(ex) is True and base in out:
                    out[ex]=out.pop(base)
        if unsupported: out['x-axm-unsupported-keywords']=unsupported
        return out
    result=walk(schema,'$'); result['$schema']=_DIALECTS[target_dialect]
    return {'schema':'axm.translation.json-schema-bridge/v1','ok':not ledger['summary']['has_blocking_loss'],'source_dialect':source,'target_dialect':target_dialect,'translated':result,'loss':ledger,'validation_performed':False}

def bundle(schema: dict[str,Any], registry: dict[str,dict[str,Any]]) -> dict[str,Any]:
    refs=set()
    def scan(node: Any):
        if isinstance(node,dict):
            if isinstance(node.get('$ref'),str): refs.add(node['$ref'].split('#')[0])
            for v in node.values(): scan(v)
        elif isinstance(node,list):
            for v in node: scan(v)
    scan(schema); resources={}; unresolved=[]
    queue=[r for r in refs if r]
    seen=set()
    while queue:
        ref=queue.pop(0)
        if ref in seen: continue
        seen.add(ref)
        if ref not in registry:
            unresolved.append(ref); continue
        resources[ref]=deepcopy(registry[ref]); before=set(refs); scan(resources[ref]); queue.extend(sorted(refs-before))
    return {'schema':'axm.translation.json-schema-bundle/v1','root':deepcopy(schema),'resources':resources,'unresolved_refs':sorted(set(unresolved)),'network_fetch_performed':False,'ok':not unresolved}

def run(schema: dict[str,Any], **kwargs: Any) -> dict[str,Any]: return translate(schema,**kwargs)
