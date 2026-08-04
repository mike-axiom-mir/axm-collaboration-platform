from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import stat
import textwrap
import zipfile
from pathlib import Path
from typing import Any

BASE = Path('/mnt/data/AXM_ADAPTERS_TRANSLATION_STEWARD_WORKING')
SOURCE_ZIP = Path('/mnt/data/AXM_ADAPTERS_TRANSLATION_100_SEED_PACK.zip')
INSPECT = Path('/mnt/data/_axm_seed_inspect/AXM_ADAPTERS_TRANSLATION_100_SEED_PACK')
GARDEN = BASE / '03_GROWTH' / 'AXM_ADAPTERS_TRANSLATION_GARDEN'
FROZEN = BASE / '00_FROZEN_SOURCE'
RUNS = BASE / '01_RUNS'
LEDGER = BASE / '02_APPEND_ONLY_LEDGERS' / 'RUN_LEDGER.jsonl'


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8', newline='\n')


def write_json(path: Path, obj: Any) -> None:
    write(path, json.dumps(obj, indent=2, ensure_ascii=False, sort_keys=False) + '\n')


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def slugify(name: str) -> str:
    s = name.lower().replace('–', '-').replace('—', '-')
    s = re.sub(r'[^a-z0-9]+', '_', s).strip('_')
    return s


def append_ledger(obj: dict[str, Any]) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    existing = []
    if LEDGER.exists():
        existing = [line for line in LEDGER.read_text(encoding='utf-8').splitlines() if line.strip()]
    run = obj['run']
    kept = []
    for line in existing:
        try:
            if json.loads(line).get('run') == run:
                continue
        except json.JSONDecodeError:
            pass
        kept.append(line)
    kept.append(json.dumps(obj, ensure_ascii=False, sort_keys=True))
    write(LEDGER, '\n'.join(kept) + '\n')


mods = [json.loads(line) for line in (INSPECT / 'MODULES_001_100.jsonl').read_text(encoding='utf-8').splitlines() if line.strip()]
assert len(mods) == 100

# Preserve the exact seed source and extracted files.
FROZEN.mkdir(parents=True, exist_ok=True)
shutil.copy2(SOURCE_ZIP, FROZEN / SOURCE_ZIP.name)
extracted = FROZEN / 'EXTRACTED_SEED_PACK'
if extracted.exists():
    shutil.rmtree(extracted)
shutil.copytree(INSPECT, extracted)

# Rebuild only the detached growth tree, never the source or prior run logs.
if GARDEN.exists():
    shutil.rmtree(GARDEN)
GARDEN.mkdir(parents=True)

high_restraint = {43, 46, 48, 66, 68, 70, 74, 80, 94, 100}
spine = {3, 20, 81, 85, 90, 99}
discovery = set(range(1, 11))
implemented = spine | discovery | {11}

protected_roots = [
    'axm.mirror.adapter/v1',
    'Native Host Adapter trust/transaction/inspection/rollback boundaries',
    'Sensorium capability negotiation and authority leases',
    'Portable Controls semantic profiles and host-authority split',
    'Asset Engine Roundtrip Bridge loss registry and source-linked parity receipts',
]

hard_dependencies: dict[int, list[int]] = {
    9: [3, 85],
    10: [20],
    29: [28, 86, 90],
    30: [20, 28, 85, 90],
    52: [3, 20, 85, 86, 89, 90],
    85: [3],
    87: [3, 85, 86],
    89: [3, 20, 52, 85],
    90: [3, 20, 85],
    92: [91],
    93: [20],
    94: [81, 82, 91, 92, 93],
    95: [20, 93],
    96: [3],
    97: [3, 90],
    98: [3, 81, 90],
    99: [20, 85, 90],
    100: [1, 2, 6, 7, 20, 81, 82, 85, 89, 90, 91, 92, 93, 94, 95, 99],
}

id_by_num = {m['number']: m['id'] for m in mods}

# Top-level project files.
write(GARDEN / 'README.md', """# AXM Adapters & Translation — Modular Growth Garden

This is a **detached, local-first growth branch** created from the 100 working seeds.

It is designed for later selective AXM intake:

- all 100 seeds are preserved as separate module capsules;
- the original seed pack remains frozen and unchanged;
- every capsule has its own manifest, boundary, status, and intake notes;
- safe foundation modules have dependency-free Python prototypes;
- native, plugin, device, migration, chain, and orchestration modules remain contract-only or shadow-only;
- nothing is CANON, installed, auto-enabled, or granted authority.

## What works now

Six truth/proof modules and ten read-only discovery modules have local pure-function prototypes. The included integration demo moves a small declared contract through inspection, fingerprinting, negotiation, allowlisting, diff preview, proof-packet creation, and human explanation.

## Beginner quick start

Windows: double-click `QUICK_TEST_WINDOWS.bat`.

Terminal:

```bash
python run_tests.py
python examples/demo_safe_translation_pipeline.py
python tools/list_modules.py
```

No packages need to be installed. Python 3.10+ is recommended.

## Intake rule

AXM may copy one module folder at a time. Read `module.json` first. A module must not receive more authority than its manifest allows. `contract_only` and `shadow_only` mean **not runnable**.
""")

write(GARDEN / 'ACTION_REPORT.md', """# Action Report

## Done

- Preserved the exact source ZIP and extracted source documents.
- Created 100 independent module capsules with machine-readable manifests.
- Added common request, result, loss, proof, and module-manifest contracts.
- Implemented six truth/proof foundations as pure local functions.
- Implemented ten discovery/contract modules as pure read-only functions.
- Added unit tests, structural validation, an integration demo, and Windows/Linux launch helpers.

## Not done

- No module was installed into AXM.
- No module was promoted to CANON.
- No native engine, device, plugin, network service, runtime bootstrap, emulator, or migration path was executed.
- The remaining 84 modules are capsules/contracts, not runtime implementations.
- No claim is made that format, protocol, engine, or device compatibility is complete.

## Safe next growth direction

Grow categories 2 and 9 next: semantic truth, loss visibility, fixtures, malformed-input tests, and round-trip proof. Keep routing and orchestration last.
""")

write(GARDEN / 'QUICK_TEST_WINDOWS.bat', """@echo off
setlocal
cd /d "%~dp0"
python run_tests.py
if errorlevel 1 (
  echo.
  echo AXM translation garden tests FAILED.
  pause
  exit /b 1
)
echo.
echo Running safe pipeline demo...
python examples\\demo_safe_translation_pipeline.py
pause
""")

write(GARDEN / 'quick_test.sh', """#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
python3 run_tests.py
python3 examples/demo_safe_translation_pipeline.py
""")
os.chmod(GARDEN / 'quick_test.sh', os.stat(GARDEN / 'quick_test.sh').st_mode | stat.S_IXUSR)

# Contract schemas.
module_schema = {
    '$schema': 'https://json-schema.org/draft/2020-12/schema',
    '$id': 'axm://contracts/module-manifest/v1',
    'title': 'AXM Detached Module Manifest',
    'type': 'object',
    'required': ['schema', 'number', 'id', 'name', 'status', 'version', 'authority_mode', 'implementation'],
    'properties': {
        'schema': {'const': 'axm.detached.module-manifest/v1'},
        'number': {'type': 'integer', 'minimum': 1},
        'id': {'type': 'string', 'minLength': 3},
        'name': {'type': 'string', 'minLength': 1},
        'category': {'type': 'string'},
        'purpose': {'type': 'string'},
        'status': {'enum': ['WORKING_CANDIDATE', 'LOCAL_PROTOTYPE', 'SHADOW_ONLY']},
        'version': {'type': 'string'},
        'authority_mode': {'enum': ['none', 'inspect_only', 'decision_only', 'shadow_only']},
        'default_enabled': {'const': False},
        'implementation': {
            'type': 'object',
            'required': ['state', 'network_access', 'native_writes', 'external_dependencies'],
            'properties': {
                'state': {'enum': ['contract_only', 'prototype']},
                'entrypoint': {'type': ['string', 'null']},
                'language': {'type': ['string', 'null']},
                'network_access': {'const': False},
                'native_writes': {'const': False},
                'external_dependencies': {'type': 'array'},
            },
        },
    },
    'additionalProperties': True,
}
write_json(GARDEN / 'contracts/module_manifest.schema.json', module_schema)

write_json(GARDEN / 'contracts/translation_request.schema.json', {
    '$schema': 'https://json-schema.org/draft/2020-12/schema',
    '$id': 'axm://contracts/translation-request/v1',
    'title': 'AXM Translation Request',
    'type': 'object',
    'required': ['request_id', 'operation', 'source', 'target', 'authority'],
    'properties': {
        'request_id': {'type': 'string'},
        'operation': {'type': 'string'},
        'source': {'type': 'object'},
        'target': {'type': 'object'},
        'authority': {'type': 'object'},
        'constraints': {'type': 'object'},
        'declared_features': {'type': 'array', 'items': {'type': 'string'}},
    },
    'additionalProperties': False,
})

write_json(GARDEN / 'contracts/loss_ledger.schema.json', {
    '$schema': 'https://json-schema.org/draft/2020-12/schema',
    '$id': 'axm://contracts/translation-loss-ledger/v1',
    'title': 'AXM Translation Loss Ledger',
    'type': 'object',
    'required': ['schema', 'entries', 'summary'],
    'properties': {
        'schema': {'const': 'axm.translation.loss-ledger/v1'},
        'entries': {'type': 'array', 'items': {'type': 'object'}},
        'summary': {'type': 'object'},
    },
})

write_json(GARDEN / 'contracts/proof_packet.schema.json', {
    '$schema': 'https://json-schema.org/draft/2020-12/schema',
    '$id': 'axm://contracts/translation-proof-packet/v1',
    'title': 'AXM Translation Proof Packet',
    'type': 'object',
    'required': ['schema', 'request_id', 'claims', 'fingerprints', 'loss', 'authority', 'verdict'],
    'properties': {
        'schema': {'const': 'axm.translation.proof-packet/v1'},
        'request_id': {'type': 'string'},
        'claims': {'type': 'array'},
        'fingerprints': {'type': 'object'},
        'loss': {'type': 'object'},
        'authority': {'type': 'object'},
        'verdict': {'enum': ['PASS', 'PASS_WITH_VISIBLE_LOSS', 'REFUSE', 'UNPROVEN']},
    },
})

write_json(GARDEN / 'contracts/adapter_result.schema.json', {
    '$schema': 'https://json-schema.org/draft/2020-12/schema',
    '$id': 'axm://contracts/adapter-result/v1',
    'title': 'AXM Adapter Result',
    'type': 'object',
    'required': ['ok', 'module_id', 'status', 'data', 'evidence', 'warnings'],
    'properties': {
        'ok': {'type': 'boolean'},
        'module_id': {'type': 'string'},
        'status': {'type': 'string'},
        'data': {},
        'evidence': {'type': 'array'},
        'warnings': {'type': 'array'},
    },
})

# Shared dependency-free core.
shared_pkg = GARDEN / 'shared' / 'axm_translation_core'
write(shared_pkg / '__init__.py', """from .core import (
    canonical_json_bytes,
    contract_fingerprint,
    new_loss_ledger,
    add_loss,
    summarize_loss,
    allowlist_decision,
    diff_values,
    build_proof_packet,
    explain_translation,
)

__all__ = [
    'canonical_json_bytes', 'contract_fingerprint', 'new_loss_ledger', 'add_loss',
    'summarize_loss', 'allowlist_decision', 'diff_values', 'build_proof_packet',
    'explain_translation'
]
""")

write(shared_pkg / 'core.py', r'''from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from typing import Any, Iterable


def canonical_json_bytes(value: Any) -> bytes:
    """Return deterministic UTF-8 JSON bytes for JSON-compatible values."""
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def contract_fingerprint(value: Any, algorithm: str = "sha256") -> dict[str, Any]:
    if algorithm != "sha256":
        raise ValueError("Only sha256 is supported in the dependency-free prototype")
    payload = canonical_json_bytes(value)
    return {
        "algorithm": algorithm,
        "digest": hashlib.sha256(payload).hexdigest(),
        "canonical_bytes": len(payload),
    }


def new_loss_ledger() -> dict[str, Any]:
    return {
        "schema": "axm.translation.loss-ledger/v1",
        "entries": [],
        "summary": {"count": 0, "by_kind": {}, "max_severity": "none", "has_blocking_loss": False},
    }


def _severity_rank(value: str) -> int:
    return {"none": 0, "info": 1, "low": 2, "medium": 3, "high": 4, "blocking": 5}.get(value, 5)


def summarize_loss(ledger: dict[str, Any]) -> dict[str, Any]:
    by_kind: dict[str, int] = {}
    max_severity = "none"
    for entry in ledger.get("entries", []):
        kind = str(entry.get("kind", "unspecified"))
        by_kind[kind] = by_kind.get(kind, 0) + 1
        severity = str(entry.get("severity", "blocking"))
        if _severity_rank(severity) > _severity_rank(max_severity):
            max_severity = severity
    summary = {
        "count": len(ledger.get("entries", [])),
        "by_kind": dict(sorted(by_kind.items())),
        "max_severity": max_severity,
        "has_blocking_loss": _severity_rank(max_severity) >= _severity_rank("blocking"),
    }
    ledger["summary"] = summary
    return summary


def add_loss(
    ledger: dict[str, Any],
    *,
    kind: str,
    path: str,
    source_value: Any = None,
    target_value: Any = None,
    reason: str,
    severity: str = "medium",
    reversible: bool = False,
    evidence: Iterable[str] | None = None,
) -> dict[str, Any]:
    if severity not in {"info", "low", "medium", "high", "blocking"}:
        raise ValueError(f"Unsupported severity: {severity}")
    entry = {
        "kind": kind,
        "path": path,
        "source_value": deepcopy(source_value),
        "target_value": deepcopy(target_value),
        "reason": reason,
        "severity": severity,
        "reversible": bool(reversible),
        "evidence": list(evidence or []),
    }
    ledger.setdefault("entries", []).append(entry)
    summarize_loss(ledger)
    return entry


def _value_allowed(value: Any, allowed: list[Any] | None) -> bool:
    if allowed is None:
        return True
    return value in allowed


def allowlist_decision(request: dict[str, Any], rules: dict[str, Any]) -> dict[str, Any]:
    """Deny by default unless every declared dimension is allowed."""
    checks = {
        "operation": _value_allowed(request.get("operation"), rules.get("operations")),
        "path": _value_allowed(request.get("path"), rules.get("paths")),
        "host": _value_allowed(request.get("host"), rules.get("hosts")),
        "media_type": _value_allowed(request.get("media_type"), rules.get("media_types")),
        "entity_type": _value_allowed(request.get("entity_type"), rules.get("entity_types")),
        "target_canvas": _value_allowed(request.get("target_canvas"), rules.get("target_canvases")),
    }
    declared_dimensions = [
        key for key, rule_key in {
            "operation": "operations", "path": "paths", "host": "hosts",
            "media_type": "media_types", "entity_type": "entity_types",
            "target_canvas": "target_canvases"
        }.items() if rules.get(rule_key) is not None
    ]
    if not declared_dimensions:
        return {"allowed": False, "reason": "No allowlist dimensions were declared", "checks": checks}
    failed = [key for key in declared_dimensions if not checks[key]]
    return {
        "allowed": not failed,
        "reason": "Allowed by explicit rules" if not failed else "Denied: " + ", ".join(failed),
        "checks": checks,
    }


def diff_values(source: Any, target: Any, path: str = "$") -> list[dict[str, Any]]:
    changes: list[dict[str, Any]] = []
    if type(source) is not type(target):
        return [{"path": path, "kind": "type_change", "source": source, "target": target}]
    if isinstance(source, dict):
        source_keys, target_keys = set(source), set(target)
        for key in sorted(source_keys - target_keys):
            changes.append({"path": f"{path}.{key}", "kind": "removed", "source": source[key], "target": None})
        for key in sorted(target_keys - source_keys):
            changes.append({"path": f"{path}.{key}", "kind": "added", "source": None, "target": target[key]})
        for key in sorted(source_keys & target_keys):
            changes.extend(diff_values(source[key], target[key], f"{path}.{key}"))
        return changes
    if isinstance(source, list):
        common = min(len(source), len(target))
        for idx in range(common):
            changes.extend(diff_values(source[idx], target[idx], f"{path}[{idx}]"))
        for idx in range(common, len(source)):
            changes.append({"path": f"{path}[{idx}]", "kind": "removed", "source": source[idx], "target": None})
        for idx in range(common, len(target)):
            changes.append({"path": f"{path}[{idx}]", "kind": "added", "source": None, "target": target[idx]})
        return changes
    if source != target:
        changes.append({"path": path, "kind": "changed", "source": source, "target": target})
    return changes


def build_proof_packet(
    *,
    request_id: str,
    source: Any,
    target: Any,
    loss_ledger: dict[str, Any],
    authority: dict[str, Any],
    claims: list[dict[str, Any]] | None = None,
    approvals: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    source_fp = contract_fingerprint(source)
    target_fp = contract_fingerprint(target)
    changes = diff_values(source, target)
    summary = summarize_loss(loss_ledger)
    if summary["has_blocking_loss"]:
        verdict = "REFUSE"
    elif summary["count"]:
        verdict = "PASS_WITH_VISIBLE_LOSS"
    elif claims:
        verdict = "PASS"
    else:
        verdict = "UNPROVEN"
    return {
        "schema": "axm.translation.proof-packet/v1",
        "request_id": request_id,
        "claims": deepcopy(claims or []),
        "fingerprints": {"source": source_fp, "target": target_fp},
        "diff": changes,
        "loss": deepcopy(loss_ledger),
        "authority": deepcopy(authority),
        "approvals": deepcopy(approvals or []),
        "verdict": verdict,
    }


def explain_translation(packet: dict[str, Any]) -> str:
    verdict = packet.get("verdict", "UNPROVEN")
    loss = packet.get("loss", {}).get("summary", {})
    lines = [
        f"Translation verdict: {verdict}.",
        f"Visible loss entries: {loss.get('count', 0)}; maximum severity: {loss.get('max_severity', 'none')}.",
        f"Recorded structural differences: {len(packet.get('diff', []))}.",
    ]
    authority = packet.get("authority", {})
    if authority:
        lines.append("Authority: " + ", ".join(f"{k}={v}" for k, v in sorted(authority.items())) + ".")
    if verdict == "REFUSE":
        lines.append("The translation must not proceed because blocking loss is recorded.")
    elif verdict == "PASS_WITH_VISIBLE_LOSS":
        lines.append("The result is usable only with the listed loss kept visible to the human or calling system.")
    elif verdict == "PASS":
        lines.append("The declared checks passed; this is evidence for this packet, not universal compatibility proof.")
    else:
        lines.append("No sufficient proof claim was supplied, so the result remains unproven.")
    return "\n".join(lines)
''')

# Module capsule generator.
for m in mods:
    num = m['number']
    slug = slugify(m['name'])
    folder = GARDEN / 'modules' / f'{num:03d}_{slug}'
    status = 'LOCAL_PROTOTYPE' if num in implemented else ('SHADOW_ONLY' if num in high_restraint else 'WORKING_CANDIDATE')
    authority = 'shadow_only' if num in high_restraint else ('decision_only' if num == 81 else ('inspect_only' if num in implemented else 'none'))
    state = 'prototype' if num in implemented else 'contract_only'
    entrypoint = 'implementation.py' if state == 'prototype' else None
    manifest = {
        'schema': 'axm.detached.module-manifest/v1',
        'number': num,
        'id': m['id'],
        'slug': slug,
        'name': m['name'],
        'category': m['category'],
        'purpose': m['purpose'],
        'status': status,
        'version': '0.1.0',
        'maturity': 'local_pure_prototype' if state == 'prototype' else 'seed_contract',
        'authority_mode': authority,
        'default_enabled': False,
        'implementation': {
            'state': state,
            'entrypoint': entrypoint,
            'language': 'python' if state == 'prototype' else None,
            'pure_function_target': num in implemented,
            'network_access': False,
            'native_writes': False,
            'external_dependencies': [],
        },
        'hard_dependencies': [id_by_num[n] for n in hard_dependencies.get(num, [])],
        'recommended_helpers': [id_by_num[n] for n in sorted(spine - {num})],
        'protected_roots': protected_roots,
        'intake': {
            'copy_individually': True,
            'requires_human_review': True,
            'auto_merge': False,
            'auto_canon': False,
            'source_seed_status': m['status'],
        },
        'boundaries': [
            'Do not infer authority from translation ability.',
            'Do not hide dropped, approximated, invented, or unsupported meaning.',
            'Do not mutate source or native state in this detached version.',
            'Keep provenance and source identity available.',
        ],
        'evidence': {
            'source_pack': SOURCE_ZIP.name,
            'source_record_number': num,
            'runtime_verified': False,
            'tests': 'included' if state == 'prototype' else 'not_yet',
        },
    }
    write_json(folder / 'module.json', manifest)
    readme = f"""# {num:03d} — {m['name']}

**ID:** `{m['id']}`  
**Status:** `{status}`  
**Authority:** `{authority}`  
**Version:** `0.1.0`

## Purpose

{m['purpose']}

## Current growth

{'A dependency-free, local, pure-function prototype is included.' if state == 'prototype' else 'This capsule currently contains its contract, boundaries, and AXM intake metadata. It is not yet a runtime implementation.'}

## Hard boundary

This module may not silently acquire permissions, write native state, hide translation loss, or become CANON through intake. Review `module.json` before use.

## AXM intake shape

Copy this folder independently. Preserve its ID and source lineage. Extend existing AXM roots rather than replacing them.
"""
    write(folder / 'README.md', readme)
    write(folder / 'fixtures' / 'README.md', """# Fixtures

Add small, reviewable input and expected-output pairs here before expanding authority or compatibility claims. Keep malformed, refusal, unknown-field, and visible-loss cases beside success cases.
""")

# Implemented module wrappers and discovery functions.
impl_code: dict[int, str] = {}
impl_code[3] = '''from axm_translation_core import contract_fingerprint\n\ndef run(contract):\n    return contract_fingerprint(contract)\n'''
impl_code[20] = '''from axm_translation_core import new_loss_ledger, add_loss, summarize_loss\n\ndef create():\n    return new_loss_ledger()\n\ndef record(ledger, **entry):\n    return add_loss(ledger, **entry)\n\ndef summarize(ledger):\n    return summarize_loss(ledger)\n'''
impl_code[81] = '''from axm_translation_core import allowlist_decision\n\ndef run(request, rules):\n    return allowlist_decision(request, rules)\n'''
impl_code[85] = '''from axm_translation_core import diff_values\n\ndef run(source, target):\n    return {"changes": diff_values(source, target)}\n'''
impl_code[90] = '''from axm_translation_core import build_proof_packet\n\ndef run(**kwargs):\n    return build_proof_packet(**kwargs)\n'''
impl_code[99] = '''from axm_translation_core import explain_translation\n\ndef run(proof_packet):\n    return explain_translation(proof_packet)\n'''

impl_code[1] = r'''from __future__ import annotations
from typing import Any

HTTP_METHODS = {"get", "post", "put", "patch", "delete", "head", "options", "trace"}


def run(document: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(document, dict):
        raise TypeError("document must be a dictionary")
    kind = "generic_contract"
    operations: list[dict[str, Any]] = []
    schemas: list[str] = []
    permissions: list[str] = []
    versions: list[str] = []

    if "openapi" in document:
        kind = "openapi"
        versions.append(str(document["openapi"]))
        for path, item in document.get("paths", {}).items():
            if not isinstance(item, dict):
                continue
            for method, operation in item.items():
                if method.lower() in HTTP_METHODS and isinstance(operation, dict):
                    operations.append({
                        "operation_id": operation.get("operationId") or f"{method.lower()} {path}",
                        "method": method.upper(),
                        "path": path,
                        "summary": operation.get("summary"),
                    })
        schemas = sorted(document.get("components", {}).get("schemas", {}).keys())
    elif "$schema" in document or "properties" in document:
        kind = "json_schema"
        if "$schema" in document:
            versions.append(str(document["$schema"]))
        schemas = sorted(document.get("properties", {}).keys())
        operations.append({"operation_id": "validate", "method": "LOCAL", "path": "$"})
    else:
        raw_ops = document.get("operations", [])
        for op in raw_ops if isinstance(raw_ops, list) else []:
            operations.append(op if isinstance(op, dict) else {"operation_id": str(op)})
        permissions = sorted(str(x) for x in document.get("permissions", []))
        version = document.get("version")
        if version is not None:
            versions.append(str(version))

    return {
        "descriptor_kind": kind,
        "operations": operations,
        "schemas": schemas,
        "permissions": permissions,
        "versions": versions,
        "limitations": ["Prototype harvests declared structure only; it does not execute the interface."],
    }
'''

impl_code[2] = r'''from __future__ import annotations
from typing import Any


def run(descriptors: list[dict[str, Any]]) -> dict[str, Any]:
    entries = []
    by_operation: dict[str, list[str]] = {}
    for index, descriptor in enumerate(descriptors):
        adapter_id = str(descriptor.get("adapter_id", f"adapter-{index + 1}"))
        entry = {
            "adapter_id": adapter_id,
            "read": sorted(set(descriptor.get("read", []))),
            "write": sorted(set(descriptor.get("write", []))),
            "preserve": sorted(set(descriptor.get("preserve", []))),
            "refuse": sorted(set(descriptor.get("refuse", []))),
            "verify": sorted(set(descriptor.get("verify", []))),
            "local_only": bool(descriptor.get("local_only", True)),
        }
        entries.append(entry)
        for operation in entry["read"] + entry["write"]:
            by_operation.setdefault(operation, []).append(adapter_id)
    return {"entries": entries, "by_operation": {k: sorted(v) for k, v in sorted(by_operation.items())}}
'''

impl_code[4] = r'''from __future__ import annotations
from typing import Any


def run(document: Any) -> dict[str, Any]:
    if isinstance(document, dict):
        if "openapi" in document:
            return {"family": "OpenAPI", "dialect": str(document["openapi"]), "confidence": "declared"}
        if "asyncapi" in document:
            return {"family": "AsyncAPI", "dialect": str(document["asyncapi"]), "confidence": "declared"}
        if "$schema" in document:
            uri = str(document["$schema"])
            return {"family": "JSON Schema", "dialect": uri, "confidence": "declared"}
        if document.get("type") == "record" and "fields" in document:
            return {"family": "Avro", "dialect": "record-schema", "confidence": "observed"}
        if "properties" in document or "required" in document:
            return {"family": "JSON Schema", "dialect": "unspecified", "confidence": "observed"}
    if isinstance(document, str) and ("syntax =" in document or "message " in document):
        return {"family": "Protocol Buffers", "dialect": "proto-text", "confidence": "observed"}
    return {"family": "unknown", "dialect": None, "confidence": "insufficient", "refusal": "No exact dialect could be identified"}
'''

impl_code[5] = r'''from __future__ import annotations
import json
from pathlib import Path
from typing import Any

MAGIC = [
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
    (b"PK\x03\x04", "application/zip"),
    (b"%PDF-", "application/pdf"),
    (b"\x1f\x8b", "application/gzip"),
]


def run(data: bytes, filename: str | None = None) -> dict[str, Any]:
    if not isinstance(data, (bytes, bytearray)):
        raise TypeError("data must be bytes")
    raw = bytes(data)
    for prefix, media_type in MAGIC:
        if raw.startswith(prefix):
            return {"media_type": media_type, "encoding": "binary", "confidence": "magic", "filename": filename}
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return {"media_type": "application/octet-stream", "encoding": "binary", "confidence": "fallback", "filename": filename}
    try:
        json.loads(text)
        return {"media_type": "application/json", "encoding": "utf-8", "confidence": "parsed", "filename": filename}
    except json.JSONDecodeError:
        suffix = Path(filename).suffix.lower() if filename else ""
        media_type = "text/csv" if suffix == ".csv" else "text/plain"
        return {"media_type": media_type, "encoding": "utf-8", "confidence": "decoded", "filename": filename}
'''

impl_code[6] = r'''from __future__ import annotations
import re
from typing import Any


def _key(version: str) -> tuple[int, ...]:
    nums = re.findall(r"\d+", str(version))
    return tuple(int(x) for x in nums[:4]) or (0,)


def run(local_versions: list[str], remote_versions: list[str], *, minimum: str | None = None, maximum: str | None = None) -> dict[str, Any]:
    common = sorted(set(map(str, local_versions)) & set(map(str, remote_versions)), key=_key, reverse=True)
    if minimum is not None:
        common = [v for v in common if _key(v) >= _key(minimum)]
    if maximum is not None:
        common = [v for v in common if _key(v) <= _key(maximum)]
    if not common:
        return {"ok": False, "selected": None, "reason": "No mutually supported declared version", "candidates": []}
    return {"ok": True, "selected": common[0], "reason": "Highest mutually supported declared version", "candidates": common}
'''

impl_code[7] = r'''from __future__ import annotations
from typing import Any


def run(*, supported: list[str], required: list[str] | None = None, optional: list[str] | None = None) -> dict[str, Any]:
    supported_set = set(supported)
    required_set = set(required or [])
    optional_set = set(optional or [])
    missing = sorted(required_set - supported_set)
    enabled = sorted(required_set | (optional_set & supported_set))
    return {
        "ok": not missing,
        "enabled": enabled if not missing else [],
        "missing_required": missing,
        "unsupported_optional": sorted(optional_set - supported_set),
        "reason": "All required features supported" if not missing else "Required features are missing",
    }
'''

impl_code[8] = r'''from __future__ import annotations
from typing import Any

KEYS = {
    "runtimes": {"runtime", "runtimes", "requires_runtime"},
    "libraries": {"library", "libraries", "dependencies", "requires"},
    "devices": {"device", "devices"},
    "paths": {"path", "paths", "filesystem_paths"},
    "network": {"host", "hosts", "network", "network_access"},
    "permissions": {"permission", "permissions", "capabilities", "authority"},
    "approvals": {"approval", "approvals", "human_approval"},
}


def run(contract: Any) -> dict[str, Any]:
    result: dict[str, list[str]] = {key: [] for key in KEYS}
    def visit(value: Any, key_hint: str = "") -> None:
        lowered = key_hint.lower()
        for bucket, names in KEYS.items():
            if lowered in names:
                if isinstance(value, list):
                    result[bucket].extend(str(x) for x in value)
                elif isinstance(value, (str, int, float, bool)):
                    result[bucket].append(str(value))
        if isinstance(value, dict):
            for key, child in value.items():
                visit(child, str(key))
        elif isinstance(value, list):
            for child in value:
                visit(child, key_hint)
    visit(contract)
    return {key: sorted(set(values)) for key, values in result.items()}
'''

impl_code[9] = r'''from __future__ import annotations
from axm_translation_core import contract_fingerprint, diff_values


def run(reviewed_contract, observed_contract):
    reviewed = contract_fingerprint(reviewed_contract)
    observed = contract_fingerprint(observed_contract)
    changes = diff_values(reviewed_contract, observed_contract)
    return {
        "drifted": reviewed["digest"] != observed["digest"],
        "reviewed_fingerprint": reviewed,
        "observed_fingerprint": observed,
        "changes": changes,
    }
'''

impl_code[11] = r'''from __future__ import annotations
from copy import deepcopy
from typing import Any


def run(
    entity: Any,
    *,
    source_system: str,
    native_id: str,
    schema_id: str | None = None,
    provenance: list[dict[str, Any]] | None = None,
    limitations: list[str] | None = None,
    authority: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not source_system or not native_id:
        raise ValueError("source_system and native_id are required")
    return {
        "schema": "axm.translation.canonical-entity-envelope/v1",
        "source_system": source_system,
        "native_id": native_id,
        "schema_id": schema_id,
        "entity": deepcopy(entity),
        "provenance": deepcopy(provenance or []),
        "limitations": list(limitations or []),
        "authority": deepcopy(authority or {"mode": "none"}),
        "native_ownership_preserved": True,
    }
'''

impl_code[10] = r'''from __future__ import annotations
from typing import Any

DEFAULT_WEIGHTS = {
    "compatibility": 0.24,
    "trust": 0.18,
    "locality": 0.12,
    "fidelity": 0.18,
    "reversibility": 0.12,
    "proof_strength": 0.16,
}


def run(candidates: list[dict[str, Any]], weights: dict[str, float] | None = None) -> dict[str, Any]:
    active = dict(DEFAULT_WEIGHTS)
    if weights:
        active.update(weights)
    ranked = []
    for candidate in candidates:
        score = 0.0
        evidence = {}
        for metric, weight in active.items():
            value = max(0.0, min(1.0, float(candidate.get(metric, 0.0))))
            score += value * weight
            evidence[metric] = {"value": value, "weight": weight}
        loss_penalty = max(0.0, min(1.0, float(candidate.get("loss", 0.0)))) * 0.25
        cost_penalty = max(0.0, min(1.0, float(candidate.get("resource_cost", 0.0)))) * 0.10
        final = max(0.0, score - loss_penalty - cost_penalty)
        ranked.append({
            "adapter_id": candidate.get("adapter_id", "unnamed"),
            "score": round(final, 6),
            "evidence": evidence,
            "penalties": {"loss": loss_penalty, "resource_cost": cost_penalty},
        })
    ranked.sort(key=lambda item: (-item["score"], item["adapter_id"]))
    return {"ranked": ranked, "winner": ranked[0]["adapter_id"] if ranked else None}
'''

for m in mods:
    num = m['number']
    if num not in implemented:
        continue
    folder = GARDEN / 'modules' / f'{num:03d}_{slugify(m["name"])}'
    write(folder / 'implementation.py', impl_code[num])

# Module index and garden manifest.
module_index = []
for m in mods:
    num = m['number']
    slug = slugify(m['name'])
    module_index.append({
        'number': num,
        'id': m['id'],
        'name': m['name'],
        'category': m['category'],
        'path': f'modules/{num:03d}_{slug}',
        'status': 'LOCAL_PROTOTYPE' if num in implemented else ('SHADOW_ONLY' if num in high_restraint else 'WORKING_CANDIDATE'),
        'implementation': 'prototype' if num in implemented else 'contract_only',
    })
write_json(GARDEN / 'module_index.json', module_index)
write_json(GARDEN / 'garden_manifest.json', {
    'schema': 'axm.translation.garden/v1',
    'name': 'AXM Adapters & Translation Modular Growth Garden',
    'version': '0.1.0',
    'date': '2026-07-27',
    'source_zip': SOURCE_ZIP.name,
    'source_sha256': sha256(SOURCE_ZIP),
    'module_count': 100,
    'prototype_count': len(implemented),
    'contract_only_count': 100 - len(implemented),
    'shadow_only_count': len(high_restraint),
    'canon': False,
    'installed': False,
    'default_enabled': False,
})

# Dynamic loader for examples/tests.
write(GARDEN / 'tools' / 'module_loader.py', r'''from __future__ import annotations
import importlib.util
import json
from pathlib import Path
from types import ModuleType

ROOT = Path(__file__).resolve().parents[1]


def module_folder(number: int) -> Path:
    matches = sorted((ROOT / "modules").glob(f"{number:03d}_*"))
    if len(matches) != 1:
        raise FileNotFoundError(f"Expected one module folder for {number}, found {len(matches)}")
    return matches[0]


def load_manifest(number: int) -> dict:
    return json.loads((module_folder(number) / "module.json").read_text(encoding="utf-8"))


def load_implementation(number: int) -> ModuleType:
    path = module_folder(number) / "implementation.py"
    if not path.exists():
        raise RuntimeError(f"Module {number:03d} is contract-only")
    name = f"axm_detached_module_{number:03d}"
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
''')

write(GARDEN / 'tools' / 'list_modules.py', r'''from __future__ import annotations
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
items = json.loads((root / "module_index.json").read_text(encoding="utf-8"))
for item in items:
    print(f"{item['number']:03d}  {item['status']:<17}  {item['name']}")
''')

write(GARDEN / 'tools' / 'validate_garden.py', r'''from __future__ import annotations
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
errors = []
folders = sorted((root / "modules").glob("[0-9][0-9][0-9]_*"))
if len(folders) != 100:
    errors.append(f"Expected 100 module folders, found {len(folders)}")
ids = set()
numbers = set()
prototype_count = 0
for folder in folders:
    path = folder / "module.json"
    if not path.exists():
        errors.append(f"Missing manifest: {folder.name}")
        continue
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"Invalid JSON {path}: {exc}")
        continue
    num, module_id = manifest.get("number"), manifest.get("id")
    if num in numbers:
        errors.append(f"Duplicate number: {num}")
    if module_id in ids:
        errors.append(f"Duplicate id: {module_id}")
    numbers.add(num); ids.add(module_id)
    if manifest.get("default_enabled") is not False:
        errors.append(f"Default enabled is not false: {folder.name}")
    impl = manifest.get("implementation", {})
    if impl.get("network_access") is not False or impl.get("native_writes") is not False:
        errors.append(f"Detached safety boundary violated: {folder.name}")
    if impl.get("state") == "prototype":
        prototype_count += 1
        if not (folder / "implementation.py").exists():
            errors.append(f"Prototype missing implementation: {folder.name}")
if numbers != set(range(1, 101)):
    errors.append("Module numbering is not exactly 1..100")
if prototype_count != 16:
    errors.append(f"Expected 16 prototypes, found {prototype_count}")
if errors:
    print("GARDEN VALIDATION: FAIL")
    for error in errors:
        print("-", error)
    sys.exit(1)
print("GARDEN VALIDATION: PASS")
print(f"Modules: {len(folders)} | Prototypes: {prototype_count} | Contract-only: {len(folders)-prototype_count}")
''')

# Tests.
write(GARDEN / 'tests' / '__init__.py', '')
write(GARDEN / 'tests' / 'test_core.py', r'''from __future__ import annotations
import unittest

from axm_translation_core import (
    add_loss, allowlist_decision, build_proof_packet, contract_fingerprint,
    diff_values, explain_translation, new_loss_ledger,
)


class CoreTests(unittest.TestCase):
    def test_fingerprint_is_order_independent(self):
        self.assertEqual(contract_fingerprint({"a": 1, "b": 2})["digest"], contract_fingerprint({"b": 2, "a": 1})["digest"])

    def test_fingerprint_changes_with_value(self):
        self.assertNotEqual(contract_fingerprint({"a": 1})["digest"], contract_fingerprint({"a": 2})["digest"])

    def test_loss_ledger_summary(self):
        ledger = new_loss_ledger()
        add_loss(ledger, kind="rounded", path="$.size", source_value=1.25, target_value=1, reason="integer target", severity="low")
        self.assertEqual(ledger["summary"]["count"], 1)
        self.assertEqual(ledger["summary"]["max_severity"], "low")

    def test_allowlist_denies_without_rules(self):
        self.assertFalse(allowlist_decision({"operation": "read"}, {})["allowed"])

    def test_allowlist_allows_exact_match(self):
        decision = allowlist_decision({"operation": "read", "path": "/safe"}, {"operations": ["read"], "paths": ["/safe"]})
        self.assertTrue(decision["allowed"])

    def test_allowlist_denies_mismatch(self):
        decision = allowlist_decision({"operation": "write"}, {"operations": ["read"]})
        self.assertFalse(decision["allowed"])

    def test_diff_reports_nested_change(self):
        changes = diff_values({"a": {"b": 1}}, {"a": {"b": 2}})
        self.assertEqual(changes[0]["path"], "$.a.b")

    def test_blocking_loss_refuses(self):
        ledger = new_loss_ledger()
        add_loss(ledger, kind="unsupported", path="$.feature", reason="cannot preserve", severity="blocking")
        packet = build_proof_packet(request_id="r1", source={"x": 1}, target={"x": 1}, loss_ledger=ledger, authority={"mode": "preview"}, claims=[])
        self.assertEqual(packet["verdict"], "REFUSE")
        self.assertIn("must not proceed", explain_translation(packet))


if __name__ == "__main__":
    unittest.main()
''')

write(GARDEN / 'tests' / 'test_discovery.py', r'''from __future__ import annotations
import unittest

from tools.module_loader import load_implementation


class DiscoveryTests(unittest.TestCase):
    def test_harvest_openapi(self):
        mod = load_implementation(1)
        result = mod.run({"openapi": "3.1.0", "paths": {"/things": {"get": {"operationId": "listThings"}}}})
        self.assertEqual(result["descriptor_kind"], "openapi")
        self.assertEqual(result["operations"][0]["operation_id"], "listThings")

    def test_catalog(self):
        mod = load_implementation(2)
        result = mod.run([{"adapter_id": "a", "read": ["x"], "write": []}])
        self.assertEqual(result["by_operation"]["x"], ["a"])

    def test_schema_detector(self):
        mod = load_implementation(4)
        result = mod.run({"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object"})
        self.assertEqual(result["family"], "JSON Schema")

    def test_representation_inspector_json(self):
        mod = load_implementation(5)
        result = mod.run(b'{"a":1}', "sample.json")
        self.assertEqual(result["media_type"], "application/json")

    def test_version_negotiation(self):
        mod = load_implementation(6)
        result = mod.run(["1.0", "2.0"], ["2.0", "3.0"])
        self.assertEqual(result["selected"], "2.0")

    def test_version_refusal(self):
        mod = load_implementation(6)
        self.assertFalse(mod.run(["1"], ["2"])["ok"])

    def test_feature_negotiation(self):
        mod = load_implementation(7)
        result = mod.run(supported=["alpha", "beta"], required=["alpha"], optional=["gamma"])
        self.assertTrue(result["ok"])
        self.assertEqual(result["unsupported_optional"], ["gamma"])

    def test_feature_refusal(self):
        mod = load_implementation(7)
        self.assertFalse(mod.run(supported=[], required=["alpha"])["ok"])

    def test_dependency_extractor(self):
        mod = load_implementation(8)
        result = mod.run({"runtime": "python", "permissions": ["read"]})
        self.assertEqual(result["runtimes"], ["python"])
        self.assertEqual(result["permissions"], ["read"])

    def test_drift_detector(self):
        mod = load_implementation(9)
        result = mod.run({"a": 1}, {"a": 2})
        self.assertTrue(result["drifted"])

    def test_canonical_envelope_preserves_native_identity(self):
        mod = load_implementation(11)
        result = mod.run({"name": "example"}, source_system="local", native_id="n-1")
        self.assertTrue(result["native_ownership_preserved"])
        self.assertEqual(result["native_id"], "n-1")

    def test_suitability_scorer(self):
        mod = load_implementation(10)
        result = mod.run([
            {"adapter_id": "weak", "compatibility": 0.5},
            {"adapter_id": "strong", "compatibility": 1, "trust": 1, "locality": 1, "fidelity": 1, "reversibility": 1, "proof_strength": 1},
        ])
        self.assertEqual(result["winner"], "strong")


if __name__ == "__main__":
    unittest.main()
''')

write(GARDEN / 'tests' / 'test_structure.py', r'''from __future__ import annotations
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class StructureTests(unittest.TestCase):
    def test_exactly_100_capsules(self):
        self.assertEqual(len(list((ROOT / "modules").glob("[0-9][0-9][0-9]_*"))), 100)

    def test_unique_ids_and_numbers(self):
        manifests = [json.loads((p / "module.json").read_text(encoding="utf-8")) for p in (ROOT / "modules").glob("[0-9][0-9][0-9]_*")]
        self.assertEqual({m["number"] for m in manifests}, set(range(1, 101)))
        self.assertEqual(len({m["id"] for m in manifests}), 100)

    def test_no_default_enabled(self):
        manifests = [json.loads((p / "module.json").read_text(encoding="utf-8")) for p in (ROOT / "modules").glob("[0-9][0-9][0-9]_*")]
        self.assertTrue(all(m["default_enabled"] is False for m in manifests))

    def test_no_network_or_native_writes(self):
        manifests = [json.loads((p / "module.json").read_text(encoding="utf-8")) for p in (ROOT / "modules").glob("[0-9][0-9][0-9]_*")]
        self.assertTrue(all(m["implementation"]["network_access"] is False for m in manifests))
        self.assertTrue(all(m["implementation"]["native_writes"] is False for m in manifests))

    def test_high_restraint_shadow_only(self):
        high = {43, 46, 48, 66, 68, 70, 74, 80, 94, 100}
        for path in (ROOT / "modules").glob("[0-9][0-9][0-9]_*"):
            manifest = json.loads((path / "module.json").read_text(encoding="utf-8"))
            if manifest["number"] in high:
                self.assertEqual(manifest["authority_mode"], "shadow_only")


if __name__ == "__main__":
    unittest.main()
''')

write(GARDEN / 'run_tests.py', r'''from __future__ import annotations
import os
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parent
shared = root / "shared"
env = dict(os.environ)
env["PYTHONPATH"] = os.pathsep.join([str(root), str(shared), env.get("PYTHONPATH", "")])
commands = [
    [sys.executable, str(root / "tools" / "validate_garden.py")],
    [sys.executable, "-m", "unittest", "discover", "-s", str(root / "tests"), "-v"],
]
for command in commands:
    result = subprocess.run(command, cwd=root, env=env)
    if result.returncode != 0:
        raise SystemExit(result.returncode)
print("ALL AXM TRANSLATION GARDEN TESTS: PASS")
''')

# Example pipeline.
write_json(GARDEN / 'examples' / 'sample_contract.json', {
    '$schema': 'https://json-schema.org/draft/2020-12/schema',
    'title': 'Tiny Local Note',
    'type': 'object',
    'required': ['title'],
    'properties': {
        'title': {'type': 'string'},
        'body': {'type': ['string', 'null']},
    },
})
write(GARDEN / 'examples' / 'demo_safe_translation_pipeline.py', r'''from __future__ import annotations
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "shared"))
from tools.module_loader import load_implementation
from axm_translation_core import add_loss, new_loss_ledger

source = json.loads((ROOT / "examples" / "sample_contract.json").read_text(encoding="utf-8"))
translated = json.loads(json.dumps(source))
translated["properties"]["body"] = {"type": "string"}

harvest = load_implementation(1).run(source)
dialect = load_implementation(4).run(source)
fingerprint = load_implementation(3).run(source)
negotiation = load_implementation(6).run(["2020-12", "draft-07"], ["2020-12"])
allow = load_implementation(81).run(
    {"operation": "preview", "path": "/local/demo"},
    {"operations": ["preview"], "paths": ["/local/demo"]},
)
diff = load_implementation(85).run(source, translated)
ledger = new_loss_ledger()
add_loss(
    ledger,
    kind="narrowed_null_semantics",
    path="$.properties.body.type",
    source_value=["string", "null"],
    target_value="string",
    reason="Target demo representation cannot express nullable body",
    severity="high",
    reversible=True,
)
proof = load_implementation(90).run(
    request_id="demo-001",
    source=source,
    target=translated,
    loss_ledger=ledger,
    authority={"mode": "preview_only", "native_write": False, "network": False},
    claims=[{"claim": "declared_structure_inspected", "passed": True}],
)
explanation = load_implementation(99).run(proof)

print("AXM SAFE TRANSLATION PIPELINE DEMO")
print("- Dialect:", dialect)
print("- Harvested operations:", len(harvest["operations"]))
print("- Fingerprint:", fingerprint["digest"][:16] + "...")
print("- Negotiated:", negotiation["selected"])
print("- Allowlist:", allow["allowed"])
print("- Differences:", len(diff["changes"]))
print("- Verdict:", proof["verdict"])
print("\nHUMAN EXPLANATION\n" + explanation)
''')

# A compact intake guide.
write(GARDEN / 'AXM_SELECTIVE_INTAKE_GUIDE.md', """# AXM Selective Intake Guide

1. Choose one module folder, not the whole garden.
2. Read its `module.json` and preserve the module ID.
3. Compare it with current AXM roots; choose EXTEND, BRIDGE, MERGE, HOLD, or REJECT.
4. Keep `default_enabled=false` during intake.
5. Add local fixtures and refusal tests before any authority increase.
6. Record translation loss and produce a proof packet.
7. Require a separate human decision for native writes, network access, device access, installation, migration, chaining, or orchestration.
8. Promote only through AXM's own Merge Gate. This garden never promotes itself.
""")

# Run reports.
run2_dir = RUNS / 'RUN_02_MODULAR_CAPSULE_GARDEN'
write(run2_dir / 'RUN_02_REPORT.md', f"""# Steward Run 02 — Modular Capsule Garden

- Created 100 independent module folders: PASS
- Exact source IDs and numbering preserved: PASS
- Shared machine-readable manifest contract added: PASS
- Default-enabled modules: 0
- Source mutations: 0
- Runtime implementations in this run: 0 (structure only)
- CANON changes: 0

The seed list is now intake-shaped. AXM can later select one capsule without importing the whole branch.
""")
append_ledger({
    'schema': 'axm.steward.run-ledger/v1', 'run': 2, 'date': '2026-07-27',
    'gate': 'MODULAR_CAPSULE_GARDEN_CREATED', 'source_mutations': 0, 'module_capsules': 100,
    'prototypes_added': 0, 'installed': 0, 'promoted': 0, 'canon_changes': 0,
    'checkpoint_zip_created': False,
})

run3_dir = RUNS / 'RUN_03_TRUTH_PROOF_SPINE'
write(run3_dir / 'RUN_03_REPORT.md', """# Steward Run 03 — Truth and Proof Spine

Implemented as dependency-free, local, pure functions:

- 003 Contract Fingerprint Service
- 020 Translation Loss and Ambiguity Ledger
- 081 Adapter Allowlist Gate
- 085 Translation Diff Preview
- 090 Translation Proof Packet Builder
- 099 Human-Readable Translation Explainer

All are detached, network-free, native-write-free, and default-disabled. These prototypes create evidence and decisions; they do not perform native translation or grant permissions.
""")
append_ledger({
    'schema': 'axm.steward.run-ledger/v1', 'run': 3, 'date': '2026-07-27',
    'gate': 'TRUTH_PROOF_SPINE_LOCAL_PROTOTYPE', 'source_mutations': 0,
    'prototypes_added': 6, 'network_access': 0, 'native_writes': 0,
    'installed': 0, 'promoted': 0, 'canon_changes': 0, 'checkpoint_zip_created': False,
})

run4_dir = RUNS / 'RUN_04_DISCOVERY_RING'
write(run4_dir / 'RUN_04_REPORT.md', """# Steward Run 04 — Read-Only Discovery Ring

Implemented dependency-free prototypes for seeds 001–010:

- descriptor harvesting;
- capability cataloging;
- fingerprints;
- schema dialect detection;
- representation inspection;
- version negotiation;
- feature negotiation;
- dependency/permission extraction;
- contract drift reporting;
- suitability scoring.

Scope is deliberately narrow. The prototypes inspect declared data and byte signatures only. They do not execute interfaces, fetch network resources, load plugins, or mutate systems.
""")
append_ledger({
    'schema': 'axm.steward.run-ledger/v1', 'run': 4, 'date': '2026-07-27',
    'gate': 'READ_ONLY_DISCOVERY_RING_LOCAL_PROTOTYPE', 'source_mutations': 0,
    'prototypes_added': 10, 'network_access': 0, 'native_writes': 0,
    'installed': 0, 'promoted': 0, 'canon_changes': 0, 'checkpoint_zip_created': False,
})

# Save the rebuild script inside the garden for transparent regeneration.
shutil.copy2(Path(__file__), GARDEN / 'tools' / 'rebuild_garden_from_seed_pack.py')

# Run 5 report is completed after tests by shell.
print(GARDEN)
