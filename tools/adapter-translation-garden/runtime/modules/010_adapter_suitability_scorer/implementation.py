from __future__ import annotations
from typing import Any

DEFAULT_WEIGHTS = {
    "compatibility": 0.24,
    "trust": 0.18,
    "locality": 0.12,
    "fidelity": 0.18,
    "reversibility": 0.12,
    "proof_strength": 0.16,
}


def run(candidates: list[dict[str, Any]], weights: dict[str, float] | None = None) -> dict[str, Any]:
    active = dict(DEFAULT_WEIGHTS)
    if weights:
        active.update(weights)
    ranked = []
    for candidate in candidates:
        score = 0.0
        evidence = {}
        for metric, weight in active.items():
            value = max(0.0, min(1.0, float(candidate.get(metric, 0.0))))
            score += value * weight
            evidence[metric] = {"value": value, "weight": weight}
        loss_penalty = max(0.0, min(1.0, float(candidate.get("loss", 0.0)))) * 0.25
        cost_penalty = max(0.0, min(1.0, float(candidate.get("resource_cost", 0.0)))) * 0.10
        final = max(0.0, score - loss_penalty - cost_penalty)
        ranked.append({
            "adapter_id": candidate.get("adapter_id", "unnamed"),
            "score": round(final, 6),
            "evidence": evidence,
            "penalties": {"loss": loss_penalty, "resource_cost": cost_penalty},
        })
    ranked.sort(key=lambda item: (-item["score"], item["adapter_id"]))
    return {"ranked": ranked, "winner": ranked[0]["adapter_id"] if ranked else None}
