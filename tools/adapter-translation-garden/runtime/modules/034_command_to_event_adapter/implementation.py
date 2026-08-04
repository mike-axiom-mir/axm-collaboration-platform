from __future__ import annotations
import copy
from typing import Any


def run(command: dict[str, Any], result: dict[str, Any], mapping: dict[str, Any]) -> dict[str, Any]:
    command_type = command.get('type')
    rule = mapping.get(command_type)
    if not rule: return {'verdict': 'REFUSE', 'reason': 'command type is not explicitly mapped', 'event': None, 'published': False}
    out, missing = {}, []
    for source, target in rule.get('field_map', {}).items():
        if source in result: out[target] = copy.deepcopy(result[source])
        else: missing.append(source)
    out.update(copy.deepcopy(rule.get('constants', {})))
    if missing: return {'verdict': 'REFUSE', 'missing': missing, 'event': None, 'published': False}
    event = {'type': rule['event_type'], 'payload': out, 'causation_id': command.get('id'), 'correlation_id': command.get('correlation_id')}
    return {'schema': 'axm.translation.command-event/v1', 'verdict': 'MAPPED', 'event': event, 'published': False}
