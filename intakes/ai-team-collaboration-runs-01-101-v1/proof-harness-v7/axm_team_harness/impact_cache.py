from __future__ import annotations
import hashlib
import json
from typing import Any, Callable
from .selector import select_tests

def digest(obj: Any) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')).hexdigest()

class EvidenceCache:
    def __init__(self) -> None:
        self._cache: dict[str, Any] = {}
    def execute(self, contract: dict[str, Any], test_version: str, fn: Callable[[], Any]) -> tuple[Any, str]:
        key = digest({'contract': contract, 'test_version': test_version})
        if key in self._cache:
            return self._cache[key], 'CACHE_HIT'
        result = fn()
        self._cache[key] = result
        return result, 'CACHE_MISS'

def impact_plan(entries: list[dict[str, Any]], changed_module_ids: list[str], changed_root_contract: bool = False) -> dict[str, Any]:
    if changed_root_contract:
        return {'selected_count': len(entries), 'selected_module_ids': [e['module_id'] for e in entries], 'reason': 'ROOT_CONTRACT_CHANGED'}
    plan = select_tests(entries, changed_module_ids)
    plan['reason'] = 'SPARSE_DEPENDENCY_AND_RISK_CONE'
    return plan
