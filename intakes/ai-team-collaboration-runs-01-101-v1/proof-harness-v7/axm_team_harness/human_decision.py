
from __future__ import annotations
from dataclasses import dataclass, replace

@dataclass(frozen=True)
class DecisionReceipt:
    decision_id: str
    actor_kind: str
    explicit: bool
    decision: str
    scope: str
    issued_tick: int
    expires_tick: int
    reversible: bool
    revoked: bool = False


def validate_decision(receipt: DecisionReceipt | None, *, required_scope: str, now_tick: int) -> dict:
    if receipt is None:
        return {'ok': False, 'code': 'NO_DECISION_SILENCE_IS_NOT_CONSENT'}
    if receipt.actor_kind != 'HUMAN':
        return {'ok': False, 'code': 'NON_HUMAN_DECISION_OWNER'}
    if not receipt.explicit:
        return {'ok': False, 'code': 'DECISION_NOT_EXPLICIT'}
    if receipt.scope != required_scope:
        return {'ok': False, 'code': 'DECISION_SCOPE_MISMATCH'}
    if receipt.revoked:
        return {'ok': False, 'code': 'DECISION_REVOKED'}
    if now_tick > receipt.expires_tick:
        return {'ok': False, 'code': 'DECISION_EXPIRED'}
    return {'ok': True, 'code': 'DECISION_CURRENT'}


def revoke(receipt: DecisionReceipt) -> DecisionReceipt:
    if not receipt.reversible:
        raise ValueError('Receipt is not reversible.')
    return replace(receipt, revoked=True)
