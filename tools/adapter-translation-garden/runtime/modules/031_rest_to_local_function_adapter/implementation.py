from __future__ import annotations
from typing import Any


def compile_binding(operation: dict[str, Any], function_catalog: dict[str, dict[str, Any]], *, function_name: str | None = None, parameter_map: dict[str, str] | None = None) -> dict[str, Any]:
    op_id = operation.get('operationId') or operation.get('operation_id')
    selected = function_name or op_id
    if not selected or selected not in function_catalog:
        return {'verdict': 'REFUSE', 'reason': 'declared local function not found', 'binding': None, 'invoked': False}
    parameter_map = dict(parameter_map or {})
    params = []
    for p in operation.get('parameters', []):
        name = p.get('name')
        params.append({'source': p.get('in', 'query'), 'name': name, 'argument': parameter_map.get(name, name), 'required': bool(p.get('required'))})
    return {'schema': 'axm.translation.rest-local-binding/v1', 'verdict': 'BOUND', 'binding': {'method': str(operation.get('method', 'GET')).upper(), 'path': operation.get('path', '/'), 'operation_id': op_id, 'function': selected, 'parameters': params, 'accepts_body': bool(operation.get('requestBody'))}, 'invoked': False}


def build_call(request: dict[str, Any], binding: dict[str, Any]) -> dict[str, Any]:
    kwargs, missing = {}, []
    for p in binding.get('parameters', []):
        container = request.get(p['source'], {})
        if p['name'] in container: kwargs[p['argument']] = container[p['name']]
        elif p['required']: missing.append(p['name'])
    if binding.get('accepts_body'): kwargs['body'] = request.get('body')
    return {'schema': 'axm.translation.local-call-plan/v1', 'verdict': 'REFUSE' if missing else 'CALL_PLAN_READY', 'function': binding.get('function'), 'kwargs': kwargs, 'missing': missing, 'invoked': False}


def run(operation: dict[str, Any], function_catalog: dict[str, dict[str, Any]], **kwargs: Any) -> dict[str, Any]:
    return compile_binding(operation, function_catalog, **kwargs)
