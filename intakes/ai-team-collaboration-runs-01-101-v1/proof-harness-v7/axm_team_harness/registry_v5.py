from __future__ import annotations
import json
from pathlib import Path
from typing import Any
from .registry import harness_root
REQUIRED={'coalition_profile','freshness_graph_profile','revocation_cascade_profile','workspace_profile','proof_frontier_profile','contestability_profile','information_barrier_profile','join_barrier_profile','role_reassignment_profile','intake_rehearsal_profile'}
def load_registry_v5(path: Path|None=None)->dict[str,Any]:
    target=path or harness_root()/'registry'/'seed_registry_v5.json'; d=json.loads(target.read_text())
    if d.get('registry_version')!='5.0.0' or d.get('seed_count')!=100 or len(d.get('entries',[]))!=100: raise ValueError('registry v5 invalid')
    ids=[e['module_id'] for e in d['entries']]
    if len(ids)!=len(set(ids)) or any(not x.startswith('axm.team.') for x in ids): raise ValueError('IDs invalid')
    for e in d['entries']:
        missing=REQUIRED-set(e)
        if missing: raise ValueError(f"{e['module_id']} missing {sorted(missing)}")
    return d
