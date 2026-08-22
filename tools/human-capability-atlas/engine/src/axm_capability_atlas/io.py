from __future__ import annotations

from pathlib import Path
import json
import os
import tempfile


class DuplicateJSONKeyError(ValueError):
    pass


def _reject_duplicate_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise DuplicateJSONKeyError(f"Duplicate JSON object key: {key!r}")
        result[key] = value
    return result


def loads_json(text: str):
    return json.loads(text, object_pairs_hook=_reject_duplicate_pairs)


def load_json(path: str | Path):
    p = Path(path)
    try:
        return loads_json(p.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"JSON file not found: {p}") from exc
    except (json.JSONDecodeError, DuplicateJSONKeyError) as exc:
        raise ValueError(f"Invalid or ambiguous JSON in {p}: {exc}") from exc


def _target_mode(path: Path) -> int:
    """Choose artifact permissions from the containing privacy boundary.

    - Existing files keep their existing permission mode.
    - New files inherit the parent directory's read/write audience:
      0700 parent -> 0600 file
      0750 parent -> 0640 file
      0770/0775 parent -> 0660/0664 file

    This avoids mkstemp's unconditional 0600 becoming an accidental barrier
    between bounded AXM processes while still respecting a private parent.
    """
    try:
        if path.exists():
            return path.stat().st_mode & 0o777
        inherited = path.parent.stat().st_mode & 0o666
        return inherited or 0o600
    except OSError:
        return 0o600


def _fsync_directory(path: Path) -> None:
    """Persist directory entry changes where the platform supports it."""
    try:
        flags = getattr(os, "O_DIRECTORY", 0) | os.O_RDONLY
        fd = os.open(str(path), flags)
    except OSError:
        return
    try:
        os.fsync(fd)
    except OSError:
        pass
    finally:
        os.close(fd)


def remove_file_durable(path: str | Path) -> bool:
    """Remove a completion marker and persist the directory mutation."""
    p = Path(path)
    try:
        p.unlink()
    except FileNotFoundError:
        return False
    _fsync_directory(p.parent)
    return True


def _atomic_bytes(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    desired_mode = _target_mode(path)
    fd, temp_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=str(path.parent),
    )
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        try:
            os.chmod(temp_name, desired_mode)
        except OSError:
            # Some filesystems/platforms do not expose POSIX chmod semantics.
            # Atomic correctness does not depend on chmod support.
            pass
        os.replace(temp_name, path)
        _fsync_directory(path.parent)
    finally:
        try:
            Path(temp_name).unlink(missing_ok=True)
        except OSError:
            pass


def save_json(path: str | Path, data: dict | list) -> None:
    p = Path(path)
    payload = (json.dumps(data, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    _atomic_bytes(p, payload)


def save_text(path: str | Path, text: str) -> None:
    _atomic_bytes(Path(path), text.encode("utf-8"))
