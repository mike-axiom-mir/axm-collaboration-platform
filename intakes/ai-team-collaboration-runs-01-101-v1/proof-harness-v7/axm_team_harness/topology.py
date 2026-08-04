
from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class SeatRouteLock:
    identity_id: str
    current_route: str
    approved_routes: frozenset[str]
    authority_actions: frozenset[str]
    privacy_scope: int


def failover(lock: SeatRouteLock, *, requested_route: str, claimed_identity: str,
             requested_actions: set[str], requested_privacy_scope: int) -> dict:
    errors = []
    if requested_route not in lock.approved_routes:
        errors.append('UNAPPROVED_ROUTE')
    if claimed_identity != lock.identity_id:
        errors.append('SILENT_IDENTITY_SUBSTITUTION')
    if not requested_actions.issubset(lock.authority_actions):
        errors.append('FAILOVER_AUTHORITY_WIDENING')
    if requested_privacy_scope > lock.privacy_scope:
        errors.append('FAILOVER_PRIVACY_WIDENING')
    if errors:
        return {'ok': False, 'errors': errors, 'route': lock.current_route}
    return {'ok': True, 'errors': [], 'route': requested_route, 'identity_id': lock.identity_id,
            'receipt': {'previous_route': lock.current_route, 'new_route': requested_route, 'identity_preserved': True}}


def reconcile_partition(left: dict, right: dict) -> dict:
    if left.get('base_revision') == right.get('base_revision') and left.get('value') != right.get('value'):
        return {'ok': False, 'code': 'SPLIT_BRAIN_DIVERGENCE_HELD'}
    return {'ok': True, 'code': 'RECONCILABLE'}
