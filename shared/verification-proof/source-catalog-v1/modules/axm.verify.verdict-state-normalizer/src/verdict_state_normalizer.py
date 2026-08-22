"""Detached AXM Verdict State Normalizer v0.1.0."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, Mapping, Sequence
import copy

CANONICAL_VERDICTS = (
    "PASS",
    "FAIL",
    "UNKNOWN",
    "NOT_RUN",
    "CONFLICTED",
    "STALE",
    "HUMAN_REVIEW",
)

class VerdictNormalizationError(ValueError):
    """Bounded refusal from the verdict normalizer."""

def _label(value: Any, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise VerdictNormalizationError(f"{field_name} must be a non-empty string")
    return value.strip()

def _key(value: str) -> str:
    return " ".join(value.strip().upper().replace("-", "_").split())

@dataclass(frozen=True)
class VerdictNormalizer:
    profile_mapping: Mapping[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        clean: Dict[str, str] = {}
        for raw, canonical in dict(self.profile_mapping).items():
            raw_label = _label(raw, "profile mapping key")
            canonical_label = _label(canonical, "profile mapping value").upper()
            if canonical_label not in CANONICAL_VERDICTS:
                raise VerdictNormalizationError(
                    f"invalid canonical verdict in profile mapping: {canonical_label}"
                )
            clean[_key(raw_label)] = canonical_label
        object.__setattr__(self, "profile_mapping", clean)

    def normalize(
        self,
        raw_state: str,
        source: str,
        *,
        context: Mapping[str, Any] | None = None,
    ) -> Dict[str, Any]:
        raw = _label(raw_state, "raw_state")
        source_name = _label(source, "source")
        normalized_key = _key(raw)

        if normalized_key in CANONICAL_VERDICTS:
            canonical = normalized_key
            method = "CANONICAL_INPUT"
            requires_review = canonical in {"UNKNOWN", "CONFLICTED", "HUMAN_REVIEW", "STALE"}
        elif normalized_key in self.profile_mapping:
            canonical = self.profile_mapping[normalized_key]
            method = "EXPLICIT_PROFILE_MAPPING"
            requires_review = canonical in {"UNKNOWN", "CONFLICTED", "HUMAN_REVIEW", "STALE"}
        else:
            canonical = "UNKNOWN"
            method = "UNMAPPED_RAW_STATE"
            requires_review = True

        return {
            "schema_version": "axm.verify.verdict-receipt/0.1",
            "canonical_state": canonical,
            "raw_state": raw,
            "source": source_name,
            "normalization_method": method,
            "requires_review": requires_review,
            "context": copy.deepcopy(dict(context or {})),
            "authority": "NONE",
            "canon": False,
        }

    def state_inventory(self, receipts: Sequence[Mapping[str, Any]]) -> Dict[str, Any]:
        counts = {state: 0 for state in CANONICAL_VERDICTS}
        invalid = []
        for index, receipt in enumerate(receipts):
            state = receipt.get("canonical_state")
            if state not in CANONICAL_VERDICTS:
                invalid.append(index)
                continue
            counts[state] += 1
        return {
            "schema_version": "axm.verify.verdict-inventory/0.1",
            "counts": counts,
            "present_states": [state for state in CANONICAL_VERDICTS if counts[state]],
            "invalid_receipt_indexes": invalid,
            "collapsed_score": None,
            "decision": None,
            "authority": "NONE",
        }

    def collapse_to_boolean(self, *args: Any, **kwargs: Any) -> bool:
        raise VerdictNormalizationError(
            "boolean collapse refused; preserve the canonical state"
        )

    def collapse_to_percentage(self, *args: Any, **kwargs: Any) -> float:
        raise VerdictNormalizationError(
            "percentage collapse refused; preserve distinct verdict states"
        )
