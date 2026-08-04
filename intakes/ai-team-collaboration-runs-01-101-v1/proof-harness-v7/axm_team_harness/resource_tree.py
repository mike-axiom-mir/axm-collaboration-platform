
from __future__ import annotations
from dataclasses import dataclass, field

@dataclass
class BudgetTree:
    limit: int
    reservations: dict[str, int] = field(default_factory=dict)
    consumed: dict[str, int] = field(default_factory=dict)

    @property
    def reserved(self) -> int:
        return sum(self.reservations.values())

    def reserve(self, child: str, amount: int) -> tuple[bool, str]:
        if amount < 0:
            return False, 'NEGATIVE_RESERVATION'
        prior = self.reservations.get(child, 0)
        projected = self.reserved - prior + amount
        if projected > self.limit:
            return False, 'PARENT_BUDGET_EXCEEDED'
        self.reservations[child] = amount
        return True, 'RESERVED'

    def consume(self, child: str, amount: int) -> tuple[bool, str]:
        if amount < 0 or amount + self.consumed.get(child, 0) > self.reservations.get(child, 0):
            return False, 'CHILD_ENVELOPE_EXCEEDED'
        self.consumed[child] = self.consumed.get(child, 0) + amount
        return True, 'CONSUMED'

    def release(self, child: str) -> int:
        self.consumed.pop(child, None)
        return self.reservations.pop(child, 0)


def fair_schedule(items: list[dict], slots: int) -> list[str]:
    # Deterministic aging: priority + age, with task_id tie break.
    queue = [dict(x) for x in items]
    result = []
    for _ in range(min(slots, len(queue))):
        queue.sort(key=lambda x: (-(x.get('priority',0) + x.get('age',0)), x['task_id']))
        chosen = queue.pop(0)
        result.append(chosen['task_id'])
        for x in queue:
            x['age'] = x.get('age',0) + 1
    return result
