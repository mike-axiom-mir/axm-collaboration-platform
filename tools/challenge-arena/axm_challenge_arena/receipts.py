from __future__ import annotations

import copy
import hashlib
import hmac
import math
from typing import Any, Mapping

from .errors import IntegrityError, ValidationError
from .utils import canonical_json_bytes, ensure_slug, sha256_json, utc_now

RECEIPT_SCHEMA_VERSION = "axm.deterministic-receipt/0.2"
SUPPORTED_RECEIPT_SCHEMA_VERSIONS = {"axm.deterministic-receipt/0.1", RECEIPT_SCHEMA_VERSION}
ALLOWED_RESULT_STATUSES = {"PASS", "FAIL", "ERROR", "SKIP"}


def _key_bytes(value: str | bytes) -> bytes:
    return value if isinstance(value, bytes) else value.encode("utf-8")


def receipt_core(receipt: Mapping[str, Any]) -> dict[str, Any]:
    return {
        key: copy.deepcopy(value)
        for key, value in receipt.items()
        if key not in {"receipt_hash", "signature"}
    }


def receipt_signed_payload(receipt: Mapping[str, Any]) -> dict[str, Any]:
    core = receipt_core(receipt)
    return {**core, "receipt_hash": str(receipt.get("receipt_hash", ""))}


def build_receipt(
    *,
    challenge_id: str,
    submission_id: str,
    packet_hash: str,
    rubric_hash: str,
    submission_content_hash: str,
    artifact_set_hash: str,
    runner_id: str,
    results: list[dict[str, Any]],
    key_id: str | None = None,
    key: str | bytes | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a deterministic external-runner receipt and optionally HMAC-sign it."""

    core = {
        "schema_version": RECEIPT_SCHEMA_VERSION,
        "challenge_id": ensure_slug(challenge_id, "challenge_id"),
        "submission_id": ensure_slug(submission_id, "submission_id"),
        "packet_hash": str(packet_hash),
        "rubric_hash": str(rubric_hash),
        "submission_content_hash": str(submission_content_hash),
        "artifact_set_hash": str(artifact_set_hash),
        "runner_id": ensure_slug(runner_id, "runner_id"),
        "issued_at": utc_now(),
        "results": copy.deepcopy(results),
        "metadata": copy.deepcopy(metadata or {}),
    }
    receipt = {**core, "receipt_hash": sha256_json(core)}
    if key is not None:
        signature_key_id = ensure_slug(key_id or runner_id, "signature.key_id")
        value = hmac.new(
            _key_bytes(key),
            canonical_json_bytes(receipt_signed_payload(receipt)),
            hashlib.sha256,
        ).hexdigest()
        receipt["signature"] = {
            "algorithm": "hmac-sha256",
            "key_id": signature_key_id,
            "value": value,
        }
    return receipt


def normalize_receipt_results(results: Any) -> list[dict[str, Any]]:
    """Validate and normalize receipt results without changing the signed payload."""

    if not isinstance(results, list) or not results:
        raise ValidationError("Receipt results must be a non-empty list.")
    seen: set[str] = set()
    normalized_results: list[dict[str, Any]] = []
    for index, result in enumerate(results, start=1):
        if not isinstance(result, dict):
            raise ValidationError(f"Receipt result {index} must be an object.")
        try:
            result_id = ensure_slug(str(result.get("result_id", "")), "result_id")
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        if result_id in seen:
            raise ValidationError(f"Duplicate receipt result_id: {result_id}")
        seen.add(result_id)
        status = str(result.get("status", "")).upper()
        if status not in ALLOWED_RESULT_STATUSES:
            raise ValidationError(
                f"Receipt result {result_id}: status must be one of {sorted(ALLOWED_RESULT_STATUSES)}."
            )
        raw_score = result.get("score")
        score: float | None
        if raw_score is None:
            score = None
        else:
            try:
                score = float(raw_score)
            except (TypeError, ValueError) as exc:
                raise ValidationError(
                    f"Receipt result {result_id}: score must be numeric or null."
                ) from exc
            if not math.isfinite(score) or not 0.0 <= score <= 100.0:
                raise ValidationError(
                    f"Receipt result {result_id}: score must be finite and in 0..100."
                )
        if status in {"PASS", "FAIL", "ERROR"} and score is None:
            score = 100.0 if status == "PASS" else 0.0
        if status == "SKIP":
            score = None
        summary = str(result.get("summary", "")).strip()
        evidence = result.get("evidence", {})
        if not isinstance(evidence, dict):
            raise ValidationError(f"Receipt result {result_id}: evidence must be an object.")
        normalized_results.append(
            {
                "result_id": result_id,
                "status": status,
                "score": score,
                "summary": summary,
                "evidence": copy.deepcopy(evidence),
            }
        )
    return normalized_results


def validate_receipt(
    receipt: dict[str, Any],
    *,
    expected: dict[str, str],
    trusted_keys: Mapping[str, str | bytes] | None = None,
    allow_unsigned: bool = False,
) -> dict[str, Any]:
    """Validate binding, result shape, receipt hash, and optional HMAC signature."""

    if not isinstance(receipt, dict):
        raise ValidationError("External deterministic receipt must be a JSON object.")
    if receipt.get("schema_version") not in SUPPORTED_RECEIPT_SCHEMA_VERSIONS:
        raise ValidationError(
            f"Unsupported receipt schema {receipt.get('schema_version')!r}; expected one of {sorted(SUPPORTED_RECEIPT_SCHEMA_VERSIONS)!r}."
        )
    for field in (
        "challenge_id",
        "submission_id",
        "packet_hash",
        "rubric_hash",
        "submission_content_hash",
        "artifact_set_hash",
        "runner_id",
        "issued_at",
        "receipt_hash",
    ):
        if not isinstance(receipt.get(field), str) or not receipt[field].strip():
            raise ValidationError(f"Receipt field {field!r} must be a non-empty string.")
    for field, wanted in expected.items():
        if wanted is not None and receipt.get(field) != wanted:
            raise IntegrityError(
                f"Receipt {field} does not match the locked challenge/submission evidence."
            )

    core = receipt_core(receipt)
    calculated_hash = sha256_json(core)
    if not hmac.compare_digest(calculated_hash, str(receipt.get("receipt_hash"))):
        raise IntegrityError("External deterministic receipt_hash is invalid.")

    normalized_results = normalize_receipt_results(receipt.get("results"))

    signature = receipt.get("signature")
    signature_valid = False
    signature_key_id: str | None = None
    if signature is None:
        if not allow_unsigned:
            raise IntegrityError(
                "Unsigned external receipts are disabled. Configure a trusted runner key or explicitly allow unsigned receipts."
            )
    else:
        if not isinstance(signature, dict):
            raise ValidationError("Receipt signature must be an object.")
        if signature.get("algorithm") != "hmac-sha256":
            raise ValidationError("Only hmac-sha256 receipt signatures are supported.")
        signature_key_id = str(signature.get("key_id", ""))
        supplied = str(signature.get("value", ""))
        keys = trusted_keys or {}
        if signature_key_id not in keys:
            raise IntegrityError(f"Receipt signature key {signature_key_id!r} is not trusted.")
        calculated = hmac.new(
            _key_bytes(keys[signature_key_id]),
            canonical_json_bytes(receipt_signed_payload(receipt)),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(calculated, supplied):
            raise IntegrityError("External deterministic receipt signature is invalid.")
        signature_valid = True

    stored_receipt = copy.deepcopy(receipt)
    normalized_receipt = copy.deepcopy(receipt)
    normalized_receipt["results"] = normalized_results
    return {
        "receipt": stored_receipt,
        "normalized_receipt": normalized_receipt,
        "receipt_hash": calculated_hash,
        "runner_id": stored_receipt["runner_id"],
        "signature_present": signature is not None,
        "signature_valid": signature_valid,
        "signature_key_id": signature_key_id,
    }
