from __future__ import annotations
import copy
from typing import Any


def enqueue(queue: list[dict[str, Any]], payload: Any, *, item_id: str, idempotency_key: str, sequence: int, created_at: str) -> dict[str, Any]:
    if any(x.get('item_id') == item_id for x in queue): return {'verdict': 'REFUSE', 'reason': 'duplicate item_id', 'queue': copy.deepcopy(queue)}
    if any(x.get('idempotency_key') == idempotency_key for x in queue): return {'verdict': 'DUPLICATE', 'reason': 'idempotency key already queued', 'queue': copy.deepcopy(queue)}
    out = copy.deepcopy(queue)
    out.append({'item_id': item_id, 'idempotency_key': idempotency_key, 'sequence': int(sequence), 'created_at': created_at, 'payload': copy.deepcopy(payload), 'state': 'pending'})
    return {'verdict': 'ENQUEUED', 'queue': out, 'persisted': False}


def plan_replay(queue: list[dict[str, Any]], *, acknowledged_keys: list[str] | None = None, limit: int | None = None) -> dict[str, Any]:
    seen = set(acknowledged_keys or [])
    pending = [copy.deepcopy(x) for x in queue if x.get('state') == 'pending' and x.get('idempotency_key') not in seen]
    pending.sort(key=lambda x: (x.get('sequence', 0), x.get('created_at', ''), x.get('item_id', '')))
    if limit is not None: pending = pending[:max(0, int(limit))]
    return {'schema': 'axm.translation.offline-replay-plan/v1', 'verdict': 'PLAN_READY', 'items': pending, 'count': len(pending), 'replayed': False}


def acknowledge(queue: list[dict[str, Any]], item_id: str) -> dict[str, Any]:
    out = copy.deepcopy(queue); found = False
    for item in out:
        if item.get('item_id') == item_id: item['state'] = 'acknowledged'; found = True
    return {'verdict': 'ACK_PLANNED' if found else 'NOT_FOUND', 'queue': out, 'persisted': False}


def run(queue: list[dict[str, Any]], **kwargs: Any) -> dict[str, Any]:
    return plan_replay(queue, **kwargs)
