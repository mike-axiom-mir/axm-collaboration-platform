from __future__ import annotations

from enum import Enum


class ChallengeState(str, Enum):
    DRAFT = "DRAFT"
    BUILDING = "BUILDING"
    SUBMISSIONS_CLOSED = "SUBMISSIONS_CLOSED"
    TESTED = "TESTED"
    REVIEW_OPEN = "REVIEW_OPEN"
    VOTING_CLOSED = "VOTING_CLOSED"
    SYNTHESIZED = "SYNTHESIZED"
    FINALIZED = "FINALIZED"
    ABORTED = "ABORTED"


TERMINAL_STATES = {ChallengeState.FINALIZED.value, ChallengeState.ABORTED.value}
