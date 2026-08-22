from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any

@dataclass
class ArtifactCell:
    revision: int = 0
    value: Any = None
    lease_holder: str | None = None
    lease_id: str | None = None
    idempotency_receipts: dict[str, dict[str, Any]] = field(default_factory=dict)

    def acquire(self, holder: str, lease_id: str) -> tuple[bool, str]:
        if self.lease_holder is not None and self.lease_holder != holder:
            return False, 'WRITE_LEASE_CONFLICT'
        self.lease_holder = holder
        self.lease_id = lease_id
        return True, 'LEASE_ACQUIRED'

    def release(self, holder: str, lease_id: str) -> tuple[bool, str]:
        if holder != self.lease_holder or lease_id != self.lease_id:
            return False, 'LEASE_RELEASE_DENIED'
        self.lease_holder = None
        self.lease_id = None
        return True, 'LEASE_RELEASED'

    def cas_write(self, holder: str, lease_id: str, expected_revision: int, value: Any,
                  idempotency_key: str) -> dict[str, Any]:
        if idempotency_key in self.idempotency_receipts:
            return dict(self.idempotency_receipts[idempotency_key])
        if holder != self.lease_holder or lease_id != self.lease_id:
            return {'ok': False, 'code': 'WRITE_LEASE_INVALID', 'revision': self.revision}
        if expected_revision != self.revision:
            return {'ok': False, 'code': 'STALE_BASE_REVISION', 'revision': self.revision}
        self.revision += 1
        self.value = value
        receipt = {'ok': True, 'code': 'WRITE_APPLIED', 'revision': self.revision, 'idempotency_key': idempotency_key}
        self.idempotency_receipts[idempotency_key] = dict(receipt)
        return receipt


def has_wait_cycle(wait_for: dict[str, set[str]]) -> bool:
    visiting: set[str] = set()
    visited: set[str] = set()
    def dfs(node: str) -> bool:
        if node in visiting:
            return True
        if node in visited:
            return False
        visiting.add(node)
        for nxt in wait_for.get(node, set()):
            if dfs(nxt):
                return True
        visiting.remove(node)
        visited.add(node)
        return False
    return any(dfs(node) for node in list(wait_for))
