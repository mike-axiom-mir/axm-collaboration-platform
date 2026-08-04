from __future__ import annotations
from copy import deepcopy
from datetime import datetime
from typing import Any

from axm_translation_core import contract_fingerprint


def _time(value: str) -> datetime:
    text = value[:-1] + '+00:00' if value.endswith('Z') else value
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        raise ValueError('lease times must include an offset or Z')
    return parsed


def create_lease(*, granted_by: str, operations: list[str], target: str, scope: dict[str, Any], issued_at: str, expires_at: str, purpose: str, revocation_id: str, evidence: list[Any] | None = None) -> dict[str, Any]:
    if not granted_by or not operations or not target or not purpose or not revocation_id:
        raise ValueError('granted_by, operations, target, purpose, and revocation_id are required')
    if any(op == '*' or not op for op in operations):
        raise ValueError('wildcard or empty operations are forbidden')
    if _time(expires_at) <= _time(issued_at):
        raise ValueError('expires_at must be after issued_at')
    body = {
        'schema':'axm.translation.authority-lease/v1','granted_by':granted_by,
        'operations':sorted(set(operations)),'target':target,'scope':deepcopy(scope),
        'issued_at':issued_at,'expires_at':expires_at,'purpose':purpose,
        'revocation_id':revocation_id,'evidence':deepcopy(evidence or []),
        'inheritance':False,'delegation':False,
    }
    body['fingerprint'] = contract_fingerprint(body)['digest']
    return body


def _scope_allows(lease_scope: dict[str, Any], request_scope: dict[str, Any]) -> tuple[bool,list[str]]:
    failures=[]
    for key,value in request_scope.items():
        if key not in lease_scope:
            failures.append(f'undeclared scope dimension: {key}')
            continue
        allowed=lease_scope[key]
        if isinstance(allowed,list):
            if value not in allowed: failures.append(f'scope mismatch: {key}')
        elif value != allowed:
            failures.append(f'scope mismatch: {key}')
    return not failures, failures


def evaluate(lease: dict[str, Any], request: dict[str, Any], *, at_time: str, revoked_ids: list[str] | None = None) -> dict[str, Any]:
    checks={}
    unsigned={k:deepcopy(v) for k,v in lease.items() if k!='fingerprint'}
    checks['fingerprint_matches'] = lease.get('fingerprint') == contract_fingerprint(unsigned)['digest']
    now=_time(at_time)
    checks['not_before'] = now >= _time(lease['issued_at'])
    checks['not_expired'] = now < _time(lease['expires_at'])
    checks['not_revoked'] = lease.get('revocation_id') not in set(revoked_ids or [])
    checks['operation'] = request.get('operation') in lease.get('operations',[])
    checks['target'] = request.get('target') == lease.get('target')
    scope_ok, scope_failures = _scope_allows(lease.get('scope',{}), request.get('scope',{}))
    checks['scope'] = scope_ok
    checks['purpose'] = request.get('purpose') == lease.get('purpose')
    checks['no_inheritance'] = lease.get('inheritance') is False and request.get('inherited_from') is None
    allowed=all(checks.values())
    failed=[name for name,ok in checks.items() if not ok]
    return {
        'schema':'axm.translation.authority-lease-decision/v1','allowed':allowed,
        'reason':'Allowed by exact active lease' if allowed else 'Denied: '+', '.join(failed),
        'checks':checks,'scope_failures':scope_failures,'lease_fingerprint':lease.get('fingerprint'),
        'decision_only':True,'authority_not_executed':True,
    }


def run(lease: dict[str, Any], request: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    return evaluate(lease,request,**kwargs)
