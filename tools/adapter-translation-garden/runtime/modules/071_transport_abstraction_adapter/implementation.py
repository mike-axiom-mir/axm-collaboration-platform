from __future__ import annotations
from typing import Any


def normalize(descriptor: dict[str, Any]) -> dict[str, Any]:
    return {'id': str(descriptor.get('id')), 'kind': descriptor.get('kind', 'unknown'), 'features': sorted(set(descriptor.get('features', []))), 'max_payload_bytes': descriptor.get('max_payload_bytes'), 'bandwidth_kbps': descriptor.get('bandwidth_kbps'), 'power_cost': descriptor.get('power_cost', 0.5), 'local_only': bool(descriptor.get('local_only', False)), 'reliability': float(descriptor.get('reliability', 0.5)), 'verified': bool(descriptor.get('verified', False))}


def match(required: dict[str, Any], candidates: list[dict[str, Any]]) -> dict[str, Any]:
    req_features = set(required.get('features', [])); size = required.get('payload_bytes'); local = required.get('local_only')
    eligible, rejected = [], []
    for raw in candidates:
        c = normalize(raw); reasons = []
        if not req_features <= set(c['features']): reasons.append('missing_features')
        if size is not None and c['max_payload_bytes'] is not None and size > c['max_payload_bytes']: reasons.append('payload_too_large')
        if local is True and not c['local_only']: reasons.append('not_local_only')
        if required.get('verified_only') and not c['verified']: reasons.append('not_verified')
        if reasons: rejected.append({'id': c['id'], 'reasons': reasons}); continue
        bandwidth = c['bandwidth_kbps'] if c['bandwidth_kbps'] is not None else 0
        score = c['reliability'] * 4 + min(float(bandwidth) / 10000, 1) - float(c['power_cost']) + (1 if c['local_only'] else 0) + (1 if c['verified'] else 0)
        eligible.append({'id': c['id'], 'score': round(score, 6), 'descriptor': c})
    eligible.sort(key=lambda x: (-x['score'], x['id']))
    return {'schema': 'axm.translation.transport-match/v1', 'verdict': 'SELECTED' if eligible else 'REFUSE', 'selected': eligible[0] if eligible else None, 'eligible': eligible, 'rejected': rejected, 'connected': False}


def run(descriptor: dict[str, Any]) -> dict[str, Any]:
    return normalize(descriptor)
