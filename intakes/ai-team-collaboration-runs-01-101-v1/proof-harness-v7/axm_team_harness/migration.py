from __future__ import annotations
import copy
import hashlib
import json
from typing import Any

PRESERVED_FIELDS = ('seed_number', 'module_id', 'name', 'family', 'risk_tier', 'proof_slice_id',
                    'critical_invariant', 'hold_rule', 'dependency_module_ids', 'binding_contracts',
                    'owner_seam_candidate', 'canon_status')

def digest(obj: Any) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')).hexdigest()

def migrate_v1_to_v2(entry: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    out = copy.deepcopy(entry)
    before = {k: copy.deepcopy(entry.get(k)) for k in PRESERVED_FIELDS}
    out['previous_contract_version'] = entry.get('contract_version', 'axm.team.seed-contract.v1')
    out['contract_version'] = 'axm.team.seed-contract.v2'
    out.setdefault('migration_receipts', []).append({'from': out['previous_contract_version'], 'to': out['contract_version'], 'before_digest': digest(before)})
    return out, {'ok': True, 'preserved_digest': digest(before), 'losses': []}

def project_back_to_v1(entry_v2: dict[str, Any]) -> dict[str, Any]:
    return {k: copy.deepcopy(entry_v2.get(k)) for k in PRESERVED_FIELDS}

def check_roundtrip(original: dict[str, Any], migrated: dict[str, Any]) -> bool:
    return {k: original.get(k) for k in PRESERVED_FIELDS} == project_back_to_v1(migrated)

def adapt_payload(payload: dict[str, Any], allowlist: set[str], required: set[str]) -> dict[str, Any]:
    projected = {k: copy.deepcopy(v) for k, v in payload.items() if k in allowlist}
    lost = sorted(set(payload) - set(projected))
    required_lost = sorted(required - set(projected))
    return {'ok': not required_lost, 'projected': projected, 'lost_fields': lost, 'required_lost': required_lost,
            'code': 'ADAPTER_OK' if not required_lost else 'REQUIRED_FIELD_LOSS'}
