"""Independent AXM-CJ-1 canonical JSON implementation.

This module intentionally does not import executable code from an external
handoff package. It exists so Module Two can verify canonicalization claims
without trusting the producer's validator.
"""

from __future__ import annotations

from decimal import Decimal
import hashlib
import json
import unicodedata
from typing import Any


class DuplicateKeyError(ValueError):
    """Raised when JSON contains duplicate keys before or after NFC normalization."""


def _pairs_no_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise DuplicateKeyError(f"Duplicate JSON object key: {key!r}")
        result[key] = value
    return result


def _reject_non_finite(token: str) -> None:
    raise ValueError(f"Non-finite JSON number is forbidden: {token}")


def loads(text: str) -> Any:
    """Parse canonical-input JSON with exact decimals and strict RFC 8259 numbers."""
    return json.loads(
        text,
        parse_float=Decimal,
        parse_int=Decimal,
        parse_constant=_reject_non_finite,
        object_pairs_hook=_pairs_no_duplicates,
    )


def loads_standard(text: str) -> Any:
    """Parse RFC 8259 JSON with standard numbers and no duplicate keys."""
    return json.loads(
        text,
        parse_constant=_reject_non_finite,
        object_pairs_hook=_pairs_no_duplicates,
    )


def _number(value: Any) -> str:
    if isinstance(value, bool):
        raise TypeError("Boolean is not a number here")
    if isinstance(value, int):
        decimal_value = Decimal(value)
    elif isinstance(value, float):
        if value != value or value in (float("inf"), float("-inf")):
            raise ValueError("Non-finite number is forbidden")
        decimal_value = Decimal(str(value))
    elif isinstance(value, Decimal):
        decimal_value = value
    else:
        raise TypeError(f"Unsupported numeric type: {type(value)!r}")

    if not decimal_value.is_finite():
        raise ValueError("Non-finite number is forbidden")
    if decimal_value == 0:
        return "0"
    text = format(decimal_value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return "0" if text in {"-0", "+0", ""} else text


def canonicalize(value: Any) -> str:
    """Return the AXM-CJ-1 canonical JSON representation of a parsed value."""
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, (int, float, Decimal)) and not isinstance(value, bool):
        return _number(value)
    if isinstance(value, str):
        return json.dumps(
            unicodedata.normalize("NFC", value),
            ensure_ascii=False,
            separators=(",", ":"),
        )
    if isinstance(value, list):
        return "[" + ",".join(canonicalize(item) for item in value) + "]"
    if isinstance(value, dict):
        normalized: dict[str, Any] = {}
        for key, item in value.items():
            if not isinstance(key, str):
                raise TypeError("AXM-CJ-1 object keys must be strings")
            normalized_key = unicodedata.normalize("NFC", key)
            if normalized_key in normalized:
                raise DuplicateKeyError(
                    f"Unicode normalization created duplicate key: {normalized_key!r}"
                )
            normalized[normalized_key] = item
        return "{" + ",".join(
            canonicalize(key) + ":" + canonicalize(normalized[key])
            for key in sorted(normalized)
        ) + "}"
    raise TypeError(f"Unsupported AXM-CJ-1 type: {type(value)!r}")


def canonical_sha256(value: Any) -> str:
    return hashlib.sha256(canonicalize(value).encode("utf-8")).hexdigest()


def raw_sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()
