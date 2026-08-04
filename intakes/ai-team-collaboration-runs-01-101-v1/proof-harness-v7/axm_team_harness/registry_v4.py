from __future__ import annotations
import json
from pathlib import Path
from typing import Any
from .registry import harness_root

REQUIRED_V4 = {
    'attestation_profile','quorum_profile','custody_profile','saga_profile','metamorphic_profile',
    'claim_ledger_profile','compatibility_profile','attention_profile','appeal_profile','release_profile'
}

def load_registry_v4(path: Path | None = None) -> dict[str, Any]:
    target = path or harness_root() / 'registry' / 'seed_registry_v4.json'
    data = json.loads(target.read_text(encoding='utf-8'))
    entries = data.get('entries', [])
    if data.get('registry_version') != '4.0.0':
        raise ValueError('Expected registry v4.0.0.')
    if data.get('seed_count') != 100 or len(entries) != 100:
        raise ValueError('Registry v4 must contain exactly 100 seeds.')
    ids = [e['module_id'] for e in entries]
    if len(ids) != len(set(ids)) or any(not x.startswith('axm.team.') for x in ids):
        raise ValueError('Registry v4 IDs invalid or duplicated.')
    for e in entries:
        missing = sorted(REQUIRED_V4 - set(e))
        if missing:
            raise ValueError(f"{e['module_id']} missing v4 profiles: {missing}")
    return data
