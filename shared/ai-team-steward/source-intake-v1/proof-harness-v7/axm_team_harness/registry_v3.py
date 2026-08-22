
from __future__ import annotations
import json
from pathlib import Path
from typing import Any
from .registry import harness_root


def load_registry_v3(path: Path | None = None) -> dict[str, Any]:
    target = path or harness_root() / 'registry' / 'seed_registry_v3.json'
    data = json.loads(target.read_text(encoding='utf-8'))
    entries = data.get('entries', [])
    if data.get('registry_version') != '3.0.0':
        raise ValueError('Expected registry v3.0.0.')
    if data.get('seed_count') != 100 or len(entries) != 100:
        raise ValueError('Registry v3 must contain exactly 100 seeds.')
    ids = [entry['module_id'] for entry in entries]
    if len(ids) != len(set(ids)) or any(not x.startswith('axm.team.') for x in ids):
        raise ValueError('Registry v3 IDs are invalid or duplicated.')
    required = {'delegation_profile','taint_profile','independence_profile','resource_tree_profile','proof_graph_profile',
                'human_decision_profile','incident_profile','topology_profile','disclosure_profile','dry_run_profile'}
    for entry in entries:
        missing = sorted(required - set(entry))
        if missing:
            raise ValueError(f"{entry['module_id']} missing v3 profiles: {missing}")
    return data
