from __future__ import annotations

import hashlib
import json
import math
import os
import re
import tempfile
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence


_WINDOWS_RESERVED_BASENAMES = {
    "con",
    "prn",
    "aux",
    "nul",
    "clock$",
    *(f"com{index}" for index in range(1, 10)),
    *(f"lpt{index}" for index in range(1, 10)),
}
_WINDOWS_FORBIDDEN_CHARS = frozenset('<>:"|?*')
_BIDI_CONTROL_CODEPOINTS = frozenset(
    {
        0x061C,
        0x200E,
        0x200F,
        *range(0x202A, 0x202F),
        *range(0x2066, 0x206A),
    }
)
_MAX_PORTABLE_PATH_CHARS = 4096
_MAX_PORTABLE_SEGMENT_UTF8_BYTES = 255
_MAX_JSON_DEPTH = 96
_MAX_JSON_NODES = 500_000
_MAX_JSON_STRING_UTF8_BYTES = 16 * 1024 * 1024


class DuplicateJsonKeyError(ValueError):
    """Raised when an input JSON object repeats a key."""


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_utc_timestamp(value: str) -> datetime:
    """Parse a stored UTC timestamp and reject naive or non-UTC values."""

    if not isinstance(value, str) or not value.strip():
        raise ValueError("UTC timestamp must be a non-empty string.")
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError as exc:
        raise ValueError(f"Invalid UTC timestamp: {value!r}") from exc
    if parsed.tzinfo is None or parsed.utcoffset() != timezone.utc.utcoffset(parsed):
        raise ValueError(f"Timestamp must carry an explicit UTC offset: {value!r}")
    return parsed.astimezone(timezone.utc)


def format_utc_timestamp(value: datetime) -> str:
    """Render a timezone-aware datetime in the Arena's stable UTC form."""

    if value.tzinfo is None:
        raise ValueError("Cannot format a naive datetime as UTC evidence.")
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def validate_json_tree(
    value: Any,
    *,
    max_depth: int = _MAX_JSON_DEPTH,
    max_nodes: int = _MAX_JSON_NODES,
    max_string_utf8_bytes: int = _MAX_JSON_STRING_UTF8_BYTES,
) -> None:
    """Reject values that cannot be represented as portable, bounded JSON evidence.

    This is deliberately stricter than ``json.dumps``. It rejects unpaired Unicode
    surrogates, non-finite floats, non-string mapping keys, Python-only container
    types, and pathologically deep or huge trees before hashing or persistence.
    """

    if isinstance(max_depth, bool) or max_depth < 1:
        raise ValueError("max_depth must be a positive integer.")
    if isinstance(max_nodes, bool) or max_nodes < 1:
        raise ValueError("max_nodes must be a positive integer.")
    if isinstance(max_string_utf8_bytes, bool) or max_string_utf8_bytes < 1:
        raise ValueError("max_string_utf8_bytes must be a positive integer.")

    stack: list[tuple[Any, int, str]] = [(value, 0, "$")]
    nodes = 0
    while stack:
        current, depth, location = stack.pop()
        nodes += 1
        if nodes > max_nodes:
            raise ValueError(f"JSON evidence exceeds the {max_nodes}-node limit.")
        if depth > max_depth:
            raise ValueError(
                f"JSON evidence exceeds the {max_depth}-level depth limit at {location}."
            )

        if current is None or isinstance(current, bool) or isinstance(current, int):
            continue
        if isinstance(current, float):
            if not math.isfinite(current):
                raise ValueError(f"Non-finite JSON number is not allowed at {location}.")
            continue
        if isinstance(current, str):
            try:
                encoded = current.encode("utf-8", "strict")
            except UnicodeEncodeError as exc:
                raise ValueError(
                    f"JSON string contains an unpaired Unicode surrogate at {location}."
                ) from exc
            if len(encoded) > max_string_utf8_bytes:
                raise ValueError(
                    f"JSON string exceeds the {max_string_utf8_bytes}-byte limit at {location}."
                )
            continue
        if isinstance(current, list):
            for index in range(len(current) - 1, -1, -1):
                stack.append((current[index], depth + 1, f"{location}[{index}]"))
            continue
        if isinstance(current, dict):
            for key, child in reversed(list(current.items())):
                if not isinstance(key, str):
                    raise ValueError(
                        f"JSON object key must be a string at {location}; got {type(key).__name__}."
                    )
                try:
                    key_bytes = key.encode("utf-8", "strict")
                except UnicodeEncodeError as exc:
                    raise ValueError(
                        f"JSON object key contains an unpaired Unicode surrogate at {location}."
                    ) from exc
                if len(key_bytes) > max_string_utf8_bytes:
                    raise ValueError(
                        f"JSON object key exceeds the {max_string_utf8_bytes}-byte limit at {location}."
                    )
                stack.append((child, depth + 1, f"{location}.{key}"))
            continue
        raise ValueError(
            f"Unsupported non-JSON value at {location}: {type(current).__name__}."
        )


def canonical_json_bytes(value: Any) -> bytes:
    """Stable UTF-8 JSON used for hashes and append-only evidence."""
    validate_json_tree(value)
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def _reject_json_constant(value: str) -> None:
    raise ValueError(f"Non-finite JSON number is not allowed: {value}")


def _strict_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise DuplicateJsonKeyError(f"Duplicate JSON object key: {key!r}")
        result[key] = value
    return result


def strict_json_loads(payload: str | bytes | bytearray) -> Any:
    """Parse bounded standards-compliant JSON without ambiguous Python extensions."""

    value = json.loads(
        payload,
        object_pairs_hook=_strict_object,
        parse_constant=_reject_json_constant,
    )
    validate_json_tree(value)
    return value


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_json(value: Any) -> str:
    return sha256_bytes(canonical_json_bytes(value))


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def _portable_segment_error(segment: str) -> str | None:
    if segment in {"", ".", ".."}:
        return "empty, '.' and '..' path segments are not allowed"
    if unicodedata.normalize("NFC", segment) != segment:
        return "path segments must use NFC Unicode normalization"
    if segment.endswith((" ", ".")):
        return "path segments may not end with a space or period"
    if len(segment.encode("utf-8")) > _MAX_PORTABLE_SEGMENT_UTF8_BYTES:
        return f"path segments may not exceed {_MAX_PORTABLE_SEGMENT_UTF8_BYTES} UTF-8 bytes"
    if any(character in _WINDOWS_FORBIDDEN_CHARS for character in segment):
        return "path segments may not contain Windows-reserved characters < > : \" | ? *"
    for character in segment:
        codepoint = ord(character)
        if codepoint < 32 or codepoint == 127:
            return "path segments may not contain control characters"
        if codepoint in _BIDI_CONTROL_CODEPOINTS:
            return "path segments may not contain bidirectional display controls"
    basename = segment.split(".", 1)[0].casefold()
    if basename in _WINDOWS_RESERVED_BASENAMES:
        return f"{segment!r} is a reserved device filename on Windows"
    return None


def portable_name_key(value: str) -> str:
    """Return a cross-platform collision key for a single identifier or path segment."""

    return unicodedata.normalize("NFC", value).casefold().rstrip(" .")


def portable_path_key(value: str | Path) -> str:
    """Return a normalized, case-insensitive key used to detect portable path collisions."""

    text = value.as_posix() if isinstance(value, Path) else str(value).replace("\\", "/")
    return "/".join(portable_name_key(part) for part in text.split("/"))


def ensure_unique_portable_names(
    values: Sequence[str],
    *,
    field: str = "value",
) -> None:
    seen: dict[str, str] = {}
    for value in values:
        key = portable_name_key(value)
        previous = seen.get(key)
        if previous is not None and previous != value:
            raise ValueError(
                f"Portable name collision: {field} values {previous!r} and {value!r} collide on a case-insensitive portable filesystem."
            )
        seen[key] = value


def ensure_unique_portable_paths(
    values: Sequence[str | Path],
    *,
    field: str = "path",
) -> None:
    seen: dict[str, str] = {}
    for value in values:
        text = value.as_posix() if isinstance(value, Path) else str(value).replace("\\", "/")
        key = portable_path_key(text)
        previous = seen.get(key)
        if previous is not None and previous != text:
            raise ValueError(
                f"Portable path collision: {field} values {previous!r} and {text!r} collide on a case-insensitive portable filesystem."
            )
        seen[key] = text


def ensure_slug(value: str, field: str = "id") -> str:
    cleaned = value.strip()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", cleaned):
        raise ValueError(
            f"{field} must start with a letter/number and contain only letters, numbers, '.', '_' or '-'."
        )
    error = _portable_segment_error(cleaned)
    if error:
        raise ValueError(f"{field} is not portable: {error}.")
    return cleaned


def fsync_directory(path: Path) -> None:
    """Best-effort directory sync after atomic rename/unlink."""
    if os.name == "nt":
        return
    try:
        descriptor = os.open(str(path), os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def atomic_write_bytes(path: Path, payload: bytes) -> None:
    """Durably replace ``path`` without exposing a partial destination file.

    A same-directory temporary file keeps the final rename atomic. Some synced,
    monitored, or unusual local filesystems can transiently remove a fresh hidden
    temporary file before ``os.replace`` observes it. Retry that narrow failure
    with a new inode; never fall back to a non-atomic direct write.
    """

    path.parent.mkdir(parents=True, exist_ok=True)
    last_missing_temp: FileNotFoundError | None = None
    for attempt in range(3):
        fd, tmp_name = tempfile.mkstemp(
            prefix=".axm-atomic-", suffix=".tmp", dir=str(path.parent)
        )
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            try:
                os.replace(tmp_name, path)
            except FileNotFoundError as exc:
                temp_disappeared = not os.path.exists(tmp_name)
                parent_exists = path.parent.is_dir()
                if not temp_disappeared or not parent_exists or attempt == 2:
                    raise
                last_missing_temp = exc
                continue
            fsync_directory(path.parent)
            return
        finally:
            if os.path.exists(tmp_name):
                os.unlink(tmp_name)

    # Defensive only: the loop either returns or raises on its final attempt.
    if last_missing_temp is not None:
        raise last_missing_temp


def atomic_write_text(path: Path, payload: str) -> None:
    atomic_write_bytes(path, payload.encode("utf-8"))


def pretty_json_text(value: Any) -> str:
    """Return the stable human-readable JSON representation used on disk."""
    validate_json_tree(value)
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False) + "\n"


def atomic_write_json(path: Path, value: Any) -> None:
    atomic_write_text(path, pretty_json_text(value))


def read_json(path: Path, *, max_bytes: int | None = None) -> Any:
    if max_bytes is not None:
        size = path.stat().st_size
        if size > max_bytes:
            raise ValueError(f"JSON file exceeds the {max_bytes}-byte intake limit: {path}")
    return strict_json_loads(path.read_bytes())


def append_jsonl(path: Path, value: Any) -> None:
    """Append one compact JSON line and force it to stable storage."""
    validate_json_tree(value)
    path.parent.mkdir(parents=True, exist_ok=True)
    line = (
        json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        )
        + "\n"
    ).encode("utf-8")
    fd = os.open(path, os.O_APPEND | os.O_CREAT | os.O_WRONLY, 0o600)
    try:
        offset = 0
        while offset < len(line):
            offset += os.write(fd, line[offset:])
        os.fsync(fd)
    finally:
        os.close(fd)


def safe_relative_path(value: str) -> Path:
    """Return a deterministic cross-platform relative path.

    The contract deliberately rejects names that are legal on one common filesystem
    but unsafe, ambiguous, or silently rewritten on another (Windows device names,
    alternate-data-stream colons, trailing periods/spaces, Unicode bidi controls, and
    non-normalized names).
    """

    if not isinstance(value, str):
        raise ValueError("Relative path must be a string.")
    normalized = value.replace("\\", "/")
    if not normalized or len(normalized) > _MAX_PORTABLE_PATH_CHARS:
        raise ValueError(f"Unsafe relative path: {value!r}")
    if normalized.startswith("/") or normalized.startswith("//"):
        raise ValueError(f"Unsafe relative path: {value!r}")
    if re.match(r"^[A-Za-z]:", normalized):
        raise ValueError(f"Unsafe drive or alternate-data-stream path: {value!r}")
    parts = normalized.split("/")
    for segment in parts:
        error = _portable_segment_error(segment)
        if error:
            raise ValueError(f"Unsafe relative path {value!r}: {error}.")
    return Path(*parts)


def iter_files(root: Path) -> Iterable[Path]:
    for path in sorted(root.rglob("*")):
        if path.is_file():
            yield path


def directory_manifest(root: Path) -> list[dict[str, Any]]:
    manifest: list[dict[str, Any]] = []
    for path in iter_files(root):
        rel = path.relative_to(root).as_posix()
        manifest.append({"path": rel, "bytes": path.stat().st_size, "sha256": sha256_file(path)})
    ensure_unique_portable_paths([item["path"] for item in manifest], field="directory manifest path")
    return manifest


def clamp(value: float, lower: float = 0.0, upper: float = 100.0) -> float:
    return max(lower, min(upper, value))


def semantic_state_hash(state: dict[str, Any]) -> str:
    """Hash challenge meaning while excluding commit bookkeeping fields."""
    clean = dict(state)
    for key in ("event_head", "event_sequence", "updated_at"):
        clean.pop(key, None)
    return sha256_json(clean)
