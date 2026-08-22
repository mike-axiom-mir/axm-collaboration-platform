from __future__ import annotations
import base64
from typing import Any


def websocket_to_event(frame: dict[str, Any], *, event_name: str = 'message', sequence: int | None = None) -> dict[str, Any]:
    opcode = frame.get('opcode', 'text')
    if opcode in {'ping', 'pong', 'close'}: return {'verdict': 'REFUSE', 'reason': 'control frame is not an application event', 'emitted': False}
    payload = frame.get('payload', '')
    if opcode == 'binary':
        if not isinstance(payload, (bytes, bytearray)): raise ValueError('binary payload must be bytes')
        data = base64.b64encode(bytes(payload)).decode('ascii'); encoding = 'base64'
    elif opcode == 'text':
        if not isinstance(payload, str): raise ValueError('text payload must be a string')
        data = payload; encoding = 'utf-8-text'
    else: return {'verdict': 'REFUSE', 'reason': 'unsupported opcode', 'emitted': False}
    return {'schema': 'axm.translation.event-stream-envelope/v1', 'verdict': 'MAPPED', 'event': event_name, 'sequence': sequence, 'data': data, 'encoding': encoding, 'emitted': False}


def event_to_websocket(event: dict[str, Any]) -> dict[str, Any]:
    encoding = event.get('encoding', 'utf-8-text')
    if encoding == 'base64': payload = base64.b64decode(event.get('data', ''), validate=True); opcode = 'binary'
    elif encoding == 'utf-8-text': payload = str(event.get('data', '')); opcode = 'text'
    else: return {'verdict': 'REFUSE', 'reason': 'unsupported event encoding', 'frame': None}
    return {'schema': 'axm.translation.websocket-frame/v1', 'verdict': 'MAPPED', 'frame': {'opcode': opcode, 'payload': payload, 'event': event.get('event'), 'sequence': event.get('sequence')}, 'sent': False}


def run(frame: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    return websocket_to_event(frame, **kwargs)
