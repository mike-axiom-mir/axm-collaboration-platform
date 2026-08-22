from __future__ import annotations
import json
from pathlib import Path
from typing import Any
from .registry import harness_root
REQUIRED={
 'decision_snapshot_profile','receipt_auth_profile','canonical_package_profile',
 'transaction_rehearsal_profile','invariant_bundle_profile','launch_selftest_profile',
 'human_handoff_profile','archive_safety_profile','lineage_audit_profile','final_gate_v7_profile'}
def load_registry_v7(path:Path|None=None)->dict[str,Any]:
    target=path or harness_root()/'registry'/'seed_registry_v7.json'
    d=json.loads(target.read_text(encoding='utf-8'))
    if d.get('registry_version')!='7.0.0' or d.get('seed_count')!=100 or len(d.get('entries',[]))!=100:
        raise ValueError('registry v7 invalid')
    ids=[e['module_id'] for e in d['entries']]
    if len(ids)!=len(set(ids)) or any(not x.startswith('axm.team.') for x in ids):
        raise ValueError('registry v7 IDs invalid')
    for e in d['entries']:
        missing=REQUIRED-set(e)
        if missing:
            raise ValueError(f"{e['module_id']} missing {sorted(missing)}")
    return d
