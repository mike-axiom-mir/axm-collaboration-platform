from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

from .utils import utc_now


def _dedupe_strings(values: list[str]) -> list[str]:
    seen = set()
    result = []
    for value in values:
        clean = " ".join(str(value).split()).strip()
        key = clean.lower()
        if clean and key not in seen:
            seen.add(key)
            result.append(clean)
    return result


def build_merge_map(packet: dict[str, Any], state: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    base = result.get("provisional_winner")
    best_by_criterion = []
    for award in result.get("criterion_awards", []):
        winners = award.get("winners", [])
        best_by_criterion.append({
            "criterion_id": award.get("criterion_id"),
            "criterion": award.get("label"),
            "source": award.get("source"),
            "score": award.get("score"),
            "candidate_sources": winners,
            "already_in_base": base in winners,
            "action": "inspect_for_merge" if base not in winners else "retain_or_verify",
        })

    component_support: dict[tuple[str, str], int] = Counter()
    component_evidence: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    risks: list[str] = []
    weaknesses: list[str] = []
    strengths: list[str] = []

    for review in state.get("reviews", {}).values():
        if review.get("status") != "ACTIVE":
            continue
        reviewer = review.get("reviewer_id")
        for label, evaluation in review.get("evaluations", {}).items():
            for item in evaluation.get("merge_worthy", []):
                normalized = " ".join(str(item).split()).strip()
                if normalized:
                    key = (label, normalized.lower())
                    component_support[key] += 1
                    component_evidence[key].append({"reviewer_id": reviewer, "text": normalized})
            risks.extend(str(item) for item in evaluation.get("risks", []))
            weaknesses.extend(str(item) for item in evaluation.get("weaknesses", []))
            strengths.extend(str(item) for item in evaluation.get("strengths", []))

    components = []
    for (label, _), support in sorted(component_support.items(), key=lambda item: (-item[1], item[0])):
        evidence = component_evidence[(label, _)]
        components.append({
            "candidate_source": label,
            "component": evidence[0]["text"],
            "support_count": support,
            "evidence": evidence,
            "merge_status": "PROPOSED_ONLY",
        })

    return {
        "generated_at": utc_now(),
        "base_candidate": base,
        "principle": "No automatic merge. Preserve each source candidate and require an explicit human or downstream merge decision.",
        "best_by_criterion": best_by_criterion,
        "proposed_components": components,
        "cross_candidate_strengths": _dedupe_strings(strengths),
        "risk_ledger": _dedupe_strings(risks),
        "weakness_ledger": _dedupe_strings(weaknesses),
        "recommended_next_round": {
            "mode": "BEAT_THE_CONSENSUS",
            "instruction": "Create a new candidate using only explicitly approved pieces from this merge map, then challenge all participants to beat it.",
            "enabled": False,
        },
        "human_decision_required": True,
    }
