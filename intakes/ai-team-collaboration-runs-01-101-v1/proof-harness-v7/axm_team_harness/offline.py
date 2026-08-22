from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any

@dataclass
class BoundedOfflineQueue:
    limit: int
    packets: list[dict[str, Any]] = field(default_factory=list)
    ids: set[str] = field(default_factory=set)

    def enqueue(self, packet: dict[str, Any]) -> tuple[bool, str]:
        packet_id = str(packet.get('packet_id', ''))
        if not packet_id:
            return False, 'PACKET_ID_REQUIRED'
        if packet_id in self.ids:
            return True, 'DUPLICATE_SUPPRESSED'
        if packet.get('authority_expired'):
            return False, 'AUTHORITY_EXPIRED_PACKET_HELD'
        if len(self.packets) >= self.limit:
            return False, 'OFFLINE_QUEUE_FULL'
        self.ids.add(packet_id)
        self.packets.append(dict(packet))
        return True, 'QUEUED'

def reconcile(local: dict[str, Any], remote: dict[str, Any]) -> dict[str, Any]:
    if local.get('packet_id') == remote.get('packet_id'):
        return {'ok': True, 'code': 'DUPLICATE_REPLAY_SUPPRESSED', 'winner': 'same_packet'}
    if local.get('base_revision') == remote.get('base_revision') and local.get('value') != remote.get('value'):
        return {'ok': False, 'code': 'DIVERGENT_SAME_BASE_HELD', 'winner': None}
    if int(local.get('revision', 0)) > int(remote.get('revision', 0)):
        return {'ok': True, 'code': 'LOCAL_NEWER', 'winner': 'local'}
    if int(remote.get('revision', 0)) > int(local.get('revision', 0)):
        return {'ok': True, 'code': 'REMOTE_NEWER', 'winner': 'remote'}
    return {'ok': False, 'code': 'AMBIGUOUS_RECONCILIATION_HELD', 'winner': None}
