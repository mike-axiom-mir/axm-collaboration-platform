from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class Claim:
    claim_id: str
    text: str
    source_digests: tuple[str, ...]
    observed_tick: int
    max_age: int
    polarity: str = 'SUPPORT'


def evaluate_claims(claims: list[Claim], *, now_tick: int) -> dict:
    errors = []
    if not claims or any(not c.source_digests for c in claims):
        errors.append('MISSING_SOURCE')
    stale = [c.claim_id for c in claims if now_tick - c.observed_tick > c.max_age]
    if stale:
        errors.append('STALE_CLAIM')
    polarities = {c.polarity for c in claims}
    contradiction = 'SUPPORT' in polarities and 'CONTRADICT' in polarities
    if contradiction:
        errors.append('CONTRADICTION_HELD')
    return {'ok': not errors, 'errors': errors, 'stale': stale, 'contradiction': contradiction,
            'preserved_claim_ids': [c.claim_id for c in claims]}


def may_reopen(*, prior_evidence_digest: str, new_evidence_digest: str, human_reopen: bool) -> dict:
    if not human_reopen:
        return {'ok': False, 'code': 'HUMAN_REOPEN_REQUIRED'}
    if not new_evidence_digest or new_evidence_digest == prior_evidence_digest:
        return {'ok': False, 'code': 'NO_NEW_EVIDENCE'}
    return {'ok': True, 'code': 'REOPENED_AS_CANDIDATE'}
