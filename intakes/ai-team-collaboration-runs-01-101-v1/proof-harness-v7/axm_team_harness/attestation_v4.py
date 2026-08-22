from __future__ import annotations
from dataclasses import dataclass, replace

@dataclass(frozen=True)
class CapabilityAttestation:
    attestation_id: str
    issuer_id: str
    issuer_class: str
    subject_id: str
    capability: str
    scope: frozenset[str]
    issued_tick: int
    expires_tick: int
    evidence_digest: str
    high_impact: bool = False
    revoked: bool = False


def validate_attestation(a: CapabilityAttestation, *, now_tick: int, trusted_issuer_classes: set[str], allowed_scope: set[str]) -> dict:
    errors = []
    if a.issuer_class not in trusted_issuer_classes:
        errors.append('UNTRUSTED_ISSUER')
    if a.high_impact and a.issuer_id == a.subject_id:
        errors.append('SELF_ATTESTATION_HIGH_IMPACT')
    if not a.evidence_digest:
        errors.append('MISSING_EVIDENCE')
    if not a.scope.issubset(allowed_scope):
        errors.append('ATTESTED_SCOPE_WIDENING')
    if a.revoked:
        errors.append('ATTESTATION_REVOKED')
    if now_tick > a.expires_tick:
        errors.append('ATTESTATION_EXPIRED')
    return {'ok': not errors, 'errors': errors, 'attestation_id': a.attestation_id}


def revoke(a: CapabilityAttestation) -> CapabilityAttestation:
    return replace(a, revoked=True)
