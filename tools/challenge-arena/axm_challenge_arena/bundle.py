from __future__ import annotations

import hashlib
import json
import os
import stat
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from .errors import IntegrityError, ValidationError
from .utils import (
    ensure_unique_portable_paths,
    semantic_state_hash,
    sha256_bytes,
    sha256_file,
    sha256_json,
)
from .version import __version__

# Earliest timestamp accepted by the ZIP format. Fixed metadata makes two exports of
# the same immutable challenge snapshot byte-for-byte reproducible.
_ZIP_TIMESTAMP = (1980, 1, 1, 0, 0, 0)
_EXCLUDED_NAMES = {".pending-commit.json", ".legacy-event-migration.json"}
_COPY_CHUNK_BYTES = 1024 * 1024


@dataclass(frozen=True)
class _SourceEntry:
    relative_path: str
    path: Path
    size: int
    sha256: str
    mtime_ns: int
    inode: int
    device: int


def _is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def _challenge_files(challenge_dir: Path) -> Iterable[Path]:
    """Yield regular evidence files without following symbolic links."""

    for current_root, dir_names, file_names in os.walk(
        challenge_dir, topdown=True, followlinks=False
    ):
        root = Path(current_root)
        kept_dirs: list[str] = []
        for name in sorted(dir_names):
            path = root / name
            if path.is_symlink():
                raise IntegrityError(
                    f"Evidence bundle refuses symbolic-link directory: "
                    f"{path.relative_to(challenge_dir).as_posix()}"
                )
            kept_dirs.append(name)
        dir_names[:] = kept_dirs
        for name in sorted(file_names):
            if name in _EXCLUDED_NAMES:
                continue
            path = root / name
            if path.is_symlink():
                raise IntegrityError(
                    f"Evidence bundle refuses symbolic-link file: "
                    f"{path.relative_to(challenge_dir).as_posix()}"
                )
            mode = path.stat(follow_symlinks=False).st_mode
            if not stat.S_ISREG(mode):
                raise IntegrityError(
                    f"Evidence bundle supports regular files only: "
                    f"{path.relative_to(challenge_dir).as_posix()}"
                )
            yield path


def _zip_info(name: str) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, _ZIP_TIMESTAMP)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.create_system = 3
    # Stable regular-file permissions: rw-r--r--.
    info.external_attr = (0o100644 & 0xFFFF) << 16
    return info


def _snapshot_entry(challenge_dir: Path, path: Path) -> _SourceEntry:
    before = path.stat(follow_symlinks=False)
    digest = sha256_file(path)
    after = path.stat(follow_symlinks=False)
    identity_before = (
        before.st_size,
        before.st_mtime_ns,
        before.st_ino,
        before.st_dev,
    )
    identity_after = (
        after.st_size,
        after.st_mtime_ns,
        after.st_ino,
        after.st_dev,
    )
    if identity_before != identity_after:
        raise IntegrityError(
            f"Evidence file changed while its snapshot hash was being measured: "
            f"{path.relative_to(challenge_dir).as_posix()}"
        )
    return _SourceEntry(
        relative_path=path.relative_to(challenge_dir).as_posix(),
        path=path,
        size=after.st_size,
        sha256=digest,
        mtime_ns=after.st_mtime_ns,
        inode=after.st_ino,
        device=after.st_dev,
    )


def _stream_entry(archive: zipfile.ZipFile, entry: _SourceEntry) -> None:
    """Copy one file with bounded memory and reverify the exact manifest bytes."""

    before = entry.path.stat(follow_symlinks=False)
    identity = (before.st_size, before.st_mtime_ns, before.st_ino, before.st_dev)
    expected = (entry.size, entry.mtime_ns, entry.inode, entry.device)
    if identity != expected:
        raise IntegrityError(
            f"Evidence file changed after the bundle manifest was sealed: "
            f"{entry.relative_path}"
        )

    digest = hashlib.sha256()
    copied = 0
    info = _zip_info(f"challenge/{entry.relative_path}")
    with entry.path.open("rb") as source, archive.open(
        info, "w", force_zip64=True
    ) as target:
        while True:
            chunk = source.read(_COPY_CHUNK_BYTES)
            if not chunk:
                break
            target.write(chunk)
            digest.update(chunk)
            copied += len(chunk)

    after = entry.path.stat(follow_symlinks=False)
    final_identity = (after.st_size, after.st_mtime_ns, after.st_ino, after.st_dev)
    if final_identity != expected:
        raise IntegrityError(
            f"Evidence file changed while being streamed into the bundle: "
            f"{entry.relative_path}"
        )
    if copied != entry.size or digest.hexdigest() != entry.sha256:
        raise IntegrityError(
            f"Evidence file bytes no longer match the sealed bundle manifest: "
            f"{entry.relative_path}"
        )


def build_challenge_bundle(
    *,
    challenge_dir: Path,
    state: dict[str, Any],
    integrity_report: dict[str, Any],
    destination: Path,
) -> dict[str, Any]:
    """Write a reproducible, streaming evidence ZIP for one challenge snapshot.

    Challenge files are hashed first and streamed in bounded chunks. Every source file
    is rechecked during the write, so a file changing between manifest creation and ZIP
    output aborts the export rather than yielding a misleading mixed snapshot.
    """

    challenge_dir = challenge_dir.expanduser().resolve(strict=True)
    destination = destination.expanduser().resolve(strict=False)
    if destination.exists() and destination.is_symlink():
        raise ValidationError("Evidence bundle destination may not be a symbolic link.")
    if _is_relative_to(destination, challenge_dir):
        raise ValidationError(
            "Evidence bundle destination may not be inside the challenge evidence tree."
        )
    destination.parent.mkdir(parents=True, exist_ok=True)

    source_entries = [
        _snapshot_entry(challenge_dir, path) for path in _challenge_files(challenge_dir)
    ]
    source_entries.sort(key=lambda item: item.relative_path)
    try:
        ensure_unique_portable_paths(
            [entry.relative_path for entry in source_entries],
            field="bundle evidence path",
        )
    except ValueError as exc:
        raise IntegrityError(str(exc)) from exc

    entries = [
        {
            "path": entry.relative_path,
            "bytes": entry.size,
            "sha256": entry.sha256,
        }
        for entry in source_entries
    ]

    integrity_snapshot = {
        key: value for key, value in integrity_report.items() if key != "checked_at"
    }
    integrity_snapshot["snapshot_event_head"] = state.get("event_head")
    integrity_snapshot["snapshot_event_sequence"] = state.get("event_sequence")
    integrity_bytes = json.dumps(
        integrity_snapshot,
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
        allow_nan=False,
    ).encode("utf-8") + b"\n"

    manifest_core = {
        "schema_version": "axm.challenge-bundle/0.4",
        "arena_version": __version__,
        "challenge_id": state["challenge_id"],
        "challenge_state": state.get("state"),
        "snapshot_updated_at": state.get("updated_at"),
        "packet_hash": state.get("packet_hash"),
        "rubric_hash": state.get("rubric_hash"),
        "event_head": state.get("event_head"),
        "event_sequence": state.get("event_sequence"),
        "integrity_valid": bool(integrity_report.get("valid")),
        "integrity_report_sha256": sha256_bytes(integrity_bytes),
        "files": entries,
        "challenge_tree_hash": sha256_json(entries),
        "semantic_state_hash": semantic_state_hash(state),
        "total_source_bytes": sum(entry.size for entry in source_entries),
        "streaming_copy_chunk_bytes": _COPY_CHUNK_BYTES,
        "generated_metadata_policy": (
            "fixed ZIP timestamps; snapshot time comes from stored state; source files "
            "are reverified while streamed"
        ),
    }
    manifest = {**manifest_core, "bundle_manifest_hash": sha256_json(manifest_core)}
    manifest_bytes = json.dumps(
        manifest, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False
    ).encode("utf-8") + b"\n"

    temp = destination.with_name(f".{destination.name}.{os.getpid()}.tmp")
    temp.unlink(missing_ok=True)
    try:
        with zipfile.ZipFile(
            temp,
            "w",
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=9,
            strict_timestamps=True,
        ) as archive:
            archive.writestr(_zip_info("BUNDLE-MANIFEST.json"), manifest_bytes)
            archive.writestr(_zip_info("INTEGRITY-REPORT.json"), integrity_bytes)
            for entry in source_entries:
                _stream_entry(archive, entry)
        os.replace(temp, destination)
    finally:
        temp.unlink(missing_ok=True)

    # A final read catches a truncated or malformed local archive before success.
    with zipfile.ZipFile(destination, "r") as archive:
        corrupt = archive.testzip()
        if corrupt is not None:
            destination.unlink(missing_ok=True)
            raise OSError(f"Bundle ZIP failed its CRC check at {corrupt}")

    return {
        "schema_version": "axm.challenge-bundle-return/0.4",
        "challenge_id": state["challenge_id"],
        "path": str(destination),
        "bytes": destination.stat().st_size,
        "sha256": sha256_file(destination),
        "bundle_manifest_hash": manifest["bundle_manifest_hash"],
        "integrity_report_sha256": manifest["integrity_report_sha256"],
        "challenge_tree_hash": manifest["challenge_tree_hash"],
        "semantic_state_hash": manifest["semantic_state_hash"],
        "integrity_valid": bool(integrity_report.get("valid")),
        "file_count": len(entries),
        "source_bytes": manifest_core["total_source_bytes"],
        "streaming_copy": True,
        "reproducible_for_same_snapshot": True,
    }
