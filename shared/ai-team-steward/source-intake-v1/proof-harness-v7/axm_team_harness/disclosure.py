
from __future__ import annotations
from typing import Any

FORBIDDEN_TOKENS = ('raw_prompt','token','secret_note','private_memory','private_context','api_key','password')


def public_export(record: dict[str, Any], *, allowlist: set[str], supported_claims: set[str]) -> dict[str, Any]:
    output = {k: record[k] for k in allowlist if k in record}
    text = repr(output).lower()
    leaks = [x for x in FORBIDDEN_TOKENS if x in text]
    claims = set(record.get('claims', []))
    unsupported = sorted(claims - supported_claims)
    if leaks:
        return {'ok': False, 'code': 'PUBLIC_EXPORT_PRIVATE_LEAK', 'leaks': leaks}
    if unsupported:
        return {'ok': False, 'code': 'UNSUPPORTED_PUBLIC_CLAIM', 'unsupported': unsupported}
    output['claims'] = sorted(claims)
    output['limitations'] = record.get('limitations', ['Not AXM runtime proof.'])
    return {'ok': True, 'code': 'PUBLIC_SAFE_EXPORT', 'output': output, 'redacted_fields': sorted(set(record) - allowlist - {'claims','limitations'})}


def reidentification_risk(output: dict[str, Any], *, quasi_identifiers: set[str], unique_threshold: int = 3) -> dict:
    present = quasi_identifiers & set(output)
    if len(present) >= unique_threshold:
        return {'ok': False, 'code': 'REIDENTIFICATION_RISK_HELD', 'fields': sorted(present)}
    return {'ok': True, 'code': 'LOW_REIDENTIFICATION_SIGNAL'}
