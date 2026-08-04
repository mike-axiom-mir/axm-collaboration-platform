from __future__ import annotations
import copy
from typing import Any

_VALID = {'pending': {'start': 'running', 'cancel': 'cancelled'}, 'running': {'complete': 'completed', 'fail': 'failed', 'cancel': 'cancelled'}, 'completed': {}, 'failed': {'retry': 'pending'}, 'cancelled': {}}


def create_job(call: dict[str, Any], *, job_id: str, retry_limit: int = 0) -> dict[str, Any]:
    return {'schema': 'axm.translation.async-job/v1', 'job_id': job_id, 'state': 'pending', 'call': copy.deepcopy(call), 'attempt': 0, 'retry_limit': int(retry_limit), 'history': [], 'executed': False}


def transition(job: dict[str, Any], event: str, *, result: Any = None, error: Any = None) -> dict[str, Any]:
    state = job.get('state')
    target = _VALID.get(state, {}).get(event)
    if target is None: return {'verdict': 'REFUSE', 'reason': f'invalid transition {state}->{event}', 'job': copy.deepcopy(job)}
    out = copy.deepcopy(job)
    if event == 'retry':
        if out.get('attempt', 0) >= out.get('retry_limit', 0): return {'verdict': 'REFUSE', 'reason': 'retry limit reached', 'job': out}
        out['attempt'] = out.get('attempt', 0) + 1
    out['state'] = target
    out.setdefault('history', []).append({'event': event, 'from': state, 'to': target})
    if result is not None: out['result'] = copy.deepcopy(result)
    if error is not None: out['error'] = copy.deepcopy(error)
    return {'verdict': 'TRANSITIONED', 'job': out}


def run(call: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    return create_job(call, **kwargs)
