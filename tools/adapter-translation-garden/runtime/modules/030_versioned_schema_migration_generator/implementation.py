from __future__ import annotations
from typing import Any


def run(source_schema: dict[str, Any], target_schema: dict[str, Any], *, rename_map: dict[str, str] | None = None, defaults: dict[str, Any] | None = None) -> dict[str, Any]:
    rename_map = dict(rename_map or {})
    defaults = dict(defaults or {})
    src = source_schema.get('properties', {})
    dst = target_schema.get('properties', {})
    src_required = set(source_schema.get('required', []))
    dst_required = set(target_schema.get('required', []))
    steps, issues = [], []
    reverse = {new: old for old, new in rename_map.items()}
    for old, new in sorted(rename_map.items()):
        if old not in src: issues.append({'kind': 'rename_source_missing', 'severity': 'blocking', 'source': old, 'target': new})
        elif new not in dst: issues.append({'kind': 'rename_target_missing', 'severity': 'blocking', 'source': old, 'target': new})
        else: steps.append({'operation': 'rename', 'from': old, 'to': new})
    consumed = set(rename_map)
    produced = set(rename_map.values())
    for name in sorted(src):
        if name in consumed: continue
        if name not in dst:
            steps.append({'operation': 'remove', 'field': name})
            issues.append({'kind': 'field_removed', 'severity': 'high', 'field': name, 'reversible': False})
        elif src[name].get('type') != dst[name].get('type'):
            steps.append({'operation': 'convert_type', 'field': name, 'from': src[name].get('type'), 'to': dst[name].get('type')})
            issues.append({'kind': 'type_change_requires_review', 'severity': 'high', 'field': name})
    for name in sorted(dst):
        if name in src or name in produced: continue
        if name in defaults:
            steps.append({'operation': 'add_default', 'field': name, 'value': defaults[name]})
        elif name in dst_required:
            issues.append({'kind': 'new_required_field_without_default', 'severity': 'blocking', 'field': name})
        else:
            steps.append({'operation': 'add_optional', 'field': name, 'value': None})
    for name in sorted(src_required - dst_required):
        if name in dst: steps.append({'operation': 'relax_required', 'field': name})
    for name in sorted(dst_required - src_required):
        source_name = reverse.get(name, name)
        if source_name in src: steps.append({'operation': 'enforce_required', 'field': name})
    blocking = any(x['severity'] == 'blocking' for x in issues)
    return {'schema': 'axm.translation.schema-migration-plan/v1', 'verdict': 'REFUSE' if blocking else ('REVIEW_REQUIRED' if issues else 'PLAN_READY'), 'steps': steps, 'issues': issues, 'migration_executed': False, 'source_schema_unchanged': True}
