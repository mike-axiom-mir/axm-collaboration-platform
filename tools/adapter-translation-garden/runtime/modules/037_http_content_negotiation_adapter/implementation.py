from __future__ import annotations
from typing import Any


def _parse(item: str) -> tuple[str, float, dict[str, str]]:
    parts = [p.strip() for p in item.split(';')]
    media = parts[0].lower()
    params = {}
    q = 1.0
    for part in parts[1:]:
        if '=' not in part: continue
        k, v = [x.strip() for x in part.split('=', 1)]
        if k.lower() == 'q':
            try: q = max(0.0, min(1.0, float(v)))
            except ValueError: q = 0.0
        else: params[k.lower()] = v.strip('"')
    return media, q, params


def _match(rng: str, offer: str) -> int:
    if rng == '*/*': return 0
    if '/' not in rng or '/' not in offer: return -1
    rt, rs = rng.split('/', 1); ot, os = offer.lower().split('/', 1)
    if rt == ot and rs == '*': return 1
    if rt == ot and rs == os: return 2
    return -1


def run(accept: str, available: list[str]) -> dict[str, Any]:
    ranges = [_parse(x) for x in accept.split(',') if x.strip()] if accept.strip() else [('*/*', 1.0, {})]
    candidates = []
    for order, offer in enumerate(available):
        best = None
        for range_order, (rng, q, params) in enumerate(ranges):
            specificity = _match(rng, offer)
            if specificity >= 0 and q > 0:
                score = (q, specificity, -range_order, -order)
                if best is None or score > best[0]: best = (score, rng, params)
        if best: candidates.append((best[0], offer, best[1], best[2]))
    if not candidates: return {'schema': 'axm.translation.http-negotiation/v1', 'verdict': 'NOT_ACCEPTABLE', 'selected': None}
    candidates.sort(reverse=True)
    _, offer, matched, params = candidates[0]
    return {'schema': 'axm.translation.http-negotiation/v1', 'verdict': 'SELECTED', 'selected': offer, 'matched_range': matched, 'parameters': params}
