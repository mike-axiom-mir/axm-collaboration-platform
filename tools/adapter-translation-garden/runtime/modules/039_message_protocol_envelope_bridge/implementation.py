from __future__ import annotations
import copy
from typing import Any

_CANON = {'id', 'topic', 'key', 'correlation_id', 'reply_to', 'headers', 'payload', 'timestamp', 'delivery'}


def normalize(protocol: str, message: dict[str, Any], *, field_map: dict[str, str] | None = None) -> dict[str, Any]:
    field_map = dict(field_map or {})
    envelope = {'schema': 'axm.translation.message-envelope/v1', 'source_protocol': protocol}
    used = set()
    for target in _CANON:
        source = next((s for s, t in field_map.items() if t == target), target)
        if source in message:
            envelope[target] = copy.deepcopy(message[source]); used.add(source)
    sidecar = {k: copy.deepcopy(v) for k, v in message.items() if k not in used}
    envelope['source_sidecar'] = sidecar
    return {'verdict': 'NORMALIZED', 'envelope': envelope, 'sent': False}


def denormalize(envelope: dict[str, Any], *, target_protocol: str, field_map: dict[str, str] | None = None, include_source_sidecar: bool = False) -> dict[str, Any]:
    field_map = dict(field_map or {})
    out = {}
    for key in _CANON:
        if key in envelope: out[field_map.get(key, key)] = copy.deepcopy(envelope[key])
    if include_source_sidecar: out.update(copy.deepcopy(envelope.get('source_sidecar', {})))
    return {'verdict': 'MAPPED', 'target_protocol': target_protocol, 'message': out, 'sent': False}


def run(protocol: str, message: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    return normalize(protocol, message, **kwargs)
