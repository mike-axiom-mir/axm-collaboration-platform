from __future__ import annotations
import hashlib
import json
from typing import Any


def _correlation(method: str, params: Any, request_id: str | None) -> str:
    if request_id: return request_id
    raw = json.dumps({'method': method, 'params': params}, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
    return 'rpc-' + hashlib.sha256(raw).hexdigest()[:20]


def request_to_message(method: str, params: Any, *, request_id: str | None = None, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    cid = _correlation(method, params, request_id)
    return {'schema': 'axm.translation.rpc-message/v1', 'kind': 'request', 'correlation_id': cid, 'method': method, 'payload': params, 'metadata': dict(metadata or {}), 'sent': False}


def response_to_message(correlation_id: str, *, result: Any = None, error: dict[str, Any] | None = None) -> dict[str, Any]:
    if error is not None and result is not None: raise ValueError('response cannot contain both result and error')
    return {'schema': 'axm.translation.rpc-message/v1', 'kind': 'response', 'correlation_id': correlation_id, 'ok': error is None, 'payload': result, 'error': error, 'sent': False}


def message_to_response(message: dict[str, Any]) -> dict[str, Any]:
    if message.get('kind') != 'response': return {'verdict': 'REFUSE', 'reason': 'not a response message'}
    return {'verdict': 'OK' if message.get('ok') else 'ERROR', 'request_id': message.get('correlation_id'), 'result': message.get('payload'), 'error': message.get('error')}


def run(method: str, params: Any, **kwargs: Any) -> dict[str, Any]:
    return request_to_message(method, params, **kwargs)
