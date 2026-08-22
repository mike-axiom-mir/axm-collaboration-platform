from __future__ import annotations

from decimal import Decimal
import hashlib
import json
import unicodedata


PROFILE_ID = "AXM-CJ-1"
PROFILE_VERSION = "1.0.0"


class DuplicateKeyError(ValueError):
    pass


def _pairs_no_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise DuplicateKeyError(f"Duplicate JSON object key: {key!r}")
        result[key] = value
    return result


def loads(text: str):
    return json.loads(
        text,
        parse_float=Decimal,
        parse_int=Decimal,
        object_pairs_hook=_pairs_no_duplicates,
    )


def _number(value) -> str:
    if isinstance(value, bool):
        raise TypeError("Boolean is not a number")
    if isinstance(value, int):
        value = Decimal(value)
    elif isinstance(value, float):
        if value != value or value in (float("inf"), float("-inf")):
            raise ValueError("Non-finite numbers are forbidden")
        value = Decimal(str(value))
    elif not isinstance(value, Decimal):
        raise TypeError(f"Unsupported number type: {type(value)!r}")

    if not value.is_finite():
        raise ValueError("Non-finite numbers are forbidden")
    if value == 0:
        return "0"
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return "0" if text in {"", "-0", "+0"} else text


def canonicalize(value) -> str:
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
        normalized = {}
        for key, item in value.items():
            if not isinstance(key, str):
                raise TypeError("AXM-CJ-1 object keys must be strings")
            normalized_key = unicodedata.normalize("NFC", key)
            if normalized_key in normalized:
                raise DuplicateKeyError(
                    f"Unicode normalization created duplicate key: {normalized_key!r}"
                )
            normalized[normalized_key] = item
        keys = sorted(normalized)
        return "{" + ",".join(
            canonicalize(key) + ":" + canonicalize(normalized[key])
            for key in keys
        ) + "}"
    raise TypeError(f"Unsupported AXM-CJ-1 value: {type(value)!r}")


def canonical_sha256(value) -> str:
    return hashlib.sha256(canonicalize(value).encode("utf-8")).hexdigest()
