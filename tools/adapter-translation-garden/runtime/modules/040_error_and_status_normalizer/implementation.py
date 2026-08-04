from __future__ import annotations
from typing import Any

_HTTP = {200:'OK',201:'OK',202:'OK',204:'OK',400:'INVALID',401:'UNAUTHORIZED',403:'FORBIDDEN',404:'NOT_FOUND',408:'TIMEOUT',409:'CONFLICT',429:'RATE_LIMITED',500:'INTERNAL',502:'UNAVAILABLE',503:'UNAVAILABLE',504:'TIMEOUT'}
_GRPC = {0:'OK',1:'CANCELLED',2:'UNKNOWN',3:'INVALID',4:'TIMEOUT',5:'NOT_FOUND',6:'CONFLICT',7:'FORBIDDEN',8:'RATE_LIMITED',13:'INTERNAL',14:'UNAVAILABLE',16:'UNAUTHORIZED'}
_RETRY = {'TIMEOUT', 'RATE_LIMITED', 'UNAVAILABLE'}


def run(source_system: str, status: Any, *, message: str | None = None, extension_map: dict[str, str] | None = None) -> dict[str, Any]:
    code = None
    if extension_map and str(status) in extension_map: code = extension_map[str(status)]
    elif source_system == 'http':
        try: code = _HTTP.get(int(status))
        except (ValueError, TypeError): pass
    elif source_system == 'grpc':
        try: code = _GRPC.get(int(status))
        except (ValueError, TypeError): pass
    elif source_system == 'process':
        try: code = 'OK' if int(status) == 0 else 'PROCESS_FAILURE'
        except (ValueError, TypeError): pass
    code = code or 'UNKNOWN'
    return {'schema': 'axm.translation.normalized-status/v1', 'code': code, 'ok': code == 'OK', 'retryable_hint': code in _RETRY, 'source': {'system': source_system, 'status': status, 'message': message}, 'action_performed': False}
