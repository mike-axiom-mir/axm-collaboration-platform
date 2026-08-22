"""Detached AXM Citation and Quote Fidelity Checker v0.1.0."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Mapping
import hashlib
import re


class CitationFidelityError(ValueError):
    """The supplied fidelity record violates the bounded contract."""


def _text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise CitationFidelityError(f"{field} must be a non-empty string")
    return value.strip()


def _normalise(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


@dataclass(frozen=True)
class CitationQuoteFidelityChecker:
    checker_id: str
    quote_mode: str = "EXACT"

    def __post_init__(self) -> None:
        object.__setattr__(self, "checker_id", _text(self.checker_id, "checker_id"))
        mode = _text(self.quote_mode, "quote_mode").upper()
        if mode not in {"EXACT", "NORMALIZED_WHITESPACE"}:
            raise CitationFidelityError("quote_mode must be EXACT or NORMALIZED_WHITESPACE")
        object.__setattr__(self, "quote_mode", mode)

    def evaluate(self, record: Mapping[str, Any]) -> Dict[str, Any]:
        if not isinstance(record, Mapping):
            raise CitationFidelityError("record must be an object")
        citation_id = _text(record.get("citation_id"), "citation_id")
        claim_id = _text(record.get("claim_id"), "claim_id")
        claim_text = _text(record.get("claim_text"), "claim_text")
        citation = record.get("citation")
        binding = record.get("source_binding")
        if not isinstance(citation, Mapping) or not isinstance(binding, Mapping):
            raise CitationFidelityError("citation and source_binding must be objects")

        cited_source = _text(citation.get("source_id"), "citation.source_id")
        bound_source = _text(binding.get("source_id"), "source_binding.source_id")
        cited_locator = _text(citation.get("locator"), "citation.locator")
        bound_locator = _text(binding.get("locator"), "source_binding.locator")
        source_excerpt = _text(binding.get("source_excerpt"), "source_binding.source_excerpt")

        reasons = []
        binding_match = cited_source == bound_source and cited_locator == bound_locator
        if cited_source != bound_source:
            reasons.append("SOURCE_ID_MISMATCH")
        if cited_locator != bound_locator:
            reasons.append("LOCATOR_MISMATCH")

        quoted = citation.get("quoted_text")
        if quoted is None:
            quote_state = "NOT_APPLICABLE"
        else:
            quoted = _text(quoted, "citation.quoted_text")
            if self.quote_mode == "EXACT":
                quote_match = quoted in source_excerpt
            else:
                quote_match = _normalise(quoted) in _normalise(source_excerpt)
            quote_state = "MATCH" if quote_match else "MISMATCH"
            if not quote_match:
                reasons.append("QUOTE_NOT_FOUND_IN_BOUND_EXCERPT")

        expected_attribution = binding.get("attribution")
        cited_attribution = citation.get("attribution")
        if expected_attribution is None:
            attribution_state = "NOT_DECLARED"
        else:
            expected = _text(expected_attribution, "source_binding.attribution")
            attribution_state = "MATCH" if cited_attribution == expected else "MISMATCH"
            if attribution_state == "MISMATCH":
                reasons.append("ATTRIBUTION_MISMATCH")

        support_mode = _text(record.get("support_mode", "HUMAN_REVIEW"), "support_mode").upper()
        if support_mode == "EXACT_TEXT":
            support_state = "SUPPORTED" if _normalise(claim_text) in _normalise(source_excerpt) else "NOT_SUPPORTED"
            if support_state == "NOT_SUPPORTED":
                reasons.append("CLAIM_TEXT_NOT_FOUND_IN_BOUND_EXCERPT")
        elif support_mode == "HUMAN_REVIEW":
            support_state = "HUMAN_REVIEW"
        else:
            raise CitationFidelityError("support_mode must be EXACT_TEXT or HUMAN_REVIEW")

        hard_failure = (not binding_match or quote_state == "MISMATCH" or attribution_state == "MISMATCH" or support_state == "NOT_SUPPORTED")
        if hard_failure:
            verdict = "FAIL"
        elif support_state == "HUMAN_REVIEW":
            verdict = "HUMAN_REVIEW"
        else:
            verdict = "PASS"

        digest = hashlib.sha256(source_excerpt.encode("utf-8")).hexdigest()
        return {
            "schema_version": "axm.verify.citation-fidelity-receipt/0.1",
            "checker_id": self.checker_id,
            "citation_id": citation_id,
            "claim_id": claim_id,
            "binding_match": binding_match,
            "quote_state": quote_state,
            "attribution_state": attribution_state,
            "support_mode": support_mode,
            "support_state": support_state,
            "verdict_state": verdict,
            "reasons": reasons,
            "bound_excerpt_sha256": digest,
            "semantic_support_proven": False,
            "authority": "NONE",
            "canon": False,
        }
