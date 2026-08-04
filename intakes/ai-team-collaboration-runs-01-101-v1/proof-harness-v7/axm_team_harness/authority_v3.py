
from __future__ import annotations
from dataclasses import dataclass
from typing import Iterable

@dataclass(frozen=True)
class Lease:
    lease_id: str
    holder: str
    actions: frozenset[str]
    targets: frozenset[str]
    privacy_scope: int
    deadline_tick: int
    depth: int
    max_depth: int
    revoked: bool = False


def delegate(parent: Lease, *, child_id: str, holder: str, actions: Iterable[str], targets: Iterable[str],
             privacy_scope: int, deadline_tick: int) -> dict:
    errors = []
    ca, ct = frozenset(actions), frozenset(targets)
    if parent.revoked:
        errors.append('PARENT_REVOKED')
    if not ca.issubset(parent.actions):
        errors.append('AUTHORITY_WIDENING')
    if not ct.issubset(parent.targets):
        errors.append('TARGET_WIDENING')
    if privacy_scope > parent.privacy_scope:
        errors.append('PRIVACY_SCOPE_WIDENING')
    if deadline_tick > parent.deadline_tick:
        errors.append('DEADLINE_RESET_OR_EXTENSION')
    if parent.depth + 1 > parent.max_depth:
        errors.append('DELEGATION_DEPTH_EXCEEDED')
    if errors:
        return {'ok': False, 'errors': errors, 'child': None}
    child = Lease(child_id, holder, ca, ct, privacy_scope, deadline_tick, parent.depth + 1, parent.max_depth)
    return {'ok': True, 'errors': [], 'child': child,
            'receipt': {'parent_lease_id': parent.lease_id, 'child_lease_id': child_id, 'conserved': True}}
