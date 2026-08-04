from __future__ import annotations
from typing import Any


def run(candidates: list[dict[str, Any]], *, bandwidth_kbps: float, power_budget: float, min_quality: float = 0.0, quality_weight: float = 1.0, fidelity_weight: float = 1.0) -> dict[str, Any]:
    eligible, rejected = [], []
    for c in candidates:
        reasons = []
        if float(c.get('bandwidth_kbps', 0)) > bandwidth_kbps: reasons.append('bandwidth')
        if float(c.get('power_cost', 0)) > power_budget: reasons.append('power')
        if float(c.get('quality', 0)) < min_quality: reasons.append('minimum_quality')
        if reasons: rejected.append({'id': c.get('id'), 'reasons': reasons}); continue
        score = float(c.get('quality', 0)) * quality_weight + float(c.get('fidelity', c.get('quality', 0))) * fidelity_weight - float(c.get('power_cost', 0)) * 0.2 - (float(c.get('bandwidth_kbps', 0)) / max(1.0, bandwidth_kbps)) * 0.1
        eligible.append({'id': c.get('id'), 'score': round(score, 8), 'candidate': c})
    eligible.sort(key=lambda x: (-x['score'], str(x['id'])))
    if not eligible: return {'schema': 'axm.translation.representation-selection/v1', 'verdict': 'REFUSE', 'selected': None, 'eligible': [], 'rejected': rejected, 'switched': False}
    best = eligible[0]
    max_quality = max(float(c.get('quality', 0)) for c in candidates) if candidates else 0
    degradation = max_quality - float(best['candidate'].get('quality', 0))
    return {'schema': 'axm.translation.representation-selection/v1', 'verdict': 'SELECTED', 'selected': best, 'eligible': eligible, 'rejected': rejected, 'degradation': {'quality_delta_from_best_available': degradation, 'visible': degradation > 0}, 'switched': False}
