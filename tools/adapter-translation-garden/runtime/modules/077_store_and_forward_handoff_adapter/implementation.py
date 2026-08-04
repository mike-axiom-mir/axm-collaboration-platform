from __future__ import annotations
import base64
import hashlib
from typing import Any


def create_package(payload: bytes, *, package_id: str, chunk_size: int = 65536, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    if chunk_size <= 0: raise ValueError('chunk_size must be positive')
    chunks = []
    for index, start in enumerate(range(0, len(payload), chunk_size)):
        raw = payload[start:start+chunk_size]
        chunks.append({'index': index, 'sha256': hashlib.sha256(raw).hexdigest(), 'size': len(raw), 'data_base64': base64.b64encode(raw).decode('ascii')})
    return {'schema': 'axm.translation.handoff-package/v1', 'package_id': package_id, 'payload_sha256': hashlib.sha256(payload).hexdigest(), 'payload_size': len(payload), 'chunk_size': chunk_size, 'chunks': chunks, 'metadata': dict(metadata or {}), 'stored': False, 'forwarded': False}


def verify_package(package: dict[str, Any]) -> dict[str, Any]:
    errors, assembled = [], bytearray()
    chunks = sorted(package.get('chunks', []), key=lambda x: x.get('index', -1))
    if [x.get('index') for x in chunks] != list(range(len(chunks))): errors.append('chunk sequence is incomplete or duplicated')
    for chunk in chunks:
        try: raw = base64.b64decode(chunk.get('data_base64', ''), validate=True)
        except Exception: errors.append(f"chunk {chunk.get('index')} has invalid base64"); continue
        if len(raw) != chunk.get('size'): errors.append(f"chunk {chunk.get('index')} size mismatch")
        if hashlib.sha256(raw).hexdigest() != chunk.get('sha256'): errors.append(f"chunk {chunk.get('index')} hash mismatch")
        assembled.extend(raw)
    if len(assembled) != package.get('payload_size'): errors.append('payload size mismatch')
    if hashlib.sha256(bytes(assembled)).hexdigest() != package.get('payload_sha256'): errors.append('payload hash mismatch')
    return {'schema': 'axm.translation.handoff-verification/v1', 'valid': not errors, 'errors': errors, 'payload': bytes(assembled) if not errors else None, 'executed': False}


def receipt(package: dict[str, Any], *, receiver_id: str, received_at: str, verified: bool) -> dict[str, Any]:
    return {'schema': 'axm.translation.handoff-receipt/v1', 'package_id': package.get('package_id'), 'payload_sha256': package.get('payload_sha256'), 'receiver_id': receiver_id, 'received_at': received_at, 'verified': bool(verified)}


def run(payload: bytes, **kwargs: Any) -> dict[str, Any]:
    return create_package(payload, **kwargs)
