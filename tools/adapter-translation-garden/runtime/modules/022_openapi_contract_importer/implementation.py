from __future__ import annotations
import copy
from typing import Any

_METHODS = {'get','put','post','delete','options','head','patch','trace'}


def _refs(value: Any, pointer: str = '#') -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    if isinstance(value, dict):
        if isinstance(value.get('$ref'), str): out.append({'at': pointer, 'ref': value['$ref'], 'scope': 'local' if value['$ref'].startswith('#/') else 'external'})
        for key, child in value.items(): out.extend(_refs(child, f'{pointer}/{key}'))
    elif isinstance(value, list):
        for i, child in enumerate(value): out.extend(_refs(child, f'{pointer}/{i}'))
    return out


def run(document: dict[str, Any], *, allowed_methods: list[str] | None = None) -> dict[str, Any]:
    if not isinstance(document, dict): raise TypeError('OpenAPI document must be an object')
    version = str(document.get('openapi', ''))
    if not version.startswith('3.'):
        return {'verdict':'REFUSE','reason':'only OpenAPI 3.x is supported','operations':[],'authority_granted':False}
    allow = {m.lower() for m in (allowed_methods or sorted(_METHODS))}
    operations, errors, seen = [], [], set()
    paths = document.get('paths', {})
    if not isinstance(paths, dict): return {'verdict':'REFUSE','reason':'paths must be an object','operations':[],'authority_granted':False}
    for path in sorted(paths):
        item = paths[path]
        if not isinstance(path, str) or not path.startswith('/') or not isinstance(item, dict):
            errors.append({'path':path,'reason':'invalid path item'}); continue
        inherited = copy.deepcopy(item.get('parameters', [])) if isinstance(item.get('parameters', []), list) else []
        for method in sorted(_METHODS & set(item)):
            if method not in allow: continue
            op = item[method]
            if not isinstance(op, dict): errors.append({'path':path,'method':method,'reason':'operation must be object'}); continue
            operation_id = op.get('operationId') or f'{method}:{path}'
            if operation_id in seen:
                errors.append({'path':path,'method':method,'reason':'duplicate operationId','operation_id':operation_id}); continue
            seen.add(operation_id)
            params = inherited + (copy.deepcopy(op.get('parameters', [])) if isinstance(op.get('parameters', []), list) else [])
            operations.append({
                'operation_id': operation_id, 'method': method.upper(), 'path': path,
                'summary': op.get('summary'), 'tags': copy.deepcopy(op.get('tags', [])),
                'parameters': params, 'request_body': copy.deepcopy(op.get('requestBody')),
                'responses': copy.deepcopy(op.get('responses', {})),
                'declared_security': copy.deepcopy(op.get('security', document.get('security', []))),
                'deprecated': bool(op.get('deprecated', False)),
                'vendor_extensions': {k:copy.deepcopy(v) for k,v in op.items() if str(k).startswith('x-')},
                'invoked': False,
            })
    refs = _refs(document)
    external = [r for r in refs if r['scope']=='external']
    verdict = 'IMPORTED' if operations and not errors else ('PARTIAL' if operations else 'REFUSE')
    return {'schema':'axm.translation.openapi-import/v1','verdict':verdict,'openapi_version':version,'operations':operations,'errors':errors,'references':refs,'external_references_unresolved':external,'authority_granted':False,'network_access':False,'source_preserved':copy.deepcopy(document)}
