from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class IntakeEvidence:
    schema_pass: bool
    positive_tests_pass: bool
    negative_tests_pass: bool
    recovery_pass: bool
    projection_pass: bool
    rollback_present: bool
    owner_review_receipt: str | None
    unresolved_high_risk: bool = False


def evaluate_intake(e: IntakeEvidence) -> dict[str, object]:
    missing: list[str] = []
    if not e.schema_pass: missing.append('SCHEMA')
    if not e.positive_tests_pass: missing.append('POSITIVE_TESTS')
    if not e.negative_tests_pass: missing.append('NEGATIVE_TESTS')
    if not e.recovery_pass: missing.append('RECOVERY')
    if not e.projection_pass: missing.append('HUMAN_PROJECTION')
    if not e.rollback_present: missing.append('ROLLBACK')
    if not e.owner_review_receipt: missing.append('OWNER_REVIEW')
    if e.unresolved_high_risk: missing.append('UNRESOLVED_HIGH_RISK')
    ready = not missing
    return {
        'status': 'READY_FOR_LOCAL_INTAKE_CANDIDATE' if ready else 'HELD_FOR_INTAKE',
        'missing_or_blocking': missing,
        'integrated': False,
        'canon': False,
        'requires_human_merge_gate': True,
    }
