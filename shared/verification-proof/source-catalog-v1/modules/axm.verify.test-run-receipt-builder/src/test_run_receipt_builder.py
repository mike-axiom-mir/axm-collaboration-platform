"""Detached AXM Test Run Receipt Builder v0.1.0."""
from __future__ import annotations
from datetime import datetime
from hashlib import sha256
from typing import Any, Dict, Mapping, Sequence
import json

VERDICTS = {"PASS", "FAIL", "UNKNOWN", "NOT_RUN", "CONFLICTED", "STALE", "HUMAN_REVIEW"}

class TestRunReceiptError(ValueError):
    pass

def _canonical(value: Any) -> bytes:
    try:
        return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise TestRunReceiptError("receipt content must be finite JSON data") from exc

def _nonempty(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise TestRunReceiptError(f"{name} must be non-empty")
    return value.strip()

def _parse_time(value: str, name: str) -> datetime:
    value = _nonempty(value, name)
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise TestRunReceiptError(f"{name} must be ISO-8601") from exc

class TestRunReceiptBuilder:
    def __init__(self, builder_id: str):
        self.builder_id = _nonempty(builder_id, "builder_id")

    def build(self, *, run_id: str, subject_ids: Sequence[str], environment: Mapping[str, Any],
              operations: Sequence[Mapping[str, Any]], inputs: Any, outputs: Any,
              verdict_state: str, limitations: Sequence[str] = (),
              started_at: str | None = None, finished_at: str | None = None,
              artifact_digests: Mapping[str, str] | None = None) -> Dict[str, Any]:
        run_id = _nonempty(run_id, "run_id")
        if verdict_state not in VERDICTS:
            raise TestRunReceiptError("invalid verdict_state")
        subjects = [_nonempty(item, "subject_id") for item in subject_ids]
        if not subjects:
            raise TestRunReceiptError("at least one subject_id is required")
        if not isinstance(environment, Mapping):
            raise TestRunReceiptError("environment must be a mapping")
        declared_operations = []
        for item in operations:
            if not isinstance(item, Mapping):
                raise TestRunReceiptError("each operation must be a mapping")
            operation = dict(item)
            operation["operation_id"] = _nonempty(operation.get("operation_id"), "operation_id")
            operation["kind"] = _nonempty(operation.get("kind"), "operation kind")
            declared_operations.append(operation)
        times = {"started_at": started_at, "finished_at": finished_at}
        if (started_at is None) != (finished_at is None):
            raise TestRunReceiptError("started_at and finished_at must be supplied together")
        if started_at is not None:
            start = _parse_time(started_at, "started_at")
            finish = _parse_time(finished_at, "finished_at")
            if finish < start:
                raise TestRunReceiptError("finished_at precedes started_at")
        digests = {}
        for name, digest in sorted((artifact_digests or {}).items()):
            key = _nonempty(name, "artifact name")
            if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdefABCDEF" for c in digest):
                raise TestRunReceiptError("artifact digest must be a 64-character hexadecimal SHA-256")
            digests[key] = digest.lower()
        receipt = {
            "schema_version": "axm.verify.test-run-receipt/0.1",
            "builder_id": self.builder_id,
            "run_id": run_id,
            "subject_ids": subjects,
            "environment": dict(environment),
            "declared_operations": declared_operations,
            "inputs": inputs,
            "outputs": outputs,
            "timing": times,
            "verdict_state": verdict_state,
            "limitations": [_nonempty(item, "limitation") for item in limitations],
            "artifact_sha256": digests,
            "operations_executed_by_builder": False,
            "integrity_not_truth": True,
            "authority": "NONE",
            "canon": False,
        }
        receipt["receipt_sha256"] = sha256(_canonical(receipt)).hexdigest()
        return receipt

    @staticmethod
    def verify(receipt: Mapping[str, Any]) -> bool:
        if not isinstance(receipt, Mapping):
            return False
        copy = dict(receipt)
        seal = copy.pop("receipt_sha256", None)
        if not isinstance(seal, str):
            return False
        try:
            return sha256(_canonical(copy)).hexdigest() == seal
        except TestRunReceiptError:
            return False
