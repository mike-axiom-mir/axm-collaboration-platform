from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class ContractSurface:
    major: int
    minor: int
    capabilities: frozenset[str]
    authority_actions: frozenset[str]
    evidence_fields: frozenset[str]
    deprecated: bool = False


def negotiate(producer: ContractSurface, consumer: ContractSurface, *, required_capabilities: set[str], required_evidence: set[str]) -> dict:
    errors = []
    if producer.major != consumer.major:
        errors.append('MAJOR_VERSION_MISMATCH')
    if producer.minor < consumer.minor:
        errors.append('PRODUCER_TOO_OLD')
    if not required_capabilities.issubset(producer.capabilities & consumer.capabilities):
        errors.append('MISSING_REQUIRED_CAPABILITY')
    if not required_evidence.issubset(producer.evidence_fields & consumer.evidence_fields):
        errors.append('EVIDENCE_FIELD_LOSS')
    if producer.deprecated:
        errors.append('DEPRECATED_SURFACE_OBSERVE_ONLY')
    return {'ok': not errors, 'errors': errors, 'mode': 'NORMAL' if not errors else 'HOLD'}


def validate_adapter(*, source_actions: set[str], target_actions: set[str], source_evidence: set[str], target_evidence: set[str]) -> dict:
    errors = []
    if not target_actions.issubset(source_actions):
        errors.append('ADAPTER_AUTHORITY_WIDENING')
    if not source_evidence.issubset(target_evidence):
        errors.append('ADAPTER_EVIDENCE_LOSS')
    return {'ok': not errors, 'errors': errors}
