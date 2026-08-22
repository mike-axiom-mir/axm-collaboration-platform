from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
CONTRACT_ROOT = PACKAGE_ROOT / "shared-contract"
DATA_ROOT = PACKAGE_ROOT / "data"


class DuplicateJSONKeyError(ValueError):
    """Raised when a JSON object contains the same key more than once."""


class NonFiniteJSONNumberError(ValueError):
    """Raised when JSON uses NaN or Infinity, which RFC 8259 does not permit."""


def _pairs_without_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise DuplicateJSONKeyError(f"Duplicate JSON object key: {key!r}")
        result[key] = value
    return result


def _reject_non_finite(token: str) -> None:
    raise NonFiniteJSONNumberError(f"Non-finite JSON number is forbidden: {token}")


def loads_json(text: str) -> Any:
    """Parse RFC 8259 JSON without duplicate keys or non-finite numbers."""
    return json.loads(
        text,
        object_pairs_hook=_pairs_without_duplicates,
        parse_constant=_reject_non_finite,
    )


def load_json(path: str | Path) -> Any:
    return loads_json(Path(path).read_text(encoding="utf-8"))


def dump_json(path: str | Path, value: Any) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
        encoding="utf-8",
    )


def stable_id(prefix: str, value: Any, length: int = 16) -> str:
    payload = json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:length]
    return f"{prefix}.{digest}"
