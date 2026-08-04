
from __future__ import annotations
import hashlib
import json
from pathlib import Path
from typing import Any, Iterable

GENESIS = '0' * 64


def _canonical(obj: Any) -> bytes:
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode('utf-8')


def make_entry(event: dict[str, Any], previous_hash: str, sequence: int) -> dict[str, Any]:
    payload = {'sequence': sequence, 'previous_hash': previous_hash, 'event': event}
    entry_hash = hashlib.sha256(_canonical(payload)).hexdigest()
    return {**payload, 'entry_hash': entry_hash}


def append_event(path: Path, event: dict[str, Any]) -> dict[str, Any]:
    entries = read_entries(path) if path.exists() else []
    previous_hash = entries[-1]['entry_hash'] if entries else GENESIS
    entry = make_entry(event, previous_hash, len(entries) + 1)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a', encoding='utf-8') as f:
        f.write(json.dumps(entry, ensure_ascii=False, sort_keys=True) + '\n')
    return entry


def read_entries(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]


def verify_entries(entries: Iterable[dict[str, Any]]) -> tuple[bool, str | None]:
    previous = GENESIS
    expected_sequence = 1
    for entry in entries:
        if entry.get('sequence') != expected_sequence:
            return False, 'SEQUENCE_BREAK'
        if entry.get('previous_hash') != previous:
            return False, 'PREVIOUS_HASH_MISMATCH'
        payload = {'sequence': entry['sequence'], 'previous_hash': entry['previous_hash'], 'event': entry['event']}
        expected_hash = hashlib.sha256(_canonical(payload)).hexdigest()
        if entry.get('entry_hash') != expected_hash:
            return False, 'ENTRY_HASH_MISMATCH'
        previous = entry['entry_hash']
        expected_sequence += 1
    return True, None


def verify_file(path: Path) -> tuple[bool, str | None]:
    return verify_entries(read_entries(path))


def replay_state(entries: Iterable[dict[str, Any]]) -> str:
    state = 'DRAFT'
    for entry in entries:
        event = entry.get('event', {})
        state = event.get('new_state', state)
    return state
