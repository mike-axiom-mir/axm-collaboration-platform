
from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class Lineage:
    seat_id: str
    model_family: str
    source_digest: str
    prompt_digest: str
    context_digest: str
    method_id: str


def shared_dimensions(a: Lineage, b: Lineage) -> int:
    fields = ('model_family','source_digest','prompt_digest','context_digest','method_id')
    return sum(getattr(a, f) == getattr(b, f) for f in fields)


def independence_dimensions(a: Lineage, b: Lineage) -> int:
    return 5 - shared_dimensions(a, b)


def evaluate_consensus(lineages: list[Lineage], claims: list[str], *, minimum_dimensions: int, dissent_preserved: bool) -> dict:
    if len(lineages) != len(claims) or len(lineages) < 2:
        return {'ok': False, 'code': 'INSUFFICIENT_LINEAGE'}
    dims = [independence_dimensions(lineages[i], lineages[j]) for i in range(len(lineages)) for j in range(i+1, len(lineages))]
    agreement = len(set(claims)) == 1
    min_dim = min(dims)
    if agreement and min_dim < minimum_dimensions:
        return {'ok': False, 'code': 'CORRELATED_CONSENSUS_NOT_INDEPENDENT_PROOF', 'minimum_observed_dimensions': min_dim}
    if not dissent_preserved:
        return {'ok': False, 'code': 'DISSENT_NOT_PRESERVED'}
    return {'ok': True, 'code': 'INDEPENDENCE_EVIDENCED', 'agreement': agreement, 'minimum_observed_dimensions': min_dim}
