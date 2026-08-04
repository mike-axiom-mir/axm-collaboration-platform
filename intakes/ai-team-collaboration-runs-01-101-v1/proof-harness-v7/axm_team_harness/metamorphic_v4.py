from __future__ import annotations
import hashlib
import json


def canonical_semantics(packet: dict, *, non_semantic_fields: set[str]) -> str:
    reduced = {k: v for k, v in packet.items() if k not in non_semantic_fields}
    return hashlib.sha256(json.dumps(reduced, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def metamorphic_equivalent(a: dict, b: dict, *, non_semantic_fields: set[str]) -> bool:
    return canonical_semantics(a, non_semantic_fields=non_semantic_fields) == canonical_semantics(b, non_semantic_fields=non_semantic_fields)


def select_tests(*, changed_fields: set[str], semantic_fields: set[str], root_change: bool, module_test: str, all_tests: set[str]) -> dict:
    if root_change:
        return {'forced_full': True, 'selected': sorted(all_tests)}
    if changed_fields & semantic_fields:
        return {'forced_full': False, 'selected': [module_test, 'test:semantic-contract']}
    return {'forced_full': False, 'selected': [module_test]}


def evidence_reusable(prior: dict, current: dict) -> bool:
    required = {'contract_digest','test_digest','fixture_digest','validator_digest','semantic_digest','passed'}
    return required.issubset(prior) and required.issubset(current) and prior == current and bool(prior.get('passed'))
