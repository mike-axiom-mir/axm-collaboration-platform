
from __future__ import annotations
import copy
from pathlib import Path
from typing import Any
from .ledger import read_entries, replay_state, verify_entries


def recover(path: Path) -> dict[str, Any]:
    entries = read_entries(path)
    ok, error = verify_entries(entries)
    if not ok:
        return {'ok': False, 'error': error, 'known_state': 'HELD_CORRUPT', 'entry_count': len(entries)}
    return {'ok': True, 'error': None, 'known_state': replay_state(entries), 'entry_count': len(entries), 'head_hash': entries[-1]['entry_hash'] if entries else None}


def corrupt_copy(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    mutated = copy.deepcopy(entries)
    if mutated:
        mutated[-1]['event']['new_state'] = 'SILENTLY_CHANGED'
    return mutated
