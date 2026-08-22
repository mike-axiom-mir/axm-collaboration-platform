"""Detached AXM Proof Freshness and Expiry Policy v0.1.0."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Mapping, Sequence
import copy
import json

class FreshnessPolicyError(ValueError):
    """A freshness evaluation cannot be performed under the declared contract."""

def _text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise FreshnessPolicyError(f"{field} must be a non-empty string")
    return value.strip()

def _parse_time(value: Any, field: str) -> datetime:
    text = _text(value, field)
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError as exc:
        raise FreshnessPolicyError(f"{field} must be ISO-8601") from exc
    if parsed.tzinfo is None:
        raise FreshnessPolicyError(f"{field} must include a timezone")
    return parsed.astimezone(timezone.utc)

def _same(a: Any, b: Any) -> bool:
    return json.dumps(a, ensure_ascii=False, sort_keys=True, separators=(",", ":")) == json.dumps(b, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

@dataclass(frozen=True)
class FreshnessPolicy:
    policy_id: str
    required_dimensions: Sequence[str]
    max_age_seconds: int | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "policy_id", _text(self.policy_id, "policy_id"))
        if not isinstance(self.required_dimensions, (list, tuple)) or not self.required_dimensions:
            raise FreshnessPolicyError("required_dimensions must be a non-empty list")
        clean = []
        seen = set()
        for index, raw in enumerate(self.required_dimensions):
            item = _text(raw, f"required_dimensions[{index}]")
            if item in seen:
                raise FreshnessPolicyError(f"duplicate required dimension: {item}")
            seen.add(item)
            clean.append(item)
        object.__setattr__(self, "required_dimensions", tuple(clean))
        if self.max_age_seconds is not None:
            if not isinstance(self.max_age_seconds, int) or isinstance(self.max_age_seconds, bool) or self.max_age_seconds < 0:
                raise FreshnessPolicyError("max_age_seconds must be a non-negative integer or null")

    def evaluate(self, proof_receipt: Mapping[str, Any], current_context: Mapping[str, Any], as_of: str) -> Dict[str, Any]:
        if not isinstance(proof_receipt, Mapping):
            raise FreshnessPolicyError("proof_receipt must be an object")
        if not isinstance(current_context, Mapping):
            raise FreshnessPolicyError("current_context must be an object")
        proof_id = _text(proof_receipt.get("proof_id"), "proof_receipt.proof_id")
        issued = _parse_time(proof_receipt.get("issued_at"), "proof_receipt.issued_at")
        now = _parse_time(as_of, "as_of")
        receipt_context = proof_receipt.get("context")
        if not isinstance(receipt_context, Mapping):
            raise FreshnessPolicyError("proof_receipt.context must be an object")

        stale_reasons = []
        unknown_reasons = []
        for dimension in self.required_dimensions:
            if dimension not in receipt_context:
                unknown_reasons.append({"dimension": dimension, "reason": "MISSING_FROM_PROOF_CONTEXT"})
            elif dimension not in current_context:
                unknown_reasons.append({"dimension": dimension, "reason": "MISSING_FROM_CURRENT_CONTEXT"})
            elif not _same(receipt_context[dimension], current_context[dimension]):
                stale_reasons.append({"dimension": dimension, "reason": "CONTEXT_CHANGED", "proof_value": copy.deepcopy(receipt_context[dimension]), "current_value": copy.deepcopy(current_context[dimension])})

        age_seconds = int((now - issued).total_seconds())
        if age_seconds < 0:
            unknown_reasons.append({"dimension": "time", "reason": "PROOF_ISSUED_IN_FUTURE"})
        elif self.max_age_seconds is not None and age_seconds > self.max_age_seconds:
            stale_reasons.append({"dimension": "time", "reason": "MAX_AGE_EXCEEDED", "age_seconds": age_seconds, "max_age_seconds": self.max_age_seconds})

        if stale_reasons:
            state = "STALE"
            recommended = "STALE"
        elif unknown_reasons:
            state = "UNKNOWN"
            recommended = "UNKNOWN"
        else:
            state = "FRESH"
            recommended = None

        return {
            "schema_version": "axm.verify.freshness-receipt/0.1",
            "policy_id": self.policy_id,
            "proof_id": proof_id,
            "as_of": now.isoformat().replace("+00:00", "Z"),
            "age_seconds": age_seconds,
            "freshness_state": state,
            "stale_reasons": stale_reasons,
            "unknown_reasons": unknown_reasons,
            "recommended_verdict_state": recommended,
            "fresh_means_pass": False,
            "authority": "NONE",
            "canon": False,
        }
