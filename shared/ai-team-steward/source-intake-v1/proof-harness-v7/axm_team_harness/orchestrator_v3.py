
from __future__ import annotations
from dataclasses import dataclass, field

STEPS = ['ORIENT','CONTRACT','ALLOCATE','HANDOFF','WORK','CHALLENGE','VERIFY','MERGE_PROPOSE','HUMAN_DECIDE','CLOSE']

@dataclass
class DryRunOrchestrator:
    events: list[dict] = field(default_factory=list)
    stopped: bool = False

    def emit(self, step: str, **data) -> None:
        self.events.append({'sequence': len(self.events)+1, 'step': step, **data})

    def execute(self, *, task_id: str, authority_ok: bool, handoff_accepted: bool, independent_verification: bool,
                human_decision: str | None, orchestrator_self_approval: bool = False) -> dict:
        if self.stopped:
            return {'ok': False, 'code': 'ORCHESTRATOR_STOPPED', 'events': self.events}
        self.emit('ORIENT', task_id=task_id)
        if not authority_ok:
            self.emit('CONTRACT', status='HELD', reason='AUTHORITY_INVALID')
            return {'ok': False, 'code': 'AUTHORITY_INVALID', 'events': self.events}
        self.emit('CONTRACT', status='VALIDATED')
        self.emit('ALLOCATE', status='PROPOSED')
        self.emit('HANDOFF', status='ACCEPTED' if handoff_accepted else 'REFUSED')
        if not handoff_accepted:
            return {'ok': False, 'code': 'HANDOFF_NOT_ACCEPTED', 'events': self.events}
        self.emit('WORK', status='RETURNED')
        self.emit('CHALLENGE', dissent_preserved=True)
        self.emit('VERIFY', independent=independent_verification)
        if not independent_verification:
            return {'ok': False, 'code': 'INDEPENDENT_VERIFICATION_REQUIRED', 'events': self.events}
        self.emit('MERGE_PROPOSE', status='PROPOSAL_ONLY')
        if orchestrator_self_approval:
            return {'ok': False, 'code': 'ORCHESTRATOR_SELF_APPROVAL_DENIED', 'events': self.events}
        if human_decision not in {'ACCEPT','REJECT','POSTPONE','REVISE'}:
            return {'ok': False, 'code': 'EXPLICIT_HUMAN_DECISION_REQUIRED', 'events': self.events}
        self.emit('HUMAN_DECIDE', decision=human_decision)
        self.emit('CLOSE', status='READY_FOR_LOCAL_INTAKE_CANDIDATE' if human_decision == 'ACCEPT' else 'CLOSED_WITHOUT_MERGE')
        return {'ok': True, 'code': 'DRY_RUN_COMPLETE', 'events': self.events, 'integrated': False, 'canon': False,
                'max_status': self.events[-1]['status']}

    def stop(self, reason: str) -> dict:
        self.stopped = True
        self.emit('STOP', reason=reason)
        return {'ok': True, 'code': 'STOPPED'}
