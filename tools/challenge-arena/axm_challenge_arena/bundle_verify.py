from __future__ import annotations

import hashlib
import math
import stat
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any

from .contracts import packet_hash, rubric_hash
from .utils import (
    ensure_unique_portable_paths,
    safe_relative_path,
    semantic_state_hash,
    sha256_bytes,
    sha256_file,
    sha256_json,
    strict_json_loads,
)

BUNDLE_VERIFICATION_SCHEMA_VERSION = "axm.challenge-bundle-verification/0.4"
_DEFAULT_LIMITS = {
    "max_entries": 100_000,
    "max_entry_bytes": 16 * 1024**3,
    "max_total_uncompressed_bytes": 64 * 1024**3,
    "max_compression_ratio": 10_000.0,
    "max_metadata_json_bytes": 32 * 1024**2,
}




def _normalize_limits(overrides: dict[str, Any] | None) -> dict[str, Any]:
    if overrides is not None and not isinstance(overrides, dict):
        raise ValueError("bundle verification limits must be an object")
    applied = dict(_DEFAULT_LIMITS)
    if overrides:
        unknown = sorted(set(overrides) - set(_DEFAULT_LIMITS))
        if unknown:
            raise ValueError(f"unknown bundle verification limit(s): {unknown}")
        applied.update(overrides)
    for field in (
        "max_entries",
        "max_entry_bytes",
        "max_total_uncompressed_bytes",
        "max_metadata_json_bytes",
    ):
        value = applied[field]
        if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
            raise ValueError(f"{field} must be a positive integer")
    ratio = applied["max_compression_ratio"]
    if isinstance(ratio, bool) or not isinstance(ratio, (int, float)):
        raise ValueError("max_compression_ratio must be a positive finite number")
    ratio = float(ratio)
    if not math.isfinite(ratio) or ratio <= 0:
        raise ValueError("max_compression_ratio must be a positive finite number")
    applied["max_compression_ratio"] = ratio
    return applied


def _is_unsafe_special_file(info: zipfile.ZipInfo) -> bool:
    mode = (info.external_attr >> 16) & 0xFFFF
    file_type = stat.S_IFMT(mode)
    return bool(file_type and not stat.S_ISREG(mode) and not stat.S_ISDIR(mode))

def _is_symlink(info: zipfile.ZipInfo) -> bool:
    mode = (info.external_attr >> 16) & 0xFFFF
    return stat.S_ISLNK(mode)


def _read_bounded(
    archive: zipfile.ZipFile,
    info: zipfile.ZipInfo,
    *,
    maximum: int,
) -> bytes:
    if info.file_size > maximum:
        raise ValueError(f"ZIP entry exceeds the {maximum}-byte read limit: {info.filename}")
    with archive.open(info, "r") as handle:
        payload = handle.read(maximum + 1)
    if len(payload) > maximum:
        raise ValueError(f"ZIP entry exceeds the {maximum}-byte read limit: {info.filename}")
    if len(payload) != info.file_size:
        raise ValueError(f"ZIP entry byte count changed while reading: {info.filename}")
    return payload


def _hash_entry(archive: zipfile.ZipFile, info: zipfile.ZipInfo) -> str:
    digest = hashlib.sha256()
    copied = 0
    with archive.open(info, "r") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
            copied += len(chunk)
    if copied != info.file_size:
        raise ValueError(f"ZIP entry byte count mismatch: {info.filename}")
    return digest.hexdigest()


def _parse_json_entry(
    archive: zipfile.ZipFile,
    info: zipfile.ZipInfo,
    *,
    maximum: int,
) -> Any:
    return strict_json_loads(_read_bounded(archive, info, maximum=maximum))


def verify_evidence_bundle(
    path: str | Path,
    *,
    limits: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Verify an AXM evidence ZIP without extracting or trusting a workspace.

    The verifier checks ZIP structure, portable names, declared bytes/hashes,
    manifest bindings, the state/event chain, and the JSONL event projection.  It
    never executes candidate content and never writes archive members to disk.
    """

    bundle_path = Path(path).expanduser().resolve(strict=False)
    errors: list[str] = []
    warnings: list[str] = []
    try:
        applied = _normalize_limits(limits)
    except ValueError as exc:
        applied = dict(_DEFAULT_LIMITS)
        errors.append(str(exc))

    report: dict[str, Any] = {
        "schema_version": BUNDLE_VERIFICATION_SCHEMA_VERSION,
        "path": str(bundle_path),
        "exists": bundle_path.is_file(),
        "bundle_bytes": bundle_path.stat().st_size if bundle_path.is_file() else None,
        "bundle_sha256": sha256_file(bundle_path) if bundle_path.is_file() else None,
        "limits": applied,
        "errors": errors,
        "warnings": warnings,
        "extracted": False,
        "authority_boundary": (
            "A valid bundle proves internal byte and event consistency. It does not "
            "prove candidate quality, licensing, safety, or human approval."
        ),
    }
    if not bundle_path.is_file():
        errors.append("bundle path is not a regular file")
        report["valid"] = False
        return report

    try:
        with zipfile.ZipFile(bundle_path, "r") as archive:
            infos = archive.infolist()
            if len(infos) > int(applied["max_entries"]):
                errors.append(
                    f"archive has {len(infos)} entries; limit is {applied['max_entries']}"
                )

            names = [info.filename for info in infos]
            name_counts = Counter(names)
            duplicates = sorted(name for name, count in name_counts.items() if count > 1)
            if duplicates:
                errors.append(f"archive contains duplicate member names: {duplicates[:20]}")
            try:
                ensure_unique_portable_paths(names, field="bundle ZIP member")
            except ValueError as exc:
                errors.append(str(exc))

            total_uncompressed = 0
            info_by_name: dict[str, zipfile.ZipInfo] = {}
            for info in infos:
                name = info.filename
                try:
                    safe_relative_path(name)
                except ValueError as exc:
                    errors.append(f"unsafe archive member {name!r}: {exc}")
                if name.endswith("/"):
                    errors.append(f"directory entries are not permitted: {name!r}")
                if info.flag_bits & 0x1:
                    errors.append(f"encrypted archive member is not permitted: {name!r}")
                if _is_symlink(info):
                    errors.append(f"symbolic-link archive member is not permitted: {name!r}")
                elif _is_unsafe_special_file(info):
                    errors.append(f"special-file archive member is not permitted: {name!r}")
                if info.file_size > int(applied["max_entry_bytes"]):
                    errors.append(
                        f"archive member {name!r} is {info.file_size} bytes; "
                        f"limit is {applied['max_entry_bytes']}"
                    )
                total_uncompressed += info.file_size
                compressed = max(1, info.compress_size)
                ratio = info.file_size / compressed
                if ratio > float(applied["max_compression_ratio"]):
                    errors.append(
                        f"archive member {name!r} compression ratio {ratio:.1f} exceeds "
                        f"limit {applied['max_compression_ratio']}"
                    )
                info_by_name.setdefault(name, info)
            if total_uncompressed > int(applied["max_total_uncompressed_bytes"]):
                errors.append(
                    f"archive expands to {total_uncompressed} bytes; limit is "
                    f"{applied['max_total_uncompressed_bytes']}"
                )
            report["entry_count"] = len(infos)
            report["total_uncompressed_bytes"] = total_uncompressed

            required_metadata = {"BUNDLE-MANIFEST.json", "INTEGRITY-REPORT.json"}
            missing_metadata = sorted(required_metadata - set(info_by_name))
            if missing_metadata:
                errors.append(f"missing required bundle metadata: {missing_metadata}")
            if errors and missing_metadata:
                report["valid"] = False
                return report

            manifest_value = _parse_json_entry(
                archive,
                info_by_name["BUNDLE-MANIFEST.json"],
                maximum=int(applied["max_metadata_json_bytes"]),
            )
            integrity_bytes = _read_bounded(
                archive,
                info_by_name["INTEGRITY-REPORT.json"],
                maximum=int(applied["max_metadata_json_bytes"]),
            )
            integrity_value = strict_json_loads(integrity_bytes)
            if not isinstance(manifest_value, dict):
                errors.append("BUNDLE-MANIFEST.json is not an object")
                report["valid"] = False
                return report
            if not isinstance(integrity_value, dict):
                errors.append("INTEGRITY-REPORT.json is not an object")
                integrity_value = {}

            manifest_core = {
                key: value
                for key, value in manifest_value.items()
                if key != "bundle_manifest_hash"
            }
            if manifest_value.get("bundle_manifest_hash") != sha256_json(manifest_core):
                errors.append("bundle manifest hash mismatch")
            manifest_schema = manifest_value.get("schema_version")
            if manifest_schema not in {
                "axm.challenge-bundle/0.3",
                "axm.challenge-bundle/0.4",
            }:
                errors.append(f"unsupported bundle manifest schema_version: {manifest_schema!r}")
            if manifest_schema == "axm.challenge-bundle/0.4":
                for field in (
                    "integrity_report_sha256",
                    "challenge_tree_hash",
                    "semantic_state_hash",
                ):
                    value = manifest_value.get(field)
                    if not isinstance(value, str) or len(value) != 64:
                        errors.append(f"v0.4 bundle manifest is missing valid {field}")
            if manifest_value.get("integrity_report_sha256") not in {
                None,
                sha256_bytes(integrity_bytes),
            }:
                errors.append("integrity report SHA-256 mismatch")

            declared = manifest_value.get("files", [])
            if not isinstance(declared, list):
                errors.append("bundle manifest files is not a list")
                declared = []
            declared_by_name: dict[str, dict[str, Any]] = {}
            declared_paths: list[str] = []
            for index, item in enumerate(declared, start=1):
                if not isinstance(item, dict):
                    errors.append(f"bundle manifest file #{index} is not an object")
                    continue
                raw_path = item.get("path")
                if not isinstance(raw_path, str):
                    errors.append(f"bundle manifest file #{index} has no string path")
                    continue
                try:
                    rel = safe_relative_path(raw_path).as_posix()
                except ValueError as exc:
                    errors.append(f"unsafe declared challenge path {raw_path!r}: {exc}")
                    continue
                zip_name = f"challenge/{rel}"
                if zip_name in declared_by_name:
                    errors.append(f"bundle manifest repeats challenge path {rel!r}")
                    continue
                declared_paths.append(rel)
                declared_by_name[zip_name] = item
            try:
                ensure_unique_portable_paths(
                    declared_paths, field="bundle manifest challenge path"
                )
            except ValueError as exc:
                errors.append(str(exc))

            actual_challenge_names = {
                name for name in info_by_name if name.startswith("challenge/")
            }
            declared_names = set(declared_by_name)
            missing_declared = sorted(declared_names - actual_challenge_names)
            undeclared = sorted(actual_challenge_names - declared_names)
            if missing_declared:
                errors.append(f"declared challenge files are missing: {missing_declared[:20]}")
            if undeclared:
                errors.append(f"undeclared challenge files are present: {undeclared[:20]}")
            unexpected_top_level = sorted(
                set(info_by_name) - required_metadata - actual_challenge_names
            )
            if unexpected_top_level:
                errors.append(
                    f"unexpected top-level bundle members: {unexpected_top_level[:20]}"
                )

            verified_entries: list[dict[str, Any]] = []
            for zip_name, item in sorted(declared_by_name.items()):
                info = info_by_name.get(zip_name)
                if info is None:
                    continue
                expected_bytes = item.get("bytes")
                expected_hash = item.get("sha256")
                if isinstance(expected_bytes, bool) or not isinstance(expected_bytes, int):
                    errors.append(f"declared byte count is invalid for {zip_name}")
                    continue
                if expected_bytes != info.file_size:
                    errors.append(f"declared byte count mismatch for {zip_name}")
                try:
                    actual_hash = _hash_entry(archive, info)
                except Exception as exc:
                    errors.append(f"could not hash {zip_name}: {type(exc).__name__}: {exc}")
                    continue
                if expected_hash != actual_hash:
                    errors.append(f"declared SHA-256 mismatch for {zip_name}")
                verified_entries.append(
                    {
                        "path": str(item.get("path")),
                        "bytes": info.file_size,
                        "sha256": actual_hash,
                    }
                )

            verified_tree_hash = sha256_json(verified_entries)
            if manifest_value.get("challenge_tree_hash") not in {
                None,
                verified_tree_hash,
            }:
                errors.append("challenge_tree_hash mismatch")
            declared_total = sum(
                int(item.get("bytes", 0))
                for item in declared
                if isinstance(item, dict)
                and isinstance(item.get("bytes"), int)
                and not isinstance(item.get("bytes"), bool)
            )
            if manifest_value.get("total_source_bytes") not in {None, declared_total}:
                errors.append("manifest total_source_bytes does not match declared files")

            state_info = info_by_name.get("challenge/state.json")
            if state_info is None:
                errors.append("challenge/state.json is missing")
                state: dict[str, Any] = {}
            else:
                parsed_state = _parse_json_entry(
                    archive,
                    state_info,
                    maximum=int(applied["max_entry_bytes"]),
                )
                if not isinstance(parsed_state, dict):
                    errors.append("challenge/state.json is not an object")
                    state = {}
                else:
                    state = parsed_state

            if state:
                if manifest_value.get("challenge_id") != state.get("challenge_id"):
                    errors.append("manifest challenge_id does not match state")
                if manifest_value.get("challenge_state") != state.get("state"):
                    errors.append("manifest challenge_state does not match state")
                if manifest_value.get("packet_hash") != state.get("packet_hash"):
                    errors.append("manifest packet_hash does not match state")
                if manifest_value.get("rubric_hash") != state.get("rubric_hash"):
                    errors.append("manifest rubric_hash does not match state")
                if manifest_value.get("event_head") != state.get("event_head"):
                    errors.append("manifest event_head does not match state")
                if manifest_value.get("event_sequence") != state.get("event_sequence"):
                    errors.append("manifest event_sequence does not match state")
                if manifest_value.get("snapshot_updated_at") not in {
                    None,
                    state.get("updated_at"),
                }:
                    errors.append("manifest snapshot_updated_at does not match state")
                if packet_hash(state.get("packet", {})) != state.get("packet_hash"):
                    errors.append("state packet hash mismatch")
                if rubric_hash(state.get("packet", {})) != state.get("rubric_hash"):
                    errors.append("state rubric hash mismatch")
                current_semantic_hash = semantic_state_hash(state)
                if manifest_value.get("semantic_state_hash") not in {
                    None,
                    current_semantic_hash,
                }:
                    errors.append("manifest semantic_state_hash does not match state")
            else:
                current_semantic_hash = None

            event_infos = [
                info
                for name, info in info_by_name.items()
                if name.startswith("challenge/events/") and name.endswith(".json")
            ]
            # ZIP member order is transport metadata, not Arena evidence. Always
            # parse and verify canonical event files in filename order so a valid
            # bundle remains valid after a harmless ZIP repack/reordering.
            sorted_event_infos = sorted(event_infos, key=lambda item: item.filename)
            events: list[dict[str, Any]] = []
            for info in sorted_event_infos:
                value = _parse_json_entry(
                    archive,
                    info,
                    maximum=int(applied["max_metadata_json_bytes"]),
                )
                if not isinstance(value, dict):
                    errors.append(f"event file is not an object: {info.filename}")
                    continue
                events.append(value)

            previous: str | None = None
            for expected_sequence, event in enumerate(events, start=1):
                prefix = f"event {expected_sequence}"
                event_hash_value = event.get("event_hash")
                expected_name = (
                    f"challenge/events/{expected_sequence:08d}-{event_hash_value}.json"
                )
                actual_name = sorted_event_infos[expected_sequence - 1].filename
                if actual_name != expected_name:
                    errors.append(f"{prefix}: canonical event filename mismatch")
                if event.get("sequence") != expected_sequence:
                    errors.append(f"{prefix}: sequence mismatch")
                if state and event.get("challenge_id") != state.get("challenge_id"):
                    errors.append(f"{prefix}: challenge_id mismatch")
                if event.get("previous_event_hash") != previous:
                    errors.append(f"{prefix}: previous_event_hash mismatch")
                core = {key: value for key, value in event.items() if key != "event_hash"}
                if event.get("event_hash") != sha256_json(core):
                    errors.append(f"{prefix}: event_hash mismatch")
                if event.get("payload_hash") != sha256_json(event.get("payload", {})):
                    errors.append(f"{prefix}: payload_hash mismatch")
                previous = event.get("event_hash")

            if state:
                if state.get("event_sequence") != len(events):
                    errors.append("state event_sequence does not match event count")
                if state.get("event_head") != previous:
                    errors.append("state event_head does not match final event")
                if events and events[-1].get("state_hash_after") != current_semantic_hash:
                    errors.append("final event state_hash_after does not match state")

            jsonl_info = info_by_name.get("challenge/events.jsonl")
            if jsonl_info is None:
                errors.append("challenge/events.jsonl is missing")
            else:
                raw_jsonl = _read_bounded(
                    archive,
                    jsonl_info,
                    maximum=int(applied["max_entry_bytes"]),
                )
                projection: list[dict[str, Any]] = []
                for line_number, line in enumerate(raw_jsonl.splitlines(), start=1):
                    if not line.strip():
                        continue
                    try:
                        value = strict_json_loads(line)
                    except Exception as exc:
                        errors.append(
                            f"events.jsonl line {line_number} is invalid: {type(exc).__name__}: {exc}"
                        )
                        continue
                    if not isinstance(value, dict):
                        errors.append(f"events.jsonl line {line_number} is not an object")
                        continue
                    projection.append(value)
                if projection != events:
                    errors.append("events.jsonl projection differs from canonical event files")

            if integrity_value:
                if manifest_value.get("integrity_valid") != bool(
                    integrity_value.get("valid", False)
                ):
                    errors.append("manifest integrity_valid does not match integrity report")
                if integrity_value.get("snapshot_event_head") not in {
                    None,
                    state.get("event_head") if state else None,
                }:
                    errors.append("integrity snapshot event head does not match state")
                if integrity_value.get("snapshot_event_sequence") not in {
                    None,
                    state.get("event_sequence") if state else None,
                }:
                    errors.append("integrity snapshot event sequence does not match state")
                if not integrity_value.get("valid", False):
                    warnings.append(
                        "originating workspace integrity report was invalid when exported"
                    )

            report.update(
                {
                    "challenge_id": manifest_value.get("challenge_id"),
                    "challenge_state": manifest_value.get("challenge_state"),
                    "arena_version": manifest_value.get("arena_version"),
                    "bundle_manifest_hash": manifest_value.get(
                        "bundle_manifest_hash"
                    ),
                    "integrity_report_sha256": sha256_bytes(integrity_bytes),
                    "challenge_tree_hash": verified_tree_hash,
                    "verified_challenge_file_count": len(verified_entries),
                    "event_count": len(events),
                    "event_head": previous,
                    "semantic_state_hash": current_semantic_hash,
                    "origin_integrity_valid": integrity_value.get("valid"),
                }
            )
    except (zipfile.BadZipFile, OSError, ValueError) as exc:
        errors.append(f"bundle could not be verified: {type(exc).__name__}: {exc}")

    report["errors"] = sorted(set(errors))
    report["warnings"] = sorted(set(warnings))
    report["valid"] = not report["errors"]
    return report
