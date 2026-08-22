from __future__ import annotations
from dataclasses import dataclass
from typing import Any

ALLOWED: dict[str, set[str]] = {
    'DRAFT': {'VALIDATED', 'CANCELLED'},
    'VALIDATED': {'OFFERED', 'HELD', 'CANCELLED'},
    'OFFERED': {'DELIVERED', 'REFUSED', 'EXPIRED', 'CANCELLED'},
    'DELIVERED': {'ACCEPTED', 'REFUSED', 'EXPIRED', 'CANCELLED'},
    'ACCEPTED': {'ACTIVE', 'PAUSED', 'CANCELLED'},
    'ACTIVE': {'PAUSED', 'HELD', 'RETURNED', 'FAILED', 'CANCELLED'},
    'PAUSED': {'ACTIVE', 'CANCELLED', 'EXPIRED'},
    'HELD': {'VALIDATED', 'ACTIVE', 'CANCELLED', 'EXPIRED'},
    'RETURNED': {'UNDER_REVIEW', 'FAILED'},
    'UNDER_REVIEW': {'RESULT_ACCEPTED', 'RESULT_REJECTED', 'RESULT_PARTIAL'},
    'RESULT_PARTIAL': {'ACTIVE', 'CLOSED'},
    'RESULT_ACCEPTED': {'MERGE_PROPOSED', 'CLOSED'},
    'RESULT_REJECTED': {'CLOSED', 'VALIDATED'},
    'MERGE_PROPOSED': {'MERGED', 'CLOSED'},
    'MERGED': {'CLOSED'},
    'REFUSED': {'CLOSED'},
    'EXPIRED': {'CLOSED'},
    'FAILED': {'CLOSED', 'VALIDATED'},
    'CANCELLED': {'CLOSED'},
    'CLOSED': set(),
}

@dataclass(frozen=True)
class TransitionResult:
    ok: bool
    previous_state: str
    requested_state: str
    error_codes: tuple[str, ...]
    receipt: dict[str, Any] | None


def transition(previous_state: str, requested_state: str, *, acceptance_receipt: str | None = None,
               review_receipt: str | None = None, human_decision_receipt: str | None = None,
               resume_authorization: str | None = None) -> TransitionResult:
    errors: list[str] = []
    if previous_state not in ALLOWED:
        errors.append('UNKNOWN_PREVIOUS_STATE')
    elif requested_state not in ALLOWED[previous_state]:
        errors.append('ILLEGAL_STATE_TRANSITION')
    if requested_state in {'ACCEPTED', 'ACTIVE'} and not acceptance_receipt:
        errors.append('ACCEPTANCE_RECEIPT_REQUIRED')
    if requested_state in {'RESULT_ACCEPTED', 'RESULT_REJECTED', 'RESULT_PARTIAL'} and not review_receipt:
        errors.append('REVIEW_RECEIPT_REQUIRED')
    if requested_state == 'MERGED' and not human_decision_receipt:
        errors.append('HUMAN_MERGE_DECISION_REQUIRED')
    if previous_state in {'HELD', 'PAUSED', 'FAILED'} and requested_state in {'ACTIVE', 'VALIDATED'} and not resume_authorization:
        errors.append('RESUME_AUTHORIZATION_REQUIRED')
    if errors:
        return TransitionResult(False, previous_state, requested_state, tuple(dict.fromkeys(errors)), None)
    receipt = {
        'previous_state': previous_state,
        'new_state': requested_state,
        'acceptance_receipt': acceptance_receipt,
        'review_receipt': review_receipt,
        'human_decision_receipt': human_decision_receipt,
        'resume_authorization': resume_authorization,
    }
    return TransitionResult(True, previous_state, requested_state, (), receipt)
