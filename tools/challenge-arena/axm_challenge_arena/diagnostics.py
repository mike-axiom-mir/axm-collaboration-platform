from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path
from typing import Any

from .utils import read_json, safe_relative_path, sha256_json, utc_now

_WORD_RE = re.compile(r"[\w'-]+", re.UNICODE)


def artifact_set_hash(file_evidence: list[dict[str, Any]]) -> str:
    """Hash declared artifact bytes and paths without participant identity or prose."""

    clean = [
        {
            "path": str(item["path"]).replace("\\", "/"),
            "bytes": int(item["bytes"]),
            "sha256": str(item["sha256"]),
        }
        for item in file_evidence
    ]
    clean.sort(key=lambda item: item["path"])
    return sha256_json(clean)


def _bounded_shingle_sample(tokens: list[str], *, shingle_size: int, limit: int) -> set[str]:
    """Return the lexicographically lowest hashed shingles with bounded memory.

    Sampling by SHA-256 rather than by source order keeps the fingerprint stable while
    preventing a long generated file from forcing an unbounded in-memory shingle set.
    The returned values are hashes, so candidate prose is not copied into diagnostics.
    """

    if not tokens or limit <= 0:
        return set()
    if len(tokens) < shingle_size:
        return {sha256_json(tokens)}

    sample: set[str] = set()
    shrink_at = max(limit + 1, limit * 2)
    for index in range(len(tokens) - shingle_size + 1):
        digest = sha256_json(tokens[index : index + shingle_size])
        sample.add(digest)
        if len(sample) >= shrink_at:
            sample = set(sorted(sample)[:limit])
    if len(sample) > limit:
        sample = set(sorted(sample)[:limit])
    return sample


def _text_fingerprint(
    submission_dir: Path,
    manifest: dict[str, Any],
    *,
    max_file_bytes: int = 512_000,
    max_total_bytes: int = 2_000_000,
    shingle_size: int = 5,
    max_shingles: int = 50_000,
) -> dict[str, Any]:
    all_shingles: set[str] = set()
    token_count = 0
    consumed = 0
    files_read: list[str] = []
    files_skipped_missing: list[str] = []
    files_skipped_binary: list[str] = []
    files_skipped_file_limit: list[str] = []
    files_skipped_total_limit: list[str] = []

    artifacts = manifest.get("artifacts", [])
    if not isinstance(artifacts, list):
        artifacts = []

    for artifact in sorted(
        (item for item in artifacts if isinstance(item, dict)),
        key=lambda item: str(item.get("path", "")),
    ):
        raw_rel = str(artifact.get("path", "")).replace("\\", "/")
        try:
            rel = safe_relative_path(raw_rel).as_posix()
        except ValueError:
            files_skipped_missing.append(raw_rel)
            continue
        path = submission_dir / "artifacts" / rel
        if path.is_symlink() or not path.is_file():
            files_skipped_missing.append(rel)
            continue
        size = path.stat().st_size
        if size > max_file_bytes:
            files_skipped_file_limit.append(rel)
            continue
        if consumed + size > max_total_bytes:
            files_skipped_total_limit.append(rel)
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            files_skipped_binary.append(rel)
            continue

        consumed += size
        files_read.append(rel)
        tokens = [match.group(0).casefold() for match in _WORD_RE.finditer(text)]
        token_count += len(tokens)
        all_shingles.update(
            _bounded_shingle_sample(
                tokens,
                shingle_size=shingle_size,
                limit=max_shingles,
            )
        )
        if len(all_shingles) > max_shingles:
            all_shingles = set(sorted(all_shingles)[:max_shingles])

    return {
        "available": bool(all_shingles),
        "fingerprint_method": f"bottom-{max_shingles}-sha256-word-{shingle_size}gram",
        "token_count": token_count,
        "shingle_count": len(all_shingles),
        "bytes_read": consumed,
        "files_declared": len(artifacts),
        "files_read": files_read,
        "files_skipped_missing": files_skipped_missing,
        "files_skipped_binary_or_non_utf8": files_skipped_binary,
        "files_skipped_file_limit": files_skipped_file_limit,
        "files_skipped_total_limit": files_skipped_total_limit,
        "scan_complete_within_limits": not (
            files_skipped_missing
            or files_skipped_file_limit
            or files_skipped_total_limit
        ),
        "shingles": all_shingles,
    }


def diagnostics_semantic_core(report: dict[str, Any]) -> dict[str, Any]:
    """Return the deterministic portion used for diagnostics self-verification."""

    return {
        key: value
        for key, value in report.items()
        if key not in {"diagnostics_hash", "generated_at"}
    }


def analyze_candidates(
    state: dict[str, Any],
    challenge_dir: Path,
    *,
    manifests: dict[str, dict[str, Any]] | None = None,
    high_similarity_threshold: float = 0.85,
) -> dict[str, Any]:
    """Create non-punitive independence/convergence evidence across active candidates.

    Exact duplicate and high text-similarity findings are warnings only. They do not
    change eligibility or scores because identical work can arise independently and
    textual similarity can be legitimate for locked templates or shared interfaces.

    ``manifests`` should contain already-verified manifests when called by the Arena.
    Disk fallback remains available for standalone audit tools, but parse failures are
    recorded instead of being silently converted into empty evidence.
    """

    active = {
        submission_id: submission
        for submission_id, submission in state.get("submissions", {}).items()
        if submission.get("status") == "ACTIVE"
    }
    by_artifact_hash: dict[str, list[str]] = defaultdict(list)
    file_hash_sets: dict[str, set[str]] = {}
    text_fingerprints: dict[str, dict[str, Any]] = {}
    scan_errors: list[dict[str, str]] = []

    for submission_id, submission in sorted(active.items()):
        artifact_hash = submission.get("artifact_set_hash")
        if artifact_hash:
            by_artifact_hash[str(artifact_hash)].append(submission_id)
        directory = challenge_dir / str(submission.get("relative_directory", ""))
        manifest = (manifests or {}).get(submission_id)
        if manifest is None:
            manifest_path = directory / "submission.json"
            try:
                loaded = read_json(manifest_path, max_bytes=16 * 1024 * 1024)
                if not isinstance(loaded, dict):
                    raise TypeError("manifest root is not a JSON object")
                manifest = loaded
            except (OSError, TypeError, ValueError) as exc:
                scan_errors.append(
                    {
                        "submission_id": submission_id,
                        "stage": "manifest_read",
                        "error": f"{type(exc).__name__}: {exc}",
                    }
                )
                manifest = {"artifacts": []}

        artifacts = manifest.get("artifacts", []) if isinstance(manifest, dict) else []
        if not isinstance(artifacts, list):
            scan_errors.append(
                {
                    "submission_id": submission_id,
                    "stage": "manifest_shape",
                    "error": "artifacts is not a list",
                }
            )
            artifacts = []
        file_hash_sets[submission_id] = {
            str(item.get("sha256"))
            for item in artifacts
            if isinstance(item, dict) and item.get("sha256")
        }
        text_fingerprints[submission_id] = _text_fingerprint(directory, manifest)

    exact_groups = [
        {
            "artifact_set_hash": digest,
            "submission_ids": sorted(submission_ids),
            "candidate_count": len(submission_ids),
        }
        for digest, submission_ids in sorted(by_artifact_hash.items())
        if len(submission_ids) > 1
    ]

    pairwise: list[dict[str, Any]] = []
    ids = sorted(active)
    for index, left in enumerate(ids):
        for right in ids[index + 1 :]:
            left_files = file_hash_sets.get(left, set())
            right_files = file_hash_sets.get(right, set())
            file_union = left_files | right_files
            file_overlap = len(left_files & right_files) / len(file_union) if file_union else 0.0

            left_text = text_fingerprints[left]
            right_text = text_fingerprints[right]
            text_similarity: float | None = None
            if left_text["available"] and right_text["available"]:
                union = left_text["shingles"] | right_text["shingles"]
                text_similarity = (
                    len(left_text["shingles"] & right_text["shingles"]) / len(union)
                    if union
                    else 0.0
                )
            if file_overlap > 0 or (
                text_similarity is not None and text_similarity >= high_similarity_threshold
            ):
                pairwise.append(
                    {
                        "left_submission_id": left,
                        "right_submission_id": right,
                        "shared_file_hash_ratio": round(file_overlap, 6),
                        "text_shingle_jaccard": (
                            round(text_similarity, 6) if text_similarity is not None else None
                        ),
                        "high_text_similarity": bool(
                            text_similarity is not None
                            and text_similarity >= high_similarity_threshold
                        ),
                    }
                )

    text_summary = {
        submission_id: {
            key: value
            for key, value in fingerprint.items()
            if key != "shingles"
        }
        for submission_id, fingerprint in text_fingerprints.items()
    }
    artifact_binding = [
        {
            "submission_id": submission_id,
            "content_hash": active[submission_id].get("content_hash"),
            "artifact_set_hash": active[submission_id].get("artifact_set_hash"),
        }
        for submission_id in sorted(active)
    ]
    report = {
        "schema_version": "axm.challenge-candidate-diagnostics/0.4",
        "generated_at": utc_now(),
        "artifact_binding_hash": sha256_json(artifact_binding),
        "policy": {
            "automatic_penalty": False,
            "high_text_similarity_threshold": high_similarity_threshold,
            "note": "Evidence only. Exact or similar outputs are not proof of copying.",
        },
        "scan_complete": not scan_errors,
        "scan_errors": scan_errors,
        "exact_duplicate_groups": exact_groups,
        "pairwise_overlap": pairwise,
        "text_fingerprint_summary": text_summary,
    }
    report["diagnostics_hash"] = sha256_json(diagnostics_semantic_core(report))
    return report


def blind_diagnostics(
    diagnostics: dict[str, Any], blind_map: dict[str, str]
) -> dict[str, Any]:
    """Translate private submission IDs into blind labels for reviewers/results."""

    reverse = {submission_id: label for label, submission_id in blind_map.items()}
    exact = []
    for group in diagnostics.get("exact_duplicate_groups", []):
        labels = sorted(
            reverse[submission_id]
            for submission_id in group.get("submission_ids", [])
            if submission_id in reverse
        )
        if len(labels) > 1:
            exact.append(
                {
                    "artifact_set_hash": group.get("artifact_set_hash"),
                    "blind_labels": labels,
                    "candidate_count": len(labels),
                }
            )
    pairs = []
    for pair in diagnostics.get("pairwise_overlap", []):
        left = reverse.get(pair.get("left_submission_id"))
        right = reverse.get(pair.get("right_submission_id"))
        if not left or not right:
            continue
        pairs.append(
            {
                "left_blind_label": left,
                "right_blind_label": right,
                "shared_file_hash_ratio": pair.get("shared_file_hash_ratio"),
                "text_shingle_jaccard": pair.get("text_shingle_jaccard"),
                "high_text_similarity": pair.get("high_text_similarity", False),
            }
        )
    return {
        "schema_version": "axm.challenge-candidate-diagnostics-blind/0.4",
        "policy": diagnostics.get("policy", {}),
        "scan_complete": diagnostics.get("scan_complete", False),
        "scan_error_count": len(diagnostics.get("scan_errors", [])),
        "artifact_binding_hash": diagnostics.get("artifact_binding_hash"),
        "exact_duplicate_groups": exact,
        "pairwise_overlap": sorted(
            pairs, key=lambda item: (item["left_blind_label"], item["right_blind_label"])
        ),
        "source_diagnostics_hash": diagnostics.get("diagnostics_hash"),
    }
