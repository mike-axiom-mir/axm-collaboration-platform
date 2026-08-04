from __future__ import annotations
from typing import Any


def run(messages: list[dict[str, Any]], *, correlation_id: str, timeout_reached: bool = False) -> dict[str, Any]:
    matched = [m for m in messages if m.get('correlation_id') == correlation_id]
    terminal = [m for m in matched if m.get('kind') in {'response', 'error'} or m.get('terminal') is True]
    if len(terminal) > 1:
        return {'schema': 'axm.translation.async-sync-broker/v1', 'verdict': 'AMBIGUOUS', 'reason': 'multiple terminal responses', 'matched': len(matched), 'waited': False}
    if terminal:
        item = terminal[0]
        if item.get('kind') == 'error' or item.get('ok') is False:
            return {'schema': 'axm.translation.async-sync-broker/v1', 'verdict': 'ERROR', 'error': item.get('error') or item.get('payload'), 'matched': len(matched), 'waited': False}
        return {'schema': 'axm.translation.async-sync-broker/v1', 'verdict': 'COMPLETE', 'result': item.get('payload'), 'matched': len(matched), 'waited': False}
    return {'schema': 'axm.translation.async-sync-broker/v1', 'verdict': 'TIMEOUT' if timeout_reached else 'PENDING', 'matched': len(matched), 'waited': False}
