from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class Vote:
    voter_id: str
    decision: str
    lineage_cluster: str
    is_human: bool = False
    dissent_note: str = ''


def evaluate_quorum(votes: list[Vote], *, minimum_independent_clusters: int, human_accept_required: bool = True) -> dict:
    errors = []
    human_votes = [v for v in votes if v.is_human]
    if any(v.decision == 'REJECT' for v in human_votes):
        errors.append('HUMAN_VETO')
    if human_accept_required and not any(v.decision == 'ACCEPT' for v in human_votes):
        errors.append('MISSING_HUMAN_ACCEPT')
    ai_accept_clusters = {v.lineage_cluster for v in votes if not v.is_human and v.decision == 'ACCEPT'}
    if len(ai_accept_clusters) < minimum_independent_clusters:
        errors.append('INSUFFICIENT_INDEPENDENT_CLUSTERS')
    dissent = [v.dissent_note for v in votes if v.decision != 'ACCEPT' and v.dissent_note]
    return {
        'ok': not errors,
        'errors': errors,
        'independent_accept_clusters': sorted(ai_accept_clusters),
        'dissent_preserved': dissent,
    }
