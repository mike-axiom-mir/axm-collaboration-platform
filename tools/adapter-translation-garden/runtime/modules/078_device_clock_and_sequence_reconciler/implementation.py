from __future__ import annotations
from statistics import median
from typing import Any


def run(events: list[dict[str, Any]], *, max_clock_skew_ms: float = 5000.0) -> dict[str, Any]:
    findings = []
    sequences = [e.get('sequence') for e in events]
    valid_sequences = [int(x) for x in sequences if isinstance(x, int)]
    duplicates = sorted({x for x in valid_sequences if valid_sequences.count(x) > 1})
    if duplicates: findings.append({'kind': 'duplicate_sequence', 'severity': 'high', 'values': duplicates})
    ordered_unique = sorted(set(valid_sequences))
    gaps = []
    for a, b in zip(ordered_unique, ordered_unique[1:]):
        if b > a + 1: gaps.append([a + 1, b - 1])
    if gaps: findings.append({'kind': 'sequence_gaps', 'severity': 'high', 'ranges': gaps})
    for a, b in zip(events, events[1:]):
        if isinstance(a.get('sequence'), int) and isinstance(b.get('sequence'), int) and b['sequence'] < a['sequence']:
            findings.append({'kind': 'arrival_sequence_regression', 'severity': 'medium', 'from': a['sequence'], 'to': b['sequence']})
    offsets = [float(e['reference_time_ms']) - float(e['device_time_ms']) for e in events if 'reference_time_ms' in e and 'device_time_ms' in e]
    estimate = median(offsets) if offsets else None
    spread = (max(offsets) - min(offsets)) if len(offsets) > 1 else 0.0
    if estimate is not None and abs(estimate) > max_clock_skew_ms: findings.append({'kind': 'large_clock_offset', 'severity': 'high', 'offset_ms': estimate})
    if spread > max_clock_skew_ms: findings.append({'kind': 'clock_offset_ambiguous', 'severity': 'high', 'spread_ms': spread})
    canonical = sorted(events, key=lambda e: (e.get('sequence', 10**18), e.get('device_time_ms', 10**18), str(e.get('id', ''))))
    return {'schema': 'axm.translation.sequence-reconciliation/v1', 'verdict': 'PARTIAL' if findings else 'PASS', 'canonical_order': canonical, 'clock_offset_estimate_ms': estimate, 'offset_spread_ms': spread, 'findings': findings, 'clock_changed': False}
