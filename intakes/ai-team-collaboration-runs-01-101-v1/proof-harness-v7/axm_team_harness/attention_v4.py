from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class ReviewItem:
    item_id: str
    priority: int
    risk: int
    age: int
    effort: int
    human_required: bool = True


def schedule_reviews(items: list[ReviewItem], *, budget: int, fatigue_used: int, fatigue_threshold: int) -> dict:
    if fatigue_used >= fatigue_threshold:
        return {'ok': False, 'code': 'FATIGUE_HOLD', 'selected': [], 'held': [x.item_id for x in items], 'auto_approved': []}
    ranked = sorted(items, key=lambda x: (-(x.risk * 100 + x.priority * 10 + x.age), x.item_id))
    selected, held, spent = [], [], 0
    for item in ranked:
        if spent + item.effort <= budget and fatigue_used + spent + item.effort <= fatigue_threshold:
            selected.append(item.item_id); spent += item.effort
        else:
            held.append(item.item_id)
    return {'ok': True, 'selected': selected, 'held': held, 'spent': spent, 'auto_approved': []}
