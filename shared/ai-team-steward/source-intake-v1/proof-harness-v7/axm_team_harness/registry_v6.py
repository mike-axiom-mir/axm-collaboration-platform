from __future__ import annotations
import json
from pathlib import Path
from typing import Any
from .registry import harness_root
REQUIRED={
 'delegation_closure_profile','authority_epoch_profile','evidence_custody_v6_profile',
 'partial_failure_profile','proof_compaction_profile','review_session_profile',
 'causal_reconciliation_profile','proof_summary_profile','sandbox_intake_profile',
 'readiness_gate_v6_profile'}
def load_registry_v6(path:Path|None=None)->dict[str,Any]:
    target=path or harness_root()/'registry'/'seed_registry_v6.json'
    d=json.loads(target.read_text(encoding='utf-8'))
    if d.get('registry_version')!='6.0.0' or d.get('seed_count')!=100 or len(d.get('entries',[]))!=100:
        raise ValueError('registry v6 invalid')
    ids=[e['module_id'] for e in d['entries']]
    if len(ids)!=len(set(ids)) or any(not x.startswith('axm.team.') for x in ids):
        raise ValueError('registry v6 IDs invalid')
    for e in d['entries']:
        missing=REQUIRED-set(e)
        if missing:
            raise ValueError(f"{e['module_id']} missing {sorted(missing)}")
    return d
