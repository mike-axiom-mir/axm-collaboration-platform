from __future__ import annotations

import hashlib
import json
from typing import Any

from .registry import PatternRegistry
from .trace import registry_fingerprint
from .util import stable_id
from .version import MODULE_ID

RECEIPT_VERSION = "0.2.0"


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")


def digest(value: Any) -> str:
    return f"sha256:{hashlib.sha256(canonical_bytes(value)).hexdigest()}"


def recommendation_core(recommendation: dict[str, Any]) -> dict[str, Any]:
    """Remove runtime timestamp while preserving every decision-bearing output field."""
    return {key: value for key, value in recommendation.items() if key != "generated_at"}


def build_decision_receipt(
    capability: dict[str, Any],
    context: dict[str, Any],
    recommendation: dict[str, Any],
    *,
    module_version: str,
    registry: PatternRegistry | None = None,
) -> dict[str, Any]:
    if recommendation.get("capability_id") != capability.get("capability_id"):
        raise ValueError("Receipt inputs conflict: recommendation capability_id does not match the capability record.")
    if recommendation.get("context") != context:
        raise ValueError("Receipt inputs conflict: supplied context does not equal the recommendation context snapshot.")

    core = recommendation_core(recommendation)
    receipt_core = {
        "capability_hash": digest(capability),
        "context_hash": digest(context),
        "registry_fingerprint": registry_fingerprint(registry),
        "engine_id": MODULE_ID,
        "engine_version": module_version,
        "contract_id": recommendation.get("contract_id", ""),
        "contract_version": recommendation.get("contract_version", ""),
        "recommendation_core_hash": digest(core),
    }
    return {
        "receipt_version": RECEIPT_VERSION,
        "receipt_id": stable_id("axm.hii.decision-receipt", receipt_core),
        **receipt_core,
        "capability_id": recommendation.get("capability_id", capability.get("capability_id", "")),
        "recommendation_id": recommendation.get("recommendation_id", ""),
        "selected_interface_pattern_id": recommendation.get("recommended_interface", {}).get("interface_pattern_id", ""),
        "recommendation_status": recommendation.get("recommended_interface", {}).get("recommendation_status", ""),
    }


def compare_receipts(expected: dict[str, Any], actual: dict[str, Any]) -> dict[str, Any]:
    compared = (
        "capability_hash",
        "context_hash",
        "registry_fingerprint",
        "engine_id",
        "engine_version",
        "contract_id",
        "contract_version",
        "recommendation_core_hash",
        "recommendation_id",
        "selected_interface_pattern_id",
        "recommendation_status",
    )
    differences = [
        {"field": field, "expected": expected.get(field), "actual": actual.get(field)}
        for field in compared
        if expected.get(field) != actual.get(field)
    ]
    return {"match": not differences, "differences": differences}
