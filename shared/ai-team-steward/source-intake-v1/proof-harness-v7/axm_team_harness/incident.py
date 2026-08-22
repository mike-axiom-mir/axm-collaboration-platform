
from __future__ import annotations
from dataclasses import dataclass, field

@dataclass
class IncidentController:
    stopped: set[str] = field(default_factory=set)
    frozen_leases: set[str] = field(default_factory=set)
    evidence: list[dict] = field(default_factory=list)

    def trip(self, task_tree: list[str], leases: list[str], reason: str) -> dict:
        self.stopped.update(task_tree)
        self.frozen_leases.update(leases)
        receipt = {'event': 'INCIDENT_TRIP', 'tasks': sorted(task_tree), 'leases': sorted(leases), 'reason': reason}
        self.evidence.append(receipt)
        return receipt

    def may_act(self, task_id: str, lease_id: str) -> tuple[bool, str]:
        if task_id in self.stopped or lease_id in self.frozen_leases:
            return False, 'INCIDENT_STOP_ACTIVE'
        return True, 'ACTIVE'

    def restart(self, task_tree: list[str], leases: list[str], *, human_receipt: str | None,
                recovery_checks_passed: bool, new_authority_receipt: str | None) -> dict:
        if not human_receipt:
            return {'ok': False, 'code': 'HUMAN_RESTART_DECISION_REQUIRED'}
        if not recovery_checks_passed:
            return {'ok': False, 'code': 'RECOVERY_CHECKS_NOT_PASSED'}
        if not new_authority_receipt:
            return {'ok': False, 'code': 'NEW_AUTHORITY_RECEIPT_REQUIRED'}
        self.stopped.difference_update(task_tree)
        self.frozen_leases.difference_update(leases)
        receipt = {'event': 'INCIDENT_RESTART', 'human_receipt': human_receipt, 'new_authority_receipt': new_authority_receipt}
        self.evidence.append(receipt)
        return {'ok': True, 'code': 'RESTARTED', 'receipt': receipt}
