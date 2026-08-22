"""Detached AXM Composite Native and Human Oracle Resolver v0.1.0."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Sequence

VALID_AUTHORITIES = {
    "SPECIALIST_TECHNICAL", "NATIVE_VISUAL", "PHYSICAL_DEVICE",
    "ACCESSIBILITY", "HUMAN_JUDGMENT"
}
VALID_VERDICTS = {"PASS", "FAIL", "UNKNOWN", "NOT_RUN", "CONFLICTED", "STALE", "HUMAN_REVIEW"}

class CompositeOracleError(ValueError):
    pass

def _text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise CompositeOracleError(f"{field} must be a non-empty string")
    return value.strip()

@dataclass(frozen=True)
class EvidenceSeat:
    seat_id: str
    subject_id: str
    scope_id: str
    authority_type: str
    verdict_state: str
    evidence_ref: str
    independent: bool = False
    limitations: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        for field in ("seat_id", "subject_id", "scope_id", "evidence_ref"):
            object.__setattr__(self, field, _text(getattr(self, field), field))
        authority = _text(self.authority_type, "authority_type").upper()
        verdict = _text(self.verdict_state, "verdict_state").upper()
        if authority not in VALID_AUTHORITIES:
            raise CompositeOracleError("unknown authority_type")
        if verdict not in VALID_VERDICTS:
            raise CompositeOracleError("unknown verdict_state")
        if not isinstance(self.independent, bool):
            raise CompositeOracleError("independent must be boolean")
        if not isinstance(self.limitations, tuple) or any(not isinstance(x, str) or not x.strip() for x in self.limitations):
            raise CompositeOracleError("limitations must be a tuple of non-empty strings")
        object.__setattr__(self, "authority_type", authority)
        object.__setattr__(self, "verdict_state", verdict)
        object.__setattr__(self, "limitations", tuple(x.strip() for x in self.limitations))

class CompositeNativeHumanOracle:
    def __init__(self, resolver_id: str, required_authorities: Iterable[str], require_independence: bool = False):
        self.resolver_id = _text(resolver_id, "resolver_id")
        required = tuple(dict.fromkeys(_text(x, "required_authority").upper() for x in required_authorities))
        if not required:
            raise CompositeOracleError("required_authorities cannot be empty")
        if any(x not in VALID_AUTHORITIES for x in required):
            raise CompositeOracleError("unknown required authority")
        if not isinstance(require_independence, bool):
            raise CompositeOracleError("require_independence must be boolean")
        self.required_authorities = required
        self.require_independence = require_independence

    def resolve(self, seats: Sequence[EvidenceSeat]) -> Dict[str, Any]:
        if not isinstance(seats, (list, tuple)) or not seats:
            raise CompositeOracleError("seats must be a non-empty sequence")
        if not all(isinstance(x, EvidenceSeat) for x in seats):
            raise CompositeOracleError("all seats must be EvidenceSeat values")
        ids = [x.seat_id for x in seats]
        if len(ids) != len(set(ids)):
            raise CompositeOracleError("duplicate seat_id")
        subjects = {x.subject_id for x in seats}
        scopes = {x.scope_id for x in seats}
        if len(subjects) != 1 or len(scopes) != 1:
            raise CompositeOracleError("all seats must share subject_id and scope_id")
        grouped = {authority: [x for x in seats if x.authority_type == authority] for authority in VALID_AUTHORITIES}
        missing = [x for x in self.required_authorities if not grouped[x]]
        non_independent = [x.seat_id for x in seats if x.authority_type in self.required_authorities and not x.independent]
        required_seats = [x for x in seats if x.authority_type in self.required_authorities]
        states = {x.verdict_state for x in required_seats}
        if missing:
            verdict, reason = "UNKNOWN", "MISSING_REQUIRED_AUTHORITY"
        elif self.require_independence and non_independent:
            verdict, reason = "UNKNOWN", "INDEPENDENCE_REQUIREMENT_UNMET"
        elif "CONFLICTED" in states or ("PASS" in states and "FAIL" in states):
            verdict, reason = "CONFLICTED", "VALID_EVIDENCE_DISAGREES"
        elif "FAIL" in states:
            verdict, reason = "FAIL", "REQUIRED_AUTHORITY_FAILED"
        elif "HUMAN_REVIEW" in states:
            verdict, reason = "HUMAN_REVIEW", "HUMAN_DECISION_REMAINS_OPEN"
        elif states & {"UNKNOWN", "NOT_RUN", "STALE"}:
            verdict, reason = "UNKNOWN", "REQUIRED_AUTHORITY_NOT_CURRENTLY_PROVEN"
        elif all(any(s.verdict_state == "PASS" for s in grouped[a]) for a in self.required_authorities):
            verdict, reason = "PASS", None
        else:
            verdict, reason = "UNKNOWN", "REQUIRED_PASS_NOT_PRESENT"
        return {
            "schema_version": "axm.verify.composite-native-human-receipt/0.1",
            "resolver_id": self.resolver_id,
            "subject_id": next(iter(subjects)),
            "scope_id": next(iter(scopes)),
            "required_authorities": list(self.required_authorities),
            "require_independence": self.require_independence,
            "missing_authorities": missing,
            "non_independent_seats": non_independent,
            "seat_receipts": [
                {
                    "seat_id": s.seat_id, "authority_type": s.authority_type,
                    "verdict_state": s.verdict_state, "evidence_ref": s.evidence_ref,
                    "independent": s.independent, "limitations": list(s.limitations),
                } for s in seats
            ],
            "verdict_state": verdict,
            "reason": reason,
            "universal_score": None,
            "specialist_authority_preserved": True,
            "authority": "NONE",
            "canon": False,
        }
