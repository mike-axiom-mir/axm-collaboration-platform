
from __future__ import annotations
import json
from pathlib import Path
from typing import Any


def harness_root() -> Path:
    return Path(__file__).resolve().parents[1]


def load_registry(path: Path | None = None) -> dict[str, Any]:
    target = path or harness_root() / 'registry' / 'seed_registry.json'
    data = json.loads(target.read_text(encoding='utf-8'))
    entries = data.get('entries', [])
    if data.get('seed_count') != 100 or len(entries) != 100:
        raise ValueError('Registry must contain exactly 100 seeds.')
    ids = [entry['module_id'] for entry in entries]
    if len(ids) != len(set(ids)):
        raise ValueError('Registry module IDs must be unique.')
    if any(not module_id.startswith('axm.team.') for module_id in ids):
        raise ValueError('Registry contains an invalid namespace.')
    return data


def by_module_id(registry: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {entry['module_id']: entry for entry in registry['entries']}
