from __future__ import annotations
import copy
from typing import Any


def run(observation: dict[str, Any], *, consent_lease: dict[str, Any], allowlist: list[str], now: str, max_payload_bytes: int = 4096) -> dict[str, Any]:
    errors=[]; device_id=observation.get('device_id') or observation.get('tag_id'); kind=observation.get('kind')
    if device_id not in set(allowlist): errors.append('identity_not_allowlisted')
    required=f'proximity:{kind}'
    if required not in set(consent_lease.get('scopes',[])): errors.append('missing_consent_scope')
    if not consent_lease.get('lease_id'): errors.append('missing_lease_id')
    expires=consent_lease.get('expires_at')
    if expires is not None and str(expires)<=str(now): errors.append('consent_expired')
    payload=observation.get('payload')
    size=len(payload.encode('utf-8')) if isinstance(payload,str) else len(payload) if isinstance(payload,(bytes,bytearray)) else len(str(payload).encode('utf-8')) if payload is not None else 0
    if size>max_payload_bytes: errors.append('payload_too_large')
    if observation.get('hidden_identifier'): errors.append('hidden_identifier_refused')
    event={'schema':'axm.translation.proximity-event/v1','kind':kind,'identity':device_id,'payload':copy.deepcopy(payload),'observed_at':observation.get('observed_at'),'consent_lease_id':consent_lease.get('lease_id'),'source_evidence':copy.deepcopy(observation.get('evidence')),'performed':False}
    return {'verdict':'EVENT_READY' if not errors else 'REFUSE','event':event if not errors else None,'errors':errors,'radio_access':False,'paired':False,'sent':False}
