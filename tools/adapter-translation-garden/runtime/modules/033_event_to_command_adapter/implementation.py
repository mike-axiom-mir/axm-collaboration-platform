from __future__ import annotations
import copy
from typing import Any


def run(event: dict[str, Any], mapping: dict[str, Any]) -> dict[str, Any]:
    event_type = event.get('type')
    rule = mapping.get(event_type)
    if not rule: return {'verdict': 'REFUSE', 'reason': 'event type is not explicitly mapped', 'command': None, 'dispatched': False}
    payload = event.get('payload', {})
    out, missing = {}, []
    for source, target in rule.get('field_map', {}).items():
        if source in payload: out[target] = copy.deepcopy(payload[source])
        else: missing.append(source)
    out.update(copy.deepcopy(rule.get('constants', {})))
    if missing: return {'verdict': 'REFUSE', 'reason': 'mapped source fields are missing', 'missing': missing, 'command': None, 'dispatched': False}
    command = {'type': rule['command_type'], 'payload': out, 'source_event': {'type': event_type, 'id': event.get('id')}}
    return {'schema': 'axm.translation.event-command/v1', 'verdict': 'MAPPED', 'command': command, 'dispatched': False}
