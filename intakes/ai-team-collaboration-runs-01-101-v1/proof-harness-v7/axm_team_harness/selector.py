
from __future__ import annotations
from typing import Any, Iterable

ROOT_RISK_FAMILIES = {'identity_authority_privacy', 'guardrails_recovery', 'human_governance'}
ROOT_RISK_MODULES = {'axm.team.authority-lease', 'axm.team.private-memory-boundary', 'axm.team.guardian-tripwire', 'axm.team.emergency-stop-neutralizer', 'axm.team.human-merge-gate', 'axm.team.bounded-collaboration-orchestrator'}


def select_tests(entries: list[dict[str, Any]], changed_module_ids: Iterable[str]) -> dict[str, Any]:
    changed = set(changed_module_ids)
    by_id = {entry['module_id']: entry for entry in entries}
    unknown = changed - set(by_id)
    if unknown:
        raise ValueError(f'Unknown module IDs: {sorted(unknown)}')
    force_full = any(mid in ROOT_RISK_MODULES or by_id[mid]['risk_tier'] == 'CRITICAL' for mid in changed)
    if force_full:
        selected = list(by_id)
        reason = 'ROOT_OR_CRITICAL_CHANGE_FORCES_FULL_SUITE'
    else:
        families = {by_id[mid]['family'] for mid in changed}
        selected_set = set(changed)
        for entry in entries:
            deps = set(entry.get('dependency_module_ids', []))
            if entry['family'] in families or deps.intersection(changed):
                selected_set.add(entry['module_id'])
        selected = sorted(selected_set)
        reason = 'SPARSE_FAMILY_AND_DEPENDENCY_IMPACT_CONE'
    return {'selected_module_ids': selected, 'selected_count': len(selected), 'full_count': len(entries), 'reason': reason}
