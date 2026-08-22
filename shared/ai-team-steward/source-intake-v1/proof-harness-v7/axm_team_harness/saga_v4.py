from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class SagaStep:
    name: str
    reversible: bool = True


def execute_saga(steps: list[SagaStep], *, fail_at: str | None = None, human_irreversible_approval: bool = False,
                 compensation_fail_at: str | None = None) -> dict:
    applied: list[SagaStep] = []
    receipts = []
    for step in steps:
        if not step.reversible and not human_irreversible_approval:
            return {'ok': False, 'status': 'HELD', 'code': 'IRREVERSIBLE_WITHOUT_HUMAN', 'receipts': receipts}
        if step.name == fail_at:
            compensated = []
            for prior in reversed(applied):
                if prior.reversible:
                    if prior.name == compensation_fail_at:
                        return {'ok': False, 'status': 'HELD_RECOVERY_REQUIRED', 'code': 'COMPENSATION_FAILED',
                                'compensated': compensated, 'receipts': receipts}
                    compensated.append(prior.name)
                    receipts.append({'type': 'COMPENSATED', 'step': prior.name})
            return {'ok': False, 'status': 'ROLLED_BACK', 'code': 'STEP_FAILED', 'compensated': compensated, 'receipts': receipts}
        applied.append(step)
        receipts.append({'type': 'APPLIED_PROPOSAL', 'step': step.name})
    return {'ok': True, 'status': 'PROPOSAL_COMPLETE_NOT_COMMITTED', 'applied': [s.name for s in applied], 'receipts': receipts}
