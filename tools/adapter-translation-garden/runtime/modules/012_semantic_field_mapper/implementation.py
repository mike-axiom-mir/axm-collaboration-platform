from __future__ import annotations
from copy import deepcopy
from typing import Any

from axm_translation_core import add_loss, new_loss_ledger

_MISSING = object()


def _read_path(value: Any, path: str) -> Any:
    current = value
    if path in {'', '$'}:
        return current
    clean = path[2:] if path.startswith('$.') else path
    for part in clean.split('.'):
        if not isinstance(current, dict) or part not in current:
            return _MISSING
        current = current[part]
    return current


def _write_path(target: dict[str, Any], path: str, value: Any) -> None:
    clean = path[2:] if path.startswith('$.') else path
    parts = [part for part in clean.split('.') if part]
    if not parts:
        raise ValueError('target path may not be root')
    current = target
    for part in parts[:-1]:
        existing = current.get(part)
        if existing is None:
            current[part] = {}
        elif not isinstance(existing, dict):
            raise ValueError(f'target path collides with scalar at {part}')
        current = current[part]
    current[parts[-1]] = deepcopy(value)


def _coerce(value: Any, mode: str) -> Any:
    if mode == 'identity':
        return deepcopy(value)
    if mode == 'string':
        return str(value)
    if mode == 'integer':
        if isinstance(value, bool):
            raise ValueError('boolean is not accepted as integer')
        return int(value)
    if mode == 'number':
        if isinstance(value, bool):
            raise ValueError('boolean is not accepted as number')
        return float(value)
    if mode == 'boolean':
        if not isinstance(value, bool):
            raise ValueError('only explicit booleans are accepted')
        return value
    if mode == 'list':
        return list(value) if isinstance(value, (list, tuple)) else [deepcopy(value)]
    raise ValueError(f'unsupported coercion: {mode}')


def run(
    source: dict[str, Any],
    rules: list[dict[str, Any]],
    *,
    target: dict[str, Any] | None = None,
    require_confirmation: bool = True,
    preserve_unmapped: bool = True,
) -> dict[str, Any]:
    """Apply only explicit semantic rules. No fuzzy name matching is performed."""
    if not isinstance(source, dict):
        raise TypeError('source must be an object')
    if not isinstance(rules, list):
        raise TypeError('rules must be a list')
    output = deepcopy(target or {})
    ledger = new_loss_ledger()
    mapped: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []
    disputes: list[dict[str, Any]] = []
    used_top_level: set[str] = set()

    for index, rule in enumerate(rules):
        target_path = rule.get('target')
        sources = rule.get('sources') or ([rule['source']] if 'source' in rule else [])
        meaning = rule.get('meaning')
        confirmed = rule.get('confirmed') is True
        if not target_path or not sources or not meaning:
            item = {'rule_index': index, 'reason': 'rule requires target, source(s), and meaning', 'rule': deepcopy(rule)}
            unresolved.append(item)
            add_loss(ledger, kind='incomplete_mapping_rule', path=f'$.rules[{index}]', reason=item['reason'], severity='high')
            continue
        if require_confirmation and not confirmed:
            item = {'rule_index': index, 'target': target_path, 'sources': sources, 'reason': 'mapping was not explicitly confirmed'}
            unresolved.append(item)
            add_loss(ledger, kind='unconfirmed_semantic_mapping', path=target_path, reason=item['reason'], severity='high')
            continue
        candidates = []
        for source_path in sources:
            value = _read_path(source, source_path)
            if value is not _MISSING:
                candidates.append((source_path, value))
                clean = source_path[2:] if source_path.startswith('$.') else source_path
                used_top_level.add(clean.split('.')[0])
        if not candidates:
            item = {'rule_index': index, 'target': target_path, 'sources': sources, 'reason': 'no declared source path was present'}
            unresolved.append(item)
            add_loss(ledger, kind='source_field_missing', path=target_path, reason=item['reason'], severity='medium')
            continue
        distinct = []
        for _, value in candidates:
            if not any(value == existing for existing in distinct):
                distinct.append(value)
        if len(distinct) > 1 and 'select' not in rule:
            item = {'rule_index': index, 'target': target_path, 'candidates': deepcopy(candidates), 'reason': 'candidate source values disagree'}
            disputes.append(item)
            add_loss(ledger, kind='disputed_mapping', path=target_path, source_value=[v for _, v in candidates], reason=item['reason'], severity='blocking')
            continue
        selected_index = int(rule.get('select', 0))
        if selected_index < 0 or selected_index >= len(candidates):
            item = {'rule_index': index, 'target': target_path, 'reason': 'selected candidate index is out of range'}
            unresolved.append(item)
            add_loss(ledger, kind='invalid_mapping_selection', path=target_path, reason=item['reason'], severity='blocking')
            continue
        source_path, value = candidates[selected_index]
        try:
            transformed = _coerce(value, str(rule.get('coerce', 'identity')))
            _write_path(output, target_path, transformed)
        except (TypeError, ValueError) as exc:
            item = {'rule_index': index, 'target': target_path, 'source': source_path, 'reason': str(exc)}
            unresolved.append(item)
            add_loss(ledger, kind='mapping_conversion_failed', path=target_path, source_value=value, reason=str(exc), severity='blocking')
            continue
        mapped.append({
            'source': source_path,
            'target': target_path,
            'meaning': meaning,
            'value': deepcopy(transformed),
            'confidence': rule.get('confidence'),
            'evidence': deepcopy(rule.get('evidence', [])),
        })

    unmapped = {key: deepcopy(value) for key, value in source.items() if key not in used_top_level}
    if preserve_unmapped and unmapped:
        output.setdefault('_axm_unmapped_source', unmapped)
    return {
        'schema': 'axm.translation.semantic-mapping-report/v1',
        'ok': not ledger['summary']['has_blocking_loss'],
        'mapped': output,
        'mappings': mapped,
        'unresolved': unresolved,
        'disputes': disputes,
        'unmapped_source': unmapped,
        'loss': ledger,
        'method': 'explicit_semantic_rules_only',
    }
