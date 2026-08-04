from __future__ import annotations
from dataclasses import dataclass
import hashlib
import json

ORDER = ['PREPARED','DELIVERED','RECEIVER_ACCEPTED','STARTED','RETURNED','RESULT_REVIEWED']

@dataclass(frozen=True)
class CustodyEvent:
    event_type: str
    actor: str
    task_id: str
    payload: dict
    previous_digest: str = ''

    def digest(self) -> str:
        body = {'event_type': self.event_type, 'actor': self.actor, 'task_id': self.task_id,
                'payload': self.payload, 'previous_digest': self.previous_digest}
        return hashlib.sha256(json.dumps(body, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def validate_custody(events: list[CustodyEvent], *, expected_items: set[str]) -> dict:
    errors = []
    seen = []
    prior = ''
    for e in events:
        if e.event_type not in ORDER:
            errors.append('UNKNOWN_EVENT')
            continue
        if e.previous_digest != prior:
            errors.append('BROKEN_CUSTODY_CHAIN')
        seen.append(e.event_type)
        prior = e.digest()
    indices = [ORDER.index(x) for x in seen if x in ORDER]
    if indices != sorted(indices) or len(set(seen)) != len(seen):
        errors.append('ILLEGAL_EVENT_ORDER')
    if 'STARTED' in seen and 'RECEIVER_ACCEPTED' not in seen:
        errors.append('START_WITHOUT_ACCEPTANCE')
    returned = set()
    reviewed = None
    for e in events:
        if e.event_type == 'RETURNED':
            returned = set(e.payload.get('items', []))
        if e.event_type == 'RESULT_REVIEWED':
            reviewed = e.payload.get('decision')
    complete = expected_items.issubset(returned)
    if reviewed == 'ACCEPT' and not complete:
        errors.append('PARTIAL_RETURN_SILENTLY_ACCEPTED')
    status = 'COMPLETE' if complete and reviewed == 'ACCEPT' and not errors else ('PARTIAL_HELD' if returned and not complete else 'HELD')
    return {'ok': not errors and status == 'COMPLETE', 'errors': errors, 'status': status, 'last_digest': prior}
