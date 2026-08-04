from __future__ import annotations
import copy
from typing import Any

def deterministic_mutations(fixture: dict[str, Any], registry_entry: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    muts: list[tuple[str, dict[str, Any]]] = []
    def add(name: str, fn) -> None:
        f = copy.deepcopy(fixture)
        fn(f)
        muts.append((name, f))
    add('module-id', lambda f: f.__setitem__('module_id', 'axm.team.invalid'))
    add('proof-id', lambda f: f.__setitem__('proof_slice_id', 'PS-INVALID'))
    add('registry-digest', lambda f: f.__setitem__('registry_entry_digest', '0'*64))
    add('family', lambda f: f.__setitem__('family', 'invalid_family'))
    add('missing-actor', lambda f: f.pop('actor', None))
    add('missing-authority', lambda f: f.pop('authority', None))
    add('missing-task', lambda f: f.pop('task', None))
    add('missing-control', lambda f: f.pop('control', None))
    add('missing-evidence', lambda f: f.pop('evidence', None))
    add('missing-payload', lambda f: f.pop('payload', None))
    add('missing-human', lambda f: f.pop('human', None))
    add('missing-privacy', lambda f: f.pop('privacy', None))
    return muts
