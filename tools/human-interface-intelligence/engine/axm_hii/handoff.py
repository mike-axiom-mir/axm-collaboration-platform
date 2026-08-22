from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from .util import load_json

HANDOFF_VERSION = "0.2.0"
CONTRACT_ID = "axm.capability-interface-contract"
CONTRACT_VERSION = "0.1.0"


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def canonical_sha256(value: Any) -> str:
    return f"sha256:{hashlib.sha256(canonical_json_bytes(value)).hexdigest()}"


def load_handoff(path: str | Path) -> dict[str, Any]:
    payload = load_json(path)
    if not isinstance(payload, dict):
        raise ValueError("Handoff root must be a JSON object.")
    return payload


def validate_handoff_shape(batch: dict[str, Any]) -> list[str]:
    """Small deterministic preflight before per-record shared-schema validation."""
    errors: list[str] = []
    required = {
        "handoff_id",
        "handoff_version",
        "contract_id",
        "contract_version",
        "producer",
        "generated_at",
        "records",
    }
    for field in sorted(required - set(batch)):
        errors.append(f"Missing handoff field: {field}")
    if batch.get("handoff_version") != HANDOFF_VERSION:
        errors.append(f"Unsupported handoff_version: {batch.get('handoff_version')!r}")
    if batch.get("contract_id") != CONTRACT_ID:
        errors.append(f"Unexpected contract_id: {batch.get('contract_id')!r}")
    if batch.get("contract_version") != CONTRACT_VERSION:
        errors.append(f"Unsupported contract_version: {batch.get('contract_version')!r}")
    producer = batch.get("producer")
    if not isinstance(producer, dict):
        errors.append("producer must be an object")
    else:
        for field in ("module_id", "module_version", "execution_state"):
            if not producer.get(field):
                errors.append(f"producer.{field} is required")
        if producer.get("execution_state") not in {"RUN", "NOT_RUN", "UNVERIFIED"}:
            errors.append("producer.execution_state must be RUN, NOT_RUN, or UNVERIFIED")
    records = batch.get("records")
    if not isinstance(records, list):
        errors.append("records must be an array")
    elif not records:
        errors.append("records must contain at least one item")
    return errors


def provenance_check(capability: dict[str, Any], source_payload: Any | None) -> dict[str, Any]:
    source_reference = capability.get("source_reference", {}) if isinstance(capability, dict) else {}
    declared_hash = source_reference.get("source_hash", "")
    if not declared_hash:
        return {
            "status": "MISSING",
            "declared_hash": "",
            "computed_hash": "",
            "reason": "No source hash was declared.",
        }
    if source_payload is None:
        return {
            "status": "DECLARED_ONLY",
            "declared_hash": declared_hash,
            "computed_hash": "",
            "reason": "A source hash is declared, but source payload bytes were not supplied to this gate.",
        }
    computed = canonical_sha256(source_payload)
    if computed == declared_hash:
        return {
            "status": "VERIFIED",
            "declared_hash": declared_hash,
            "computed_hash": computed,
            "reason": "The supplied source payload matches the declared canonical SHA-256 hash.",
        }
    return {
        "status": "CONFLICTED",
        "declared_hash": declared_hash,
        "computed_hash": computed,
        "reason": "The supplied source payload does not match the declared source hash.",
    }


def immutable_source_check(capability: dict[str, Any], expected: dict[str, Any] | None) -> dict[str, Any]:
    if not expected:
        return {"status": "NOT_RUN", "mismatches": [], "reason": "No immutable-source baseline supplied."}
    source = capability.get("source_reference", {})
    actual = {
        "capability_id": capability.get("capability_id"),
        "capability_revision": capability.get("capability_revision"),
        "source_location": source.get("source_location"),
        "source_hash": source.get("source_hash"),
    }
    mismatches: list[dict[str, Any]] = []
    for key, expected_value in expected.items():
        if key not in actual:
            continue
        if actual[key] != expected_value:
            mismatches.append({"field": key, "expected": expected_value, "actual": actual[key]})
    return {
        "status": "PASS" if not mismatches else "CONFLICTED",
        "mismatches": mismatches,
        "reason": "Source identity is unchanged." if not mismatches else "One or more source-of-truth identity fields changed.",
    }
