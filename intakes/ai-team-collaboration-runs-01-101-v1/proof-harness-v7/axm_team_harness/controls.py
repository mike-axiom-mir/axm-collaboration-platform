
from __future__ import annotations
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from typing import Any


@dataclass(frozen=True)
class ControlState:
    stopped: bool = False
    revoked: bool = False
    expires_at: str = '2099-12-31T23:59:59Z'
    resume_authorization: str | None = None
    reason: str | None = None


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace('Z', '+00:00'))


def is_expired(state: ControlState, now: datetime | None = None) -> bool:
    current = now or datetime.now(timezone.utc)
    return current >= _parse(state.expires_at)


def can_act(state: ControlState, now: datetime | None = None) -> tuple[bool, str]:
    if state.revoked:
        return False, 'AUTHORITY_REVOKED'
    if state.stopped:
        return False, 'STOP_ACTIVE'
    if is_expired(state, now):
        return False, 'AUTHORITY_EXPIRED'
    return True, 'ALLOWED'


def stop(state: ControlState, reason: str) -> ControlState:
    return replace(state, stopped=True, resume_authorization=None, reason=reason)


def revoke(state: ControlState, reason: str) -> ControlState:
    return replace(state, stopped=True, revoked=True, resume_authorization=None, reason=reason)


def authorize_resume(state: ControlState, authorization: str) -> ControlState:
    if state.revoked:
        return state
    return replace(state, resume_authorization=authorization)


def resume(state: ControlState) -> ControlState:
    if state.revoked or not state.resume_authorization:
        return state
    return replace(state, stopped=False, resume_authorization=None, reason=None)
