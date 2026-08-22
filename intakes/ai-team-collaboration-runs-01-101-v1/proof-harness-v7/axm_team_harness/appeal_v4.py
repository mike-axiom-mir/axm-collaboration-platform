from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class Appeal:
    appeal_id: str
    decision_id: str
    scope: str
    new_evidence_digest: str = ''
    process_error: str = ''
    minority_report: str = ''
    retaliation_action: str = ''


def evaluate_appeal(a: Appeal, *, expected_scope: str, human_reopen: bool) -> dict:
    errors = []
    if a.scope != expected_scope:
        errors.append('APPEAL_SCOPE_MISMATCH')
    if not a.new_evidence_digest and not a.process_error:
        errors.append('NO_REOPENING_BASIS')
    if a.retaliation_action:
        errors.append('RETALIATION_FORBIDDEN')
    if not human_reopen:
        errors.append('HUMAN_REOPEN_REQUIRED')
    return {'ok': not errors, 'errors': errors, 'minority_report_preserved': a.minority_report, 'status': 'REOPEN_CANDIDATE' if not errors else 'HELD'}
