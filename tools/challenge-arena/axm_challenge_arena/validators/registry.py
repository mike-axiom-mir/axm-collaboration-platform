from __future__ import annotations

import fnmatch
import hashlib
import math
import mimetypes
import os
import re
import signal
import shutil
import struct
import subprocess
import sys
import tempfile
import threading
import time
import wave
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from ..utils import (
    directory_manifest,
    ensure_unique_portable_paths,
    portable_path_key,
    read_json,
    safe_relative_path,
    sha256_file,
    strict_json_loads,
    utc_now,
)

CheckFunction = Callable[["CheckContext"], dict[str, Any]]


@dataclass
class CheckContext:
    check: dict[str, Any]
    submission_dir: Path
    manifest: dict[str, Any]
    allow_execution: bool = False
    runtime: dict[str, Any] | None = None

    @property
    def config(self) -> dict[str, Any]:
        return self.check.get("config", {})

    @property
    def runtime_evidence(self) -> dict[str, Any]:
        return self.runtime or {}

    def targets(self) -> list[Path]:
        """Resolve targets only through paths declared in the submission manifest."""
        artifacts = self.manifest.get("artifacts", [])
        selected: list[Path] = []
        exact_path = self.config.get("path")
        glob_pattern = self.config.get("glob")
        deliverable_id = self.config.get("deliverable_id")
        role = self.config.get("role")

        for artifact in artifacts:
            rel = artifact.get("path", "")
            if not isinstance(rel, str):
                continue
            try:
                safe = safe_relative_path(rel)
            except ValueError:
                continue
            if exact_path and safe.as_posix() != str(exact_path).replace("\\", "/"):
                continue
            if glob_pattern and not fnmatch.fnmatch(safe.as_posix(), str(glob_pattern)):
                continue
            if deliverable_id and artifact.get("deliverable_id") != deliverable_id:
                continue
            if role and artifact.get("role") != role:
                continue
            selected.append(self.submission_dir / "artifacts" / safe)
        return selected


class ValidatorRegistry:
    def __init__(self) -> None:
        self._checks: dict[str, CheckFunction] = {}

    def register(self, kind: str, function: CheckFunction) -> None:
        key = kind.strip().lower()
        if not key:
            raise ValueError("Validator kind may not be empty.")
        self._checks[key] = function

    def kinds(self) -> list[str]:
        return sorted(self._checks)

    def run(
        self,
        check: dict[str, Any],
        submission_dir: Path,
        manifest: dict[str, Any],
        *,
        allow_execution: bool = False,
        runtime: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        started = utc_now()
        kind = str(check.get("kind", "")).strip().lower()
        base = {
            "check_id": check.get("id"),
            "kind": kind,
            "criterion_id": check.get("criterion_id"),
            "weight": float(check.get("weight", 1.0)),
            "required": bool(check.get("required", True)),
            "started_at": started,
        }
        function = self._checks.get(kind)
        if function is None:
            return {
                **base,
                "status": "SKIP",
                "score": None,
                "summary": f"No validator is registered for kind {kind!r}.",
                "evidence": {"registered_kinds": self.kinds()},
                "finished_at": utc_now(),
            }
        try:
            result = function(
                CheckContext(check, submission_dir, manifest, allow_execution, runtime or {})
            )
            return {**base, **result, "finished_at": utc_now()}
        except Exception as exc:  # Keep one broken validator from killing the whole tournament.
            return {
                **base,
                "status": "ERROR",
                "score": 0,
                "summary": f"Validator error: {type(exc).__name__}: {exc}",
                "evidence": {},
                "finished_at": utc_now(),
            }


def _result(passed: bool, summary: str, evidence: dict[str, Any], score: float | None = None) -> dict[str, Any]:
    return {
        "status": "PASS" if passed else "FAIL",
        "score": (100.0 if passed else 0.0) if score is None else float(score),
        "summary": summary,
        "evidence": evidence,
    }


def _skip(summary: str, evidence: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"status": "SKIP", "score": None, "summary": summary, "evidence": evidence or {}}


def _no_targets(context: CheckContext, summary: str) -> dict[str, Any]:
    if context.check.get("required", True):
        return _result(False, summary, {"selector": context.config})
    return _skip(summary, {"selector": context.config})


def _declared_artifact_map(context: CheckContext) -> dict[str, dict[str, Any]]:
    return {str(item.get("path", "")).replace("\\", "/"): item for item in context.manifest.get("artifacts", [])}


def check_artifact_exists(context: CheckContext) -> dict[str, Any]:
    targets = context.targets()
    if not targets:
        return _result(False, "No declared artifacts matched the selector.", {"selector": context.config})
    missing = [path.relative_to(context.submission_dir).as_posix() for path in targets if not path.is_file()]
    return _result(not missing, "All selected artifacts exist." if not missing else "Some artifacts are missing.", {
        "selected": [path.relative_to(context.submission_dir).as_posix() for path in targets],
        "missing": missing,
    })


def check_file_count(context: CheckContext) -> dict[str, Any]:
    targets = [path for path in context.targets() if path.is_file()]
    count = len(targets)
    minimum = int(context.config.get("min", 0))
    maximum = int(context.config.get("max", 2**31 - 1))
    passed = minimum <= count <= maximum
    return _result(passed, f"Matched {count} declared artifact(s); expected {minimum}..{maximum}.", {
        "count": count,
        "minimum": minimum,
        "maximum": maximum,
    })


def check_extension(context: CheckContext) -> dict[str, Any]:
    targets = context.targets()
    allowed = {str(ext).lower().lstrip(".") for ext in context.config.get("allowed", [])}
    if not targets:
        return _no_targets(context, "No declared artifacts matched the extension selector.")
    bad = [path.name for path in targets if path.suffix.lower().lstrip(".") not in allowed]
    return _result(not bad, "All selected files use an allowed extension." if not bad else "Disallowed extensions found.", {
        "allowed": sorted(allowed),
        "rejected": bad,
    })


def check_size_range(context: CheckContext) -> dict[str, Any]:
    targets = [path for path in context.targets() if path.is_file()]
    minimum = int(context.config.get("min_bytes", 0))
    maximum = int(context.config.get("max_bytes", 2**63 - 1))
    if not targets:
        return _no_targets(context, "No declared artifacts matched the size selector.")
    details = []
    passed = True
    for path in targets:
        size = path.stat().st_size
        okay = minimum <= size <= maximum
        passed = passed and okay
        details.append({"path": path.name, "bytes": size, "passed": okay})
    return _result(passed, "Selected file sizes are within range." if passed else "One or more file sizes are outside range.", {
        "minimum": minimum,
        "maximum": maximum,
        "files": details,
    })


def check_sha256(context: CheckContext) -> dict[str, Any]:
    expected = context.config.get("expected", {})
    if not isinstance(expected, dict) or not expected:
        return _skip("No expected hashes were configured.")
    details = []
    passed = True
    for rel, wanted in sorted(expected.items()):
        try:
            safe = safe_relative_path(rel)
        except ValueError as exc:
            details.append({"path": rel, "passed": False, "error": str(exc)})
            passed = False
            continue
        path = context.submission_dir / "artifacts" / safe
        actual = sha256_file(path) if path.is_file() else None
        okay = actual == wanted
        passed = passed and okay
        details.append({"path": rel, "expected": wanted, "actual": actual, "passed": okay})
    return _result(passed, "Hashes match." if passed else "Hash mismatch or missing file.", {"files": details})


def _read_text_targets(context: CheckContext) -> tuple[list[tuple[Path, str]], list[dict[str, str]]]:
    max_bytes = int(context.config.get("max_read_bytes", 2_000_000))
    decoded: list[tuple[Path, str]] = []
    failures: list[dict[str, str]] = []
    for path in context.targets():
        if not path.is_file():
            failures.append({"path": path.name, "error": "missing"})
            continue
        if path.stat().st_size > max_bytes:
            failures.append({"path": path.name, "error": f"above max_read_bytes ({max_bytes})"})
            continue
        try:
            decoded.append((path, path.read_text(encoding="utf-8")))
        except UnicodeDecodeError:
            failures.append({"path": path.name, "error": "not UTF-8 text"})
    return decoded, failures


def check_text_contains(context: CheckContext) -> dict[str, Any]:
    needles = [str(item) for item in context.config.get("needles", [])]
    case_sensitive = bool(context.config.get("case_sensitive", False))
    mode = str(context.config.get("mode", "all")).lower()
    decoded, failures = _read_text_targets(context)
    if not needles:
        return _skip("No text needles were configured.")
    if not decoded:
        return _no_targets(context, "No searchable UTF-8 text artifacts matched the selector.")
    corpus = "\n".join(text for _, text in decoded)
    haystack = corpus if case_sensitive else corpus.lower()
    matches = {}
    for needle in needles:
        query = needle if case_sensitive else needle.lower()
        matches[needle] = query in haystack
    passed = all(matches.values()) if mode == "all" else any(matches.values())
    return _result(passed, f"Text containment mode={mode}: {'passed' if passed else 'failed'}.", {
        "matches": matches,
        "files": [path.name for path, _ in decoded],
        "read_failures": failures,
    })


def check_text_not_contains(context: CheckContext) -> dict[str, Any]:
    needles = [str(item) for item in context.config.get("needles", [])]
    case_sensitive = bool(context.config.get("case_sensitive", False))
    decoded, failures = _read_text_targets(context)
    if not decoded:
        return _no_targets(context, "No searchable UTF-8 text artifacts matched the selector.")
    corpus = "\n".join(text for _, text in decoded)
    haystack = corpus if case_sensitive else corpus.lower()
    found = []
    for needle in needles:
        query = needle if case_sensitive else needle.lower()
        if query in haystack:
            found.append(needle)
    return _result(not found, "Forbidden text was not found." if not found else "Forbidden text was found.", {
        "forbidden_found": found,
        "read_failures": failures,
    })


def check_regex(context: CheckContext) -> dict[str, Any]:
    pattern = str(context.config.get("pattern", ""))
    if not pattern:
        return _skip("No regex pattern configured.")
    flags = re.MULTILINE
    if not context.config.get("case_sensitive", False):
        flags |= re.IGNORECASE
    decoded, failures = _read_text_targets(context)
    if not decoded:
        return _no_targets(context, "No searchable UTF-8 text artifacts matched the regex selector.")
    hits = []
    for path, text in decoded:
        match = re.search(pattern, text, flags)
        if match:
            hits.append({"path": path.name, "match": match.group(0)[:200]})
    require_match = bool(context.config.get("require_match", True))
    passed = bool(hits) if require_match else not hits
    return _result(passed, "Regex expectation passed." if passed else "Regex expectation failed.", {
        "pattern": pattern,
        "hits": hits,
        "read_failures": failures,
    })


def check_json_valid(context: CheckContext) -> dict[str, Any]:
    details = []
    passed = True
    targets = context.targets()
    if not targets:
        return _no_targets(context, "No declared JSON artifacts matched the selector.")
    for path in targets:
        try:
            read_json(path, max_bytes=int(context.config.get("max_json_bytes", 16 * 1024 * 1024)))
            details.append({"path": path.name, "passed": True})
        except Exception as exc:
            details.append({"path": path.name, "passed": False, "error": str(exc)})
            passed = False
    return _result(passed, "JSON is valid." if passed else "Invalid JSON found.", {"files": details})


def _json_lookup(value: Any, dotted: str) -> tuple[bool, Any]:
    current = value
    for part in dotted.split("."):
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return False, None
    return True, current


def check_json_keys(context: CheckContext) -> dict[str, Any]:
    required = [str(item) for item in context.config.get("required", [])]
    targets = context.targets()
    if not targets:
        return _no_targets(context, "No declared JSON artifacts matched the key selector.")
    details = []
    passed = True
    for path in targets:
        try:
            value = read_json(path, max_bytes=int(context.config.get("max_json_bytes", 16 * 1024 * 1024)))
            missing = [key for key in required if not _json_lookup(value, key)[0]]
            okay = not missing
            details.append({"path": path.name, "missing": missing, "passed": okay})
            passed = passed and okay
        except Exception as exc:
            details.append({"path": path.name, "passed": False, "error": str(exc)})
            passed = False
    return _result(passed and bool(details), "Required JSON keys exist." if passed else "Required JSON keys are missing.", {
        "required": required,
        "files": details,
    })


def check_zip_integrity(context: CheckContext) -> dict[str, Any]:
    """Validate ZIP structure without blindly expanding archive bombs.

    Limits are locked in the check config and evaluated from central-directory metadata
    before CRC decompression is attempted. This is evidence, not a safe extraction sandbox.
    """

    targets = context.targets()
    if not targets:
        return _no_targets(context, "No declared ZIP artifacts matched the selector.")

    max_members = int(context.config.get("max_members", 10_000))
    max_total = int(context.config.get("max_total_uncompressed_bytes", 2 * 1024**3))
    max_member = int(context.config.get("max_member_uncompressed_bytes", 512 * 1024**2))
    max_ratio = float(context.config.get("max_compression_ratio", 200.0))
    max_path_length = int(context.config.get("max_path_length", 512))
    allow_encrypted = bool(context.config.get("allow_encrypted", False))
    reject_symlinks = bool(context.config.get("reject_symlinks", True))
    if max_members < 1 or max_total < 1 or max_member < 1 or max_ratio < 1 or max_path_length < 1:
        return _result(False, "ZIP safety limits must be positive.", {"config": context.config})

    details = []
    passed = True
    for path in targets:
        try:
            with zipfile.ZipFile(path, "r") as archive:
                members = archive.infolist()
                unsafe_paths: list[str] = []
                overlong_paths: list[str] = []
                duplicate_paths: list[str] = []
                portable_collision_paths: list[dict[str, str]] = []
                normalized_paths: set[str] = set()
                portable_paths: dict[str, str] = {}
                encrypted: list[str] = []
                symlinks: list[str] = []
                oversized_members: list[dict[str, Any]] = []
                high_ratios: list[dict[str, Any]] = []
                total_uncompressed = 0
                total_compressed = 0

                for member in members:
                    name = member.filename.replace("\\", "/")
                    normalized_name = name.rstrip("/")
                    if len(normalized_name) > max_path_length:
                        overlong_paths.append(member.filename)
                    if normalized_name in normalized_paths:
                        duplicate_paths.append(member.filename)
                    normalized_paths.add(normalized_name)
                    portable_key = portable_path_key(normalized_name)
                    previous_portable = portable_paths.get(portable_key)
                    if (
                        previous_portable is not None
                        and previous_portable != normalized_name
                    ):
                        portable_collision_paths.append(
                            {
                                "first": previous_portable,
                                "second": normalized_name,
                            }
                        )
                    else:
                        portable_paths[portable_key] = normalized_name
                    try:
                        safe_relative_path(normalized_name)
                    except ValueError:
                        unsafe_paths.append(member.filename)
                    if "\x00" in name:
                        unsafe_paths.append(member.filename)
                    if member.flag_bits & 0x1:
                        encrypted.append(member.filename)
                    unix_type = (member.external_attr >> 16) & 0o170000
                    if unix_type == 0o120000:
                        symlinks.append(member.filename)
                    total_uncompressed += int(member.file_size)
                    total_compressed += int(member.compress_size)
                    if member.file_size > max_member:
                        oversized_members.append(
                            {"path": member.filename, "bytes": member.file_size}
                        )
                    ratio = (
                        float("inf")
                        if member.file_size and member.compress_size == 0
                        else member.file_size / max(1, member.compress_size)
                    )
                    if ratio > max_ratio:
                        high_ratios.append(
                            {
                                "path": member.filename,
                                "ratio": None if ratio == float("inf") else round(ratio, 6),
                                "uncompressed_bytes": member.file_size,
                                "compressed_bytes": member.compress_size,
                            }
                        )

                metadata_safe = (
                    len(members) <= max_members
                    and total_uncompressed <= max_total
                    and not unsafe_paths
                    and not overlong_paths
                    and not duplicate_paths
                    and not portable_collision_paths
                    and not oversized_members
                    and not high_ratios
                    and (allow_encrypted or not encrypted)
                    and (not reject_symlinks or not symlinks)
                )
                bad_member = archive.testzip() if metadata_safe else None
                okay = metadata_safe and bad_member is None
                details.append(
                    {
                        "path": path.name,
                        "passed": okay,
                        "bad_member": bad_member,
                        "member_count": len(members),
                        "total_uncompressed_bytes": total_uncompressed,
                        "total_compressed_bytes": total_compressed,
                        "unsafe_paths": sorted(set(unsafe_paths)),
                        "overlong_paths": sorted(set(overlong_paths)),
                        "duplicate_paths": sorted(set(duplicate_paths)),
                        "portable_collision_paths": portable_collision_paths,
                        "encrypted_members": encrypted,
                        "symlink_members": symlinks,
                        "oversized_members": oversized_members,
                        "high_compression_ratio_members": high_ratios,
                        "limits": {
                            "max_members": max_members,
                            "max_total_uncompressed_bytes": max_total,
                            "max_member_uncompressed_bytes": max_member,
                            "max_compression_ratio": max_ratio,
                            "max_path_length": max_path_length,
                            "allow_encrypted": allow_encrypted,
                            "reject_symlinks": reject_symlinks,
                        },
                        "crc_test_run": metadata_safe,
                    }
                )
                passed = passed and okay
        except Exception as exc:
            details.append({"path": path.name, "passed": False, "error": str(exc)})
            passed = False
    return _result(
        passed and bool(details),
        "ZIP integrity and bounded archive safety passed."
        if passed
        else "ZIP integrity or bounded archive safety failed.",
        {
            "archives": details,
            "boundary_note": "Passing this check does not make extraction safe; extract only inside a separately constrained sandbox.",
        },
    )


def _png_info(path: Path) -> dict[str, Any]:
    with path.open("rb") as handle:
        header = handle.read(33)
    if len(header) < 33 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise ValueError("Not a valid PNG header")
    width, height, bit_depth, color_type = struct.unpack(">IIBB", header[16:26])
    return {
        "format": "png",
        "width": width,
        "height": height,
        "bit_depth": bit_depth,
        "color_type": color_type,
        "has_alpha": color_type in {4, 6},
    }


def _jpeg_info(path: Path) -> dict[str, Any]:
    with path.open("rb") as handle:
        if handle.read(2) != b"\xff\xd8":
            raise ValueError("Not a JPEG")
        while True:
            byte = handle.read(1)
            if not byte:
                break
            if byte != b"\xff":
                continue
            marker = handle.read(1)
            while marker == b"\xff":
                marker = handle.read(1)
            if marker in {bytes([m]) for m in range(0xC0, 0xC4)} | {bytes([m]) for m in range(0xC5, 0xC8)} | {bytes([m]) for m in range(0xC9, 0xCC)} | {bytes([m]) for m in range(0xCD, 0xD0)}:
                length = struct.unpack(">H", handle.read(2))[0]
                precision = handle.read(1)[0]
                height, width = struct.unpack(">HH", handle.read(4))
                return {"format": "jpeg", "width": width, "height": height, "precision": precision, "has_alpha": False}
            if marker in {b"\xd8", b"\xd9"}:
                continue
            length_bytes = handle.read(2)
            if len(length_bytes) != 2:
                break
            length = struct.unpack(">H", length_bytes)[0]
            handle.seek(max(0, length - 2), 1)
    raise ValueError("JPEG dimensions not found")


def _image_info(path: Path) -> dict[str, Any]:
    suffix = path.suffix.lower()
    if suffix == ".png":
        return _png_info(path)
    if suffix in {".jpg", ".jpeg"}:
        return _jpeg_info(path)
    raise ValueError(f"Built-in parser supports PNG and JPEG only, got {suffix or 'no extension'}")


def check_image_dimensions(context: CheckContext) -> dict[str, Any]:
    min_width = int(context.config.get("min_width", 1))
    min_height = int(context.config.get("min_height", 1))
    max_width = int(context.config.get("max_width", 1_000_000))
    max_height = int(context.config.get("max_height", 1_000_000))
    exact_width = context.config.get("width")
    exact_height = context.config.get("height")
    targets = context.targets()
    if not targets:
        return _no_targets(context, "No declared image artifacts matched the dimension selector.")
    details = []
    passed = True
    for path in targets:
        try:
            info = _image_info(path)
            okay = min_width <= info["width"] <= max_width and min_height <= info["height"] <= max_height
            if exact_width is not None:
                okay = okay and info["width"] == int(exact_width)
            if exact_height is not None:
                okay = okay and info["height"] == int(exact_height)
            details.append({"path": path.name, **info, "passed": okay})
            passed = passed and okay
        except Exception as exc:
            details.append({"path": path.name, "passed": False, "error": str(exc)})
            passed = False
    return _result(passed and bool(details), "Image dimensions passed." if passed else "Image dimensions failed.", {
        "requirements": {
            "min_width": min_width,
            "min_height": min_height,
            "max_width": max_width,
            "max_height": max_height,
            "width": exact_width,
            "height": exact_height,
        },
        "files": details,
    })


def check_png_alpha(context: CheckContext) -> dict[str, Any]:
    required = bool(context.config.get("required", True))
    targets = context.targets()
    if not targets:
        return _no_targets(context, "No declared PNG artifacts matched the alpha selector.")
    details = []
    passed = True
    for path in targets:
        try:
            info = _png_info(path)
            okay = bool(info["has_alpha"]) == required
            details.append({"path": path.name, "has_alpha_channel": info["has_alpha"], "passed": okay})
            passed = passed and okay
        except Exception as exc:
            details.append({"path": path.name, "passed": False, "error": str(exc)})
            passed = False
    return _result(passed and bool(details), "PNG alpha-channel expectation passed." if passed else "PNG alpha-channel expectation failed.", {
        "required": required,
        "files": details,
        "note": "This checks whether the PNG format has an alpha channel, not whether any pixel is visibly transparent.",
    })


def check_wav_duration(context: CheckContext) -> dict[str, Any]:
    minimum = float(context.config.get("min_seconds", 0.0))
    maximum = float(context.config.get("max_seconds", 10**9))
    targets = context.targets()
    if not targets:
        return _no_targets(context, "No declared WAV artifacts matched the duration selector.")
    details = []
    passed = True
    for path in targets:
        try:
            with wave.open(str(path), "rb") as audio:
                duration = audio.getnframes() / float(audio.getframerate())
                info = {
                    "channels": audio.getnchannels(),
                    "sample_rate": audio.getframerate(),
                    "sample_width": audio.getsampwidth(),
                    "duration_seconds": round(duration, 6),
                }
            okay = minimum <= duration <= maximum
            details.append({"path": path.name, **info, "passed": okay})
            passed = passed and okay
        except Exception as exc:
            details.append({"path": path.name, "passed": False, "error": str(exc)})
            passed = False
    return _result(passed and bool(details), "WAV duration passed." if passed else "WAV duration failed.", {
        "minimum": minimum,
        "maximum": maximum,
        "files": details,
    })


def check_ffprobe_media(context: CheckContext) -> dict[str, Any]:
    executable = shutil.which(str(context.config.get("executable", "ffprobe")))
    if not executable:
        return _skip("ffprobe is not installed or not on PATH.")
    targets = context.targets()
    if not targets:
        return _no_targets(context, "No declared media artifacts matched the ffprobe selector.")
    details = []
    passed = True
    min_duration = float(context.config.get("min_seconds", 0.0))
    max_duration = float(context.config.get("max_seconds", 10**9))
    width = context.config.get("width")
    height = context.config.get("height")
    for path in targets:
        proc = _run_command(
            [
                executable,
                "-v",
                "error",
                "-show_streams",
                "-show_format",
                "-of",
                "json",
                str(path),
            ],
            path.parent,
            float(context.config.get("timeout_seconds", 20)),
            _execution_env(path.parent),
            max_output_bytes=int(
                context.config.get("max_probe_output_bytes", 2 * 1024 * 1024)
            ),
        )
        if (
            proc["returncode"] != 0
            or proc["timed_out"]
            or proc["output_limit_exceeded"]
            or proc["capture_errors"]
        ):
            details.append(
                {
                    "path": path.name,
                    "passed": False,
                    "error": proc["stderr_tail"][-500:],
                    "timed_out": proc["timed_out"],
                    "output_limit_exceeded": proc["output_limit_exceeded"],
                    "capture_errors": proc["capture_errors"],
                }
            )
            passed = False
            continue
        info = strict_json_loads(proc["stdout_text"])
        duration = float(info.get("format", {}).get("duration", 0.0) or 0.0)
        video_streams = [stream for stream in info.get("streams", []) if stream.get("codec_type") == "video"]
        okay = min_duration <= duration <= max_duration
        if width is not None:
            okay = okay and bool(video_streams) and int(video_streams[0].get("width", -1)) == int(width)
        if height is not None:
            okay = okay and bool(video_streams) and int(video_streams[0].get("height", -1)) == int(height)
        details.append({
            "path": path.name,
            "passed": okay,
            "duration_seconds": duration,
            "video": video_streams[:1],
            "format_name": info.get("format", {}).get("format_name"),
        })
        passed = passed and okay
    return _result(passed and bool(details), "Media probe passed." if passed else "Media probe failed.", {
        "requirements": {"min_seconds": min_duration, "max_seconds": max_duration, "width": width, "height": height},
        "files": details,
    })


def check_provenance_present(context: CheckContext) -> dict[str, Any]:
    required_keys = [str(item) for item in context.config.get("required_keys", ["origin", "rights"])]
    artifact_map = _declared_artifact_map(context)
    selected_paths = {path.relative_to(context.submission_dir / "artifacts").as_posix() for path in context.targets()}
    details = []
    passed = bool(selected_paths)
    for rel in sorted(selected_paths):
        provenance = artifact_map.get(rel, {}).get("provenance", {})
        missing = [key for key in required_keys if not provenance.get(key)]
        okay = not missing
        details.append({"path": rel, "missing": missing, "passed": okay})
        passed = passed and okay
    return _result(passed, "Provenance fields are present." if passed else "Provenance fields are missing.", {
        "required_keys": required_keys,
        "artifacts": details,
    })


def check_manifest_deliverables(context: CheckContext) -> dict[str, Any]:
    required = [str(item) for item in context.config.get("required_deliverable_ids", [])]
    present = {item.get("deliverable_id") for item in context.manifest.get("artifacts", [])}
    missing = [item for item in required if item not in present]
    return _result(not missing, "All required deliverables are represented." if not missing else "Required deliverables are missing.", {
        "required": required,
        "present": sorted(item for item in present if item),
        "missing": missing,
    })


def check_no_external_urls(context: CheckContext) -> dict[str, Any]:
    decoded, failures = _read_text_targets(context)
    if not decoded:
        return _no_targets(context, "No searchable UTF-8 text artifacts matched the URL selector.")
    pattern = re.compile(r"(?:https?|wss?)://[^\s\"'<>]+", re.IGNORECASE)
    allowed_hosts = {str(host).lower() for host in context.config.get("allowed_hosts", [])}
    hits = []
    for path, text in decoded:
        for match in pattern.findall(text):
            host_match = re.match(r"^[a-z]+://([^/:?#]+)", match, re.IGNORECASE)
            host = host_match.group(1).lower() if host_match else ""
            if host not in allowed_hosts:
                hits.append({"path": path.name, "url": match[:300], "host": host})
    return _result(not hits, "No unapproved external URLs found." if not hits else "Unapproved external URLs found.", {
        "allowed_hosts": sorted(allowed_hosts),
        "hits": hits,
        "read_failures": failures,
    })


def _execution_env(root: Path, extra: dict[str, Any] | None = None) -> dict[str, str]:
    env = {
        "PATH": os.environ.get("PATH", ""),
        "PYTHONPATH": str(root),
        "AXM_CHALLENGE_ARENA": "1",
        "PYTHONDONTWRITEBYTECODE": "1",
        "LANG": os.environ.get("LANG", "C.UTF-8"),
    }
    for key, value in (extra or {}).items():
        if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", str(key)):
            env[str(key)] = str(value)
    return env


def _validate_command_limits(
    argv: list[str], timeout: float, max_output_bytes: int
) -> str | None:
    if len(argv) > 128:
        return "command.argv may contain at most 128 arguments."
    if any(len(item.encode("utf-8")) > 4096 for item in argv):
        return "Each command argument may contain at most 4096 UTF-8 bytes."
    if sum(len(item.encode("utf-8")) for item in argv) > 32 * 1024:
        return "Combined command arguments may contain at most 32768 UTF-8 bytes."
    if not math.isfinite(timeout) or not 0.1 <= timeout <= 3600:
        return "timeout_seconds must be finite and in 0.1..3600."
    if not 1024 <= max_output_bytes <= 256 * 1024 * 1024:
        return "max_output_bytes must be in 1024..268435456."
    return None


def _terminate_process_group(proc: subprocess.Popen[Any]) -> None:
    """Best-effort process-tree cleanup; this remains containment, not a sandbox."""

    if proc.poll() is not None and os.name == "nt":
        return
    try:
        if os.name == "nt":
            proc.terminate()
        else:
            os.killpg(proc.pid, signal.SIGTERM)
    except (ProcessLookupError, PermissionError, OSError):
        pass
    try:
        proc.wait(timeout=0.5)
    except subprocess.TimeoutExpired:
        try:
            if os.name == "nt":
                proc.kill()
            else:
                os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError, OSError):
            pass
        try:
            proc.wait(timeout=1.0)
        except subprocess.TimeoutExpired:
            pass


def _drain_command_pipe(
    pipe: Any,
    state: dict[str, Any],
    max_output_bytes: int,
    limit_event: threading.Event,
) -> None:
    """Drain one child pipe while retaining at most the declared byte window."""

    digest = hashlib.sha256()
    retained = bytearray()
    observed = 0
    error: str | None = None
    try:
        while True:
            chunk = pipe.read(64 * 1024)
            if not chunk:
                break
            observed += len(chunk)
            digest.update(chunk)
            remaining = max_output_bytes - len(retained)
            if remaining > 0:
                retained.extend(chunk[:remaining])
            if observed > max_output_bytes:
                limit_event.set()
    except (OSError, ValueError) as exc:
        error = f"{type(exc).__name__}: {exc}"
    finally:
        try:
            pipe.close()
        except (OSError, ValueError):
            pass
        state.update(
            {
                "retained": bytes(retained),
                "observed_bytes": observed,
                "sha256": digest.hexdigest(),
                "truncated": observed > max_output_bytes,
                "error": error,
            }
        )


def _run_command(
    argv: list[str],
    cwd: Path,
    timeout: float,
    env: dict[str, str],
    *,
    max_output_bytes: int = 4 * 1024 * 1024,
) -> dict[str, Any]:
    validation_error = _validate_command_limits(argv, timeout, max_output_bytes)
    if validation_error:
        raise ValueError(validation_error)
    if not cwd.is_dir():
        raise ValueError(f"Command working directory does not exist: {cwd}")
    if len(env) > 256 or any(
        len(str(key).encode("utf-8")) > 256
        or len(str(value).encode("utf-8")) > 16 * 1024
        for key, value in env.items()
    ):
        raise ValueError("Command environment exceeds bounded key/value limits.")

    timed_out = False
    output_limit_exceeded = False
    creationflags = 0
    popen_kwargs: dict[str, Any] = {}
    if os.name == "nt":
        creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    else:
        popen_kwargs["start_new_session"] = True

    proc = subprocess.Popen(
        argv,
        cwd=str(cwd),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        shell=False,
        creationflags=creationflags,
        **popen_kwargs,
    )
    assert proc.stdout is not None and proc.stderr is not None
    limit_event = threading.Event()
    stdout_state: dict[str, Any] = {}
    stderr_state: dict[str, Any] = {}
    readers = [
        threading.Thread(
            target=_drain_command_pipe,
            args=(proc.stdout, stdout_state, max_output_bytes, limit_event),
            name="axm-command-stdout",
            daemon=True,
        ),
        threading.Thread(
            target=_drain_command_pipe,
            args=(proc.stderr, stderr_state, max_output_bytes, limit_event),
            name="axm-command-stderr",
            daemon=True,
        ),
    ]
    for reader in readers:
        reader.start()

    deadline = time.monotonic() + timeout
    while proc.poll() is None:
        if limit_event.is_set():
            output_limit_exceeded = True
            _terminate_process_group(proc)
            break
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            timed_out = True
            _terminate_process_group(proc)
            break
        limit_event.wait(min(0.01, remaining))
    if proc.poll() is None:
        _terminate_process_group(proc)

    # A command can spawn descendants and exit immediately. On POSIX they remain
    # in the dedicated process group, so close that group best-effort before
    # waiting for pipe EOF. On Windows closing a lingering pipe is the fallback.
    if os.name != "nt":
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except (ProcessLookupError, PermissionError, OSError):
            pass

    for reader in readers:
        reader.join(timeout=2.0)
    for pipe, reader in ((proc.stdout, readers[0]), (proc.stderr, readers[1])):
        if reader.is_alive():
            try:
                pipe.close()
            except (OSError, ValueError):
                pass
            reader.join(timeout=0.5)

    empty_hash = hashlib.sha256(b"").hexdigest()
    for state in (stdout_state, stderr_state):
        state.setdefault("retained", b"")
        state.setdefault("observed_bytes", 0)
        state.setdefault("sha256", empty_hash)
        state.setdefault("truncated", False)
        if "error" not in state:
            state["error"] = "capture thread did not finish cleanly"

    output_limit_exceeded = bool(
        output_limit_exceeded
        or limit_event.is_set()
        or stdout_state["truncated"]
        or stderr_state["truncated"]
    )
    capture_errors = [
        value
        for value in (stdout_state.get("error"), stderr_state.get("error"))
        if value
    ]
    stdout_bytes = stdout_state["retained"]
    stderr_bytes = stderr_state["retained"]
    stdout_text = stdout_bytes.decode("utf-8", errors="replace")
    stderr_text = stderr_bytes.decode("utf-8", errors="replace")
    return {
        "returncode": proc.returncode,
        "timed_out": timed_out,
        "output_limit_exceeded": output_limit_exceeded,
        "capture_errors": capture_errors,
        "stdout_text": stdout_text,
        "stderr_text": stderr_text,
        "stdout_tail": stdout_text[-4000:],
        "stderr_tail": stderr_text[-4000:],
        "stdout_bytes": len(stdout_bytes),
        "stderr_bytes": len(stderr_bytes),
        "stdout_observed_bytes": int(stdout_state["observed_bytes"]),
        "stderr_observed_bytes": int(stderr_state["observed_bytes"]),
        "stdout_sha256": stdout_state["sha256"],
        "stderr_sha256": stderr_state["sha256"],
        "max_output_bytes": max_output_bytes,
        "process_tree_cleanup": "best_effort",
        "capture_mode": "bounded_pipe_streams",
    }


def _bounded_output_manifest(
    root: Path,
    patterns: list[str],
    *,
    max_files: int,
    max_total_bytes: int,
    max_single_bytes: int,
) -> list[dict[str, Any]]:
    selected: dict[str, Path] = {}
    candidates = (
        (path for pattern in patterns for path in root.glob(pattern))
        if patterns
        else root.rglob("*")
    )
    total = 0
    for path in candidates:
        if path.is_symlink():
            raise ValueError(
                f"Determinism output contains a symbolic link: {path.relative_to(root).as_posix()}"
            )
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        safe_relative_path(relative)
        selected.setdefault(relative, path)
        if len(selected) > max_files:
            raise ValueError(
                f"Determinism output exceeds max_output_files={max_files}."
            )
    ensure_unique_portable_paths(
        sorted(selected), field="determinism output path"
    )
    manifest: list[dict[str, Any]] = []
    for relative, path in sorted(selected.items()):
        size = path.stat().st_size
        if size > max_single_bytes:
            raise ValueError(
                f"Determinism output {relative!r} exceeds max_single_output_bytes={max_single_bytes}."
            )
        total += size
        if total > max_total_bytes:
            raise ValueError(
                f"Determinism outputs exceed max_output_total_bytes={max_total_bytes}."
            )
        manifest.append(
            {
                "path": relative,
                "bytes": size,
                "sha256": sha256_file(path),
            }
        )
    return manifest

def check_command(context: CheckContext) -> dict[str, Any]:
    if not context.allow_execution:
        return _skip(
            "Execution check is disabled. Enable it explicitly only inside an appropriate sandbox.",
            {"execution_gate": False, "security_note": "The Arena execution gate is not itself a security sandbox."},
        )
    argv = context.config.get("argv")
    if not isinstance(argv, list) or not argv or not all(isinstance(item, str) for item in argv):
        return _result(False, "command.argv must be a non-empty list of strings.", {})
    cwd_rel = str(context.config.get("cwd", "."))
    try:
        cwd = (
            context.submission_dir / "artifacts"
            if cwd_rel == "."
            else context.submission_dir / "artifacts" / safe_relative_path(cwd_rel)
        )
    except ValueError as exc:
        return _result(False, f"Invalid command working directory: {exc}", {})
    expected = int(context.config.get("expected_exit_code", 0))
    timeout = float(context.config.get("timeout_seconds", 60))
    max_output_bytes = int(
        context.config.get("max_output_bytes", 4 * 1024 * 1024)
    )
    try:
        proc = _run_command(
            argv,
            cwd,
            timeout,
            _execution_env(cwd, context.config.get("env")),
            max_output_bytes=max_output_bytes,
        )
    except (OSError, ValueError) as exc:
        return _result(False, f"Command could not start safely: {exc}", {"argv": argv})
    passed = (
        not proc["timed_out"]
        and not proc["output_limit_exceeded"]
        and not proc["capture_errors"]
        and proc["returncode"] == expected
    )
    if proc["timed_out"]:
        summary = f"Command timed out after {timeout} seconds."
    elif proc["output_limit_exceeded"]:
        summary = f"Command exceeded the bounded output limit of {max_output_bytes} bytes per stream."
    elif proc["capture_errors"]:
        summary = "Command output capture did not finish cleanly."
    else:
        summary = f"Command exited with {proc['returncode']}; expected {expected}."
    return _result(
        passed,
        summary,
        {
            "argv": argv,
            "cwd": cwd_rel,
            "returncode": proc["returncode"],
            "timed_out": proc["timed_out"],
            "output_limit_exceeded": proc["output_limit_exceeded"],
            "stdout_tail": proc["stdout_tail"],
            "stderr_tail": proc["stderr_tail"],
            "stdout_bytes": proc["stdout_bytes"],
            "stderr_bytes": proc["stderr_bytes"],
            "stdout_observed_bytes": proc["stdout_observed_bytes"],
            "stderr_observed_bytes": proc["stderr_observed_bytes"],
            "stdout_sha256": proc["stdout_sha256"],
            "stderr_sha256": proc["stderr_sha256"],
            "capture_errors": proc["capture_errors"],
            "capture_mode": proc["capture_mode"],
            "max_output_bytes": max_output_bytes,
            "process_tree_cleanup": proc["process_tree_cleanup"],
            "security_note": (
                "The Arena execution gate is not itself a security sandbox; "
                "bounded process controls only reduce accidents."
            ),
        },
    )

def check_python_compile(context: CheckContext) -> dict[str, Any]:
    config = dict(context.config)
    config.setdefault("argv", [sys.executable, "-m", "compileall", "-q", "."])
    nested = CheckContext({**context.check, "config": config}, context.submission_dir, context.manifest, context.allow_execution)
    return check_command(nested)


def check_deterministic_command(context: CheckContext) -> dict[str, Any]:
    if not context.allow_execution:
        return _skip(
            "Determinism replay is disabled until execution is explicitly enabled in a sandbox.",
            {"execution_gate": False, "security_note": "The Arena execution gate is not itself a security sandbox."},
        )
    argv = context.config.get("argv")
    if not isinstance(argv, list) or not argv or not all(isinstance(item, str) for item in argv):
        return _result(False, "deterministic_command.argv must be a non-empty list of strings.", {})
    timeout = float(context.config.get("timeout_seconds", 60))
    max_output_bytes = int(
        context.config.get("max_output_bytes", 4 * 1024 * 1024)
    )
    output_globs = [str(item) for item in context.config.get("output_globs", [])]
    max_output_files = int(context.config.get("max_output_files", 10_000))
    max_output_total_bytes = int(
        context.config.get("max_output_total_bytes", 2 * 1024**3)
    )
    max_single_output_bytes = int(
        context.config.get("max_single_output_bytes", 512 * 1024**2)
    )
    if (
        max_output_files < 1
        or max_output_total_bytes < 1
        or max_single_output_bytes < 1
        or max_single_output_bytes > max_output_total_bytes
    ):
        return _result(False, "Determinism output limits are invalid.", {})
    runs = []
    try:
        with tempfile.TemporaryDirectory(prefix="axm-arena-replay-") as temp_root:
            for index in (1, 2):
                run_root = Path(temp_root) / f"run-{index}"
                shutil.copytree(context.submission_dir / "artifacts", run_root)
                proc = _run_command(
                    argv,
                    run_root,
                    timeout,
                    _execution_env(run_root, context.config.get("env")),
                    max_output_bytes=max_output_bytes,
                )
                files = _bounded_output_manifest(
                    run_root,
                    output_globs,
                    max_files=max_output_files,
                    max_total_bytes=max_output_total_bytes,
                    max_single_bytes=max_single_output_bytes,
                )
                runs.append(
                    {
                        "returncode": proc["returncode"],
                        "timed_out": proc["timed_out"],
                        "output_limit_exceeded": proc["output_limit_exceeded"],
                        "stdout_sha256": proc["stdout_sha256"],
                        "stderr_sha256": proc["stderr_sha256"],
                        "stdout_bytes": proc["stdout_bytes"],
                        "stderr_bytes": proc["stderr_bytes"],
                        "stdout_observed_bytes": proc["stdout_observed_bytes"],
                        "stderr_observed_bytes": proc["stderr_observed_bytes"],
                        "capture_errors": proc["capture_errors"],
                        "capture_mode": proc["capture_mode"],
                        "stdout_tail": proc["stdout_tail"][-2000:],
                        "stderr_tail": proc["stderr_tail"][-2000:],
                        "files": files,
                    }
                )
    except (OSError, ValueError) as exc:
        return _result(False, f"Determinism replay could not complete safely: {exc}", {"argv": argv})

    normalized = [
        {
            "returncode": run["returncode"],
            "timed_out": run["timed_out"],
            "output_limit_exceeded": run["output_limit_exceeded"],
            "stdout_sha256": run["stdout_sha256"],
            "stderr_sha256": run["stderr_sha256"],
            "stdout_bytes": run["stdout_bytes"],
            "stderr_bytes": run["stderr_bytes"],
            "stdout_observed_bytes": run["stdout_observed_bytes"],
            "stderr_observed_bytes": run["stderr_observed_bytes"],
            "capture_errors": run["capture_errors"],
            "files": run["files"],
        }
        for run in runs
    ]
    expected = int(context.config.get("expected_exit_code", 0))
    passed = (
        normalized[0] == normalized[1]
        and runs[0]["returncode"] == expected
        and not runs[0]["timed_out"]
        and not runs[0]["output_limit_exceeded"]
        and not runs[0]["capture_errors"]
        and not runs[1]["capture_errors"]
    )
    return _result(
        passed,
        "Two isolated bounded replays matched exactly."
        if passed
        else "Replay outputs differed, exceeded limits, timed out, or the command failed.",
        {
            "argv": argv,
            "run_1": runs[0],
            "run_2": runs[1],
            "limits": {
                "max_output_bytes_per_stream": max_output_bytes,
                "max_output_files": max_output_files,
                "max_output_total_bytes": max_output_total_bytes,
                "max_single_output_bytes": max_single_output_bytes,
            },
            "security_note": "Bounded execution and process cleanup reduce accidents but do not create a security sandbox.",
        },
    )

def check_mime_guess(context: CheckContext) -> dict[str, Any]:
    allowed = {str(item).lower() for item in context.config.get("allowed", [])}
    targets = context.targets()
    if not targets:
        return _no_targets(context, "No declared artifacts matched the MIME selector.")
    details = []
    passed = True
    for path in targets:
        guessed, encoding = mimetypes.guess_type(path.name)
        okay = bool(guessed) and (not allowed or guessed.lower() in allowed)
        details.append({"path": path.name, "guessed": guessed, "encoding": encoding, "passed": okay})
        passed = passed and okay
    return _result(passed and bool(details), "MIME guesses passed." if passed else "MIME guess failed or was disallowed.", {
        "allowed": sorted(allowed),
        "files": details,
        "note": "This is extension-based identification, not deep content inspection.",
    })


def check_file_tree(context: CheckContext) -> dict[str, Any]:
    """Validate required/forbidden path patterns plus count and total-byte budgets."""

    artifacts = context.manifest.get("artifacts", [])
    declared = [str(item.get("path", "")).replace("\\", "/") for item in artifacts]
    required_patterns = [str(item) for item in context.config.get("required_globs", [])]
    forbidden_patterns = [str(item) for item in context.config.get("forbidden_globs", [])]
    minimum = int(context.config.get("min_files", 0))
    maximum = int(context.config.get("max_files", 2**31 - 1))
    max_total_bytes = int(context.config.get("max_total_bytes", 2**63 - 1))

    missing_patterns = [
        pattern
        for pattern in required_patterns
        if not any(fnmatch.fnmatch(path, pattern) for path in declared)
    ]
    forbidden_hits = [
        path
        for path in declared
        if any(fnmatch.fnmatch(path, pattern) for pattern in forbidden_patterns)
    ]
    total_bytes = sum(int(item.get("bytes", 0) or 0) for item in artifacts)
    passed = (
        not missing_patterns
        and not forbidden_hits
        and minimum <= len(declared) <= maximum
        and total_bytes <= max_total_bytes
    )
    return _result(
        passed,
        "Declared file tree passed." if passed else "Declared file tree failed its locked requirements.",
        {
            "file_count": len(declared),
            "minimum": minimum,
            "maximum": maximum,
            "total_bytes": total_bytes,
            "max_total_bytes": max_total_bytes,
            "required_globs": required_patterns,
            "missing_required_globs": missing_patterns,
            "forbidden_globs": forbidden_patterns,
            "forbidden_hits": forbidden_hits,
        },
    )


def check_text_line_count(context: CheckContext) -> dict[str, Any]:
    minimum = int(context.config.get("min_lines", 0))
    maximum = int(context.config.get("max_lines", 2**31 - 1))
    decoded, failures = _read_text_targets(context)
    if not decoded:
        return _no_targets(context, "No searchable UTF-8 text artifacts matched the line-count selector.")
    details = []
    passed = True
    for path, text in decoded:
        count = len(text.splitlines())
        okay = minimum <= count <= maximum
        passed = passed and okay
        details.append({"path": path.name, "line_count": count, "passed": okay})
    return _result(
        passed,
        "Text line counts passed." if passed else "One or more text line counts are outside range.",
        {
            "minimum": minimum,
            "maximum": maximum,
            "files": details,
            "read_failures": failures,
        },
    )


def _magic_media_type(path: Path) -> str | None:
    with path.open("rb") as handle:
        head = handle.read(32)
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if head.startswith(b"RIFF") and head[8:12] == b"WAVE":
        return "audio/wav"
    if head.startswith(b"PK\x03\x04") or head.startswith(b"PK\x05\x06"):
        return "application/zip"
    if head.startswith(b"%PDF-"):
        return "application/pdf"
    if len(head) >= 12 and head[4:8] == b"ftyp":
        return "video/mp4"
    if head.startswith(b"\x1aE\xdf\xa3"):
        return "video/webm"
    if head.startswith(b"RIFF") and head[8:12] == b"WEBP":
        return "image/webp"
    stripped = head.lstrip()
    if stripped.startswith(b"<svg") or stripped.startswith(b"<?xml"):
        return "image/svg+xml"
    if stripped.startswith((b"{", b"[")):
        return "application/json"
    return None


def check_magic_signature(context: CheckContext) -> dict[str, Any]:
    targets = context.targets()
    if not targets:
        return _no_targets(context, "No declared artifacts matched the magic-signature selector.")
    artifact_map = _declared_artifact_map(context)
    allowed = {str(item).lower() for item in context.config.get("allowed", [])}
    match_declared = bool(context.config.get("match_declared_media_type", True))
    details = []
    passed = True
    for path in targets:
        rel = path.relative_to(context.submission_dir / "artifacts").as_posix()
        detected = _magic_media_type(path) if path.is_file() else None
        declared = str(artifact_map.get(rel, {}).get("media_type", "")).lower()
        okay = detected is not None
        if allowed:
            okay = okay and detected in allowed
        if match_declared and declared and declared not in {
            "application/octet-stream",
            "text/plain",
            "text/markdown",
            "text/html",
            "text/css",
            "text/javascript",
            "text/x-python",
        }:
            # MP4-compatible QuickTime files share the same ftyp signature.
            aliases = {("video/mp4", "video/quicktime"), ("video/quicktime", "video/mp4")}
            okay = okay and (detected == declared or (detected, declared) in aliases)
        details.append(
            {
                "path": rel,
                "declared_media_type": declared,
                "detected_media_type": detected,
                "passed": okay,
            }
        )
        passed = passed and okay
    return _result(
        passed and bool(details),
        "File signatures passed." if passed else "A file signature is missing or conflicts with its declaration.",
        {
            "allowed": sorted(allowed),
            "match_declared_media_type": match_declared,
            "files": details,
            "note": "This checks a small set of common magic signatures, not full codec validity.",
        },
    )


def check_image_aspect_ratio(context: CheckContext) -> dict[str, Any]:
    targets = context.targets()
    if not targets:
        return _no_targets(context, "No declared images matched the aspect-ratio selector.")
    minimum = float(context.config.get("min_ratio", 0.0))
    maximum = float(context.config.get("max_ratio", 10**9))
    target = context.config.get("ratio")
    tolerance = float(context.config.get("tolerance", 0.001))
    details = []
    passed = True
    for path in targets:
        try:
            info = _image_info(path)
            ratio = info["width"] / info["height"]
            okay = minimum <= ratio <= maximum
            if target is not None:
                okay = okay and abs(ratio - float(target)) <= tolerance
            details.append(
                {
                    "path": path.name,
                    **info,
                    "aspect_ratio": round(ratio, 8),
                    "passed": okay,
                }
            )
            passed = passed and okay
        except Exception as exc:
            details.append({"path": path.name, "passed": False, "error": str(exc)})
            passed = False
    return _result(
        passed and bool(details),
        "Image aspect ratio passed." if passed else "Image aspect ratio failed.",
        {
            "requirements": {
                "min_ratio": minimum,
                "max_ratio": maximum,
                "ratio": target,
                "tolerance": tolerance,
            },
            "files": details,
        },
    )


def _validate_json_schema_lite(value: Any, schema: dict[str, Any], path: str = "$") -> list[str]:
    """Validate a dependency-free, deliberately small JSON Schema subset."""

    errors: list[str] = []
    expected_type = schema.get("type")
    type_map = {
        "object": dict,
        "array": list,
        "string": str,
        "number": (int, float),
        "integer": int,
        "boolean": bool,
        "null": type(None),
    }
    if expected_type in type_map:
        expected_python = type_map[expected_type]
        type_ok = isinstance(value, expected_python)
        if expected_type in {"number", "integer"} and isinstance(value, bool):
            type_ok = False
        if not type_ok:
            return [f"{path}: expected {expected_type}, got {type(value).__name__}"]
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: value is not in enum")

    if isinstance(value, dict):
        required = schema.get("required", [])
        if isinstance(required, list):
            for key in required:
                if key not in value:
                    errors.append(f"{path}: missing required property {key!r}")
        properties = schema.get("properties", {})
        if isinstance(properties, dict):
            for key, child_schema in properties.items():
                if key in value and isinstance(child_schema, dict):
                    errors.extend(_validate_json_schema_lite(value[key], child_schema, f"{path}.{key}"))
        if schema.get("additionalProperties") is False and isinstance(properties, dict):
            extra = sorted(set(value) - set(properties))
            if extra:
                errors.append(f"{path}: additional properties are not allowed: {extra}")
    elif isinstance(value, list):
        minimum = schema.get("minItems")
        maximum = schema.get("maxItems")
        if minimum is not None and len(value) < int(minimum):
            errors.append(f"{path}: expected at least {minimum} items")
        if maximum is not None and len(value) > int(maximum):
            errors.append(f"{path}: expected at most {maximum} items")
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index, item in enumerate(value):
                errors.extend(_validate_json_schema_lite(item, item_schema, f"{path}[{index}]"))
    elif isinstance(value, str):
        if schema.get("minLength") is not None and len(value) < int(schema["minLength"]):
            errors.append(f"{path}: string is shorter than minLength")
        if schema.get("maxLength") is not None and len(value) > int(schema["maxLength"]):
            errors.append(f"{path}: string is longer than maxLength")
        if schema.get("pattern") is not None and re.search(str(schema["pattern"]), value) is None:
            errors.append(f"{path}: string does not match pattern")
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        if schema.get("minimum") is not None and value < float(schema["minimum"]):
            errors.append(f"{path}: value is below minimum")
        if schema.get("maximum") is not None and value > float(schema["maximum"]):
            errors.append(f"{path}: value is above maximum")
    return errors


def check_json_schema_lite(context: CheckContext) -> dict[str, Any]:
    schema = context.config.get("schema")
    if not isinstance(schema, dict):
        return _result(False, "json_schema_lite requires config.schema as an object.", {})
    targets = context.targets()
    if not targets:
        return _no_targets(context, "No declared JSON artifacts matched the schema selector.")
    details = []
    passed = True
    for path in targets:
        try:
            value = read_json(path, max_bytes=int(context.config.get("max_json_bytes", 16 * 1024 * 1024)))
            errors = _validate_json_schema_lite(value, schema)
            okay = not errors
            details.append({"path": path.name, "passed": okay, "errors": errors[:100]})
            passed = passed and okay
        except Exception as exc:
            details.append({"path": path.name, "passed": False, "errors": [str(exc)]})
            passed = False
    return _result(
        passed and bool(details),
        "JSON schema-lite validation passed." if passed else "JSON schema-lite validation failed.",
        {
            "files": details,
            "supported_keywords": [
                "type",
                "enum",
                "required",
                "properties",
                "additionalProperties",
                "items",
                "minItems",
                "maxItems",
                "minLength",
                "maxLength",
                "pattern",
                "minimum",
                "maximum",
            ],
        },
    )


def check_external_receipt(context: CheckContext) -> dict[str, Any]:
    """Map a previously verified external-runner result into the rubric."""

    result_id = str(context.config.get("result_id", "")).strip()
    runner_id = str(context.config.get("runner_id", "")).strip()
    if not result_id:
        return _result(False, "external_receipt requires config.result_id.", {})
    receipts = context.runtime_evidence.get("external_receipts", [])
    matches = []
    for receipt in receipts:
        if runner_id and receipt.get("runner_id") != runner_id:
            continue
        for result in receipt.get("results", []):
            if result.get("result_id") == result_id:
                matches.append((receipt, result))
    if not matches:
        if context.check.get("required", True):
            return _result(
                False,
                f"No verified external receipt supplied result {result_id!r}.",
                {"runner_id": runner_id or None, "result_id": result_id},
            )
        return _skip(
            f"No verified optional external receipt supplied result {result_id!r}.",
            {"runner_id": runner_id or None, "result_id": result_id},
        )
    if len(matches) > 1:
        return _result(
            False,
            f"Multiple verified receipts supplied the same external result {result_id!r}; selection is ambiguous.",
            {
                "runner_id": runner_id or None,
                "receipt_hashes": [item[0].get("receipt_hash") for item in matches],
            },
        )
    receipt, result = matches[0]
    status = str(result.get("status", "")).upper()
    raw_score = result.get("score")
    score = float(raw_score) if raw_score is not None else None
    if status in {"PASS", "FAIL", "ERROR"} and score is None:
        score = 100.0 if status == "PASS" else 0.0
    if status == "SKIP":
        score = None
    return {
        "status": status,
        "score": score,
        "summary": result.get("summary") or f"External result {result_id}: {result.get('status')}",
        "evidence": {
            "runner_id": receipt.get("runner_id"),
            "receipt_hash": receipt.get("receipt_hash"),
            "signature": receipt.get("signature", {}),
            "result_id": result_id,
            "runner_evidence": result.get("evidence", {}),
            "trust_note": "The Arena verified receipt binding and signature; the trusted runner remains responsible for the underlying measurement.",
        },
    }


def build_default_registry() -> ValidatorRegistry:
    registry = ValidatorRegistry()
    registrations = {
        "artifact_exists": check_artifact_exists,
        "file_count": check_file_count,
        "extension": check_extension,
        "size_range": check_size_range,
        "sha256": check_sha256,
        "text_contains": check_text_contains,
        "text_not_contains": check_text_not_contains,
        "regex": check_regex,
        "json_valid": check_json_valid,
        "json_keys": check_json_keys,
        "zip_integrity": check_zip_integrity,
        "image_dimensions": check_image_dimensions,
        "png_alpha": check_png_alpha,
        "wav_duration": check_wav_duration,
        "ffprobe_media": check_ffprobe_media,
        "provenance_present": check_provenance_present,
        "manifest_deliverables": check_manifest_deliverables,
        "no_external_urls": check_no_external_urls,
        "command": check_command,
        "python_compile": check_python_compile,
        "deterministic_command": check_deterministic_command,
        "mime_guess": check_mime_guess,
        "file_tree": check_file_tree,
        "text_line_count": check_text_line_count,
        "magic_signature": check_magic_signature,
        "image_aspect_ratio": check_image_aspect_ratio,
        "json_schema_lite": check_json_schema_lite,
        "external_receipt": check_external_receipt,
    }
    for kind, function in registrations.items():
        registry.register(kind, function)
    return registry
