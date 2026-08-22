"""Deterministically review an AXM memory/continuity candidate garden.

The analyzer is intentionally read-only except for its explicit JSON output.
It distinguishes exact identity/content duplication from semantic similarity;
similarity is evidence for routing, never automatic equivalence.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


TEXT_SUFFIXES = {".css", ".html", ".js", ".json", ".md", ".mjs", ".py", ".txt"}
LIVE_ROOTS = ("tools", "shared", "registry", "intakes")
SKIP_PARTS = {"__pycache__", "node_modules", ".git"}
TOKEN_RE = re.compile(r"[a-z0-9]+")
STOPWORDS = {
    "a", "an", "and", "as", "at", "be", "by", "for", "from", "in", "into",
    "is", "it", "local", "of", "on", "one", "or", "the", "this", "to", "with",
    "axm", "memory", "module", "tool", "system",
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def tokens(value: str) -> set[str]:
    return {token for token in TOKEN_RE.findall(value.lower()) if token not in STOPWORDS and len(token) > 2}


def jaccard(left: set[str], right: set[str]) -> float:
    union = left | right
    return len(left & right) / len(union) if union else 0.0


def iter_live_text_files(workshop: Path, excluded: Iterable[Path]) -> Iterable[Path]:
    excluded_resolved = [path.resolve() for path in excluded]
    for root_name in LIVE_ROOTS:
        root = workshop / root_name
        if not root.is_dir():
            continue
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
                continue
            if any(part in SKIP_PARTS for part in path.parts):
                continue
            resolved = path.resolve()
            if any(resolved == item or item in resolved.parents for item in excluded_resolved):
                continue
            yield path


def manifest_text(manifest: dict[str, Any]) -> str:
    pieces: list[str] = []
    for key in ("id", "name", "description", "summary", "kind", "audience"):
        value = manifest.get(key)
        if isinstance(value, str):
            pieces.append(value)
    capabilities = manifest.get("capabilities")
    if isinstance(capabilities, list):
        for item in capabilities:
            if isinstance(item, str):
                pieces.append(item)
            elif isinstance(item, dict):
                pieces.extend(str(v) for v in item.values() if isinstance(v, (str, int, float)))
    return " ".join(pieces)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate-root", type=Path, required=True)
    parser.add_argument("--workshop-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    candidate_root = args.candidate_root.resolve()
    workshop_root = args.workshop_root.resolve()
    modules_root = candidate_root / "modules"
    registry_path = candidate_root / "registry" / "run100_capability_registry.json"

    registry = load_json(registry_path)
    registry_seeds = registry.get("seeds", [])
    module_dirs = sorted(path for path in modules_root.iterdir() if path.is_dir())

    records: list[dict[str, Any]] = []
    stable_ids: list[str] = []
    module_hashes: defaultdict[str, list[str]] = defaultdict(list)
    for module_dir in module_dirs:
        contract_path = module_dir / "candidate.contract.json"
        compiled_path = module_dir / "compiled_contract.json"
        contract = load_json(contract_path)
        compiled = load_json(compiled_path)
        stable_id = str(contract["identity"]["stable_id"])
        stable_ids.append(stable_id)
        contract_hash = sha256_file(contract_path)
        compiled_hash = sha256_file(compiled_path)
        module_hashes[contract_hash].append(f"{module_dir.name}/candidate.contract.json")
        module_hashes[compiled_hash].append(f"{module_dir.name}/compiled_contract.json")
        implementation_files = [
            path.relative_to(module_dir).as_posix()
            for path in module_dir.rglob("*.py")
            if "__pycache__" not in path.parts
        ]
        records.append(
            {
                "number": contract["identity"]["number"],
                "stable_id": stable_id,
                "name": contract["identity"]["name"],
                "category": contract["identity"]["category"],
                "posture": next(
                    (seed.get("posture") for seed in registry_seeds if seed.get("stable_id") == stable_id),
                    None,
                ),
                "risk": contract["scope"]["risk"],
                "purpose": contract["scope"]["purpose"],
                "full_seed_semantics_implemented": bool(
                    contract.get("semantic_probe", {}).get("full_seed_semantics_implemented")
                ),
                "per_seed_python_implementation_files": implementation_files,
                "candidate_contract_sha256": contract_hash,
                "compiled_contract_sha256": compiled_hash,
            }
        )

    live_files = list(iter_live_text_files(workshop_root, excluded=(candidate_root, args.output)))
    live_text: dict[Path, str] = {}
    exact_live_occurrences: defaultdict[str, list[str]] = defaultdict(list)
    for path in live_files:
        try:
            value = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        live_text[path] = value
        for stable_id in stable_ids:
            if stable_id in value:
                exact_live_occurrences[stable_id].append(path.relative_to(workshop_root).as_posix())

    live_manifests: list[tuple[str, str, set[str]]] = []
    tools_root = workshop_root / "tools"
    if tools_root.is_dir():
        for path in tools_root.glob("*/manifest.json"):
            try:
                manifest = load_json(path)
            except (OSError, json.JSONDecodeError):
                continue
            live_manifests.append(
                (
                    str(manifest.get("id") or path.parent.name),
                    path.relative_to(workshop_root).as_posix(),
                    tokens(manifest_text(manifest)),
                )
            )

    overlap_rows: list[dict[str, Any]] = []
    for record in records:
        source_tokens = tokens(f"{record['stable_id']} {record['name']} {record['purpose']}")
        ranked = sorted(
            (
                (jaccard(source_tokens, manifest_tokens), tool_id, path)
                for tool_id, path, manifest_tokens in live_manifests
            ),
            reverse=True,
        )
        best = ranked[0] if ranked else (0.0, None, None)
        overlap_rows.append(
            {
                "stable_id": record["stable_id"],
                "exact_live_occurrences": sorted(exact_live_occurrences.get(record["stable_id"], [])),
                "nearest_live_tool_id": best[1],
                "nearest_live_manifest": best[2],
                "token_jaccard": round(best[0], 6),
                "similarity_is_not_equivalence": True,
            }
        )

    all_files = [
        path for path in candidate_root.rglob("*")
        if path.is_file() and "__pycache__" not in path.parts and path.suffix.lower() != ".pyc"
    ]
    hash_groups: defaultdict[str, list[Path]] = defaultdict(list)
    size_by_hash: dict[str, int] = {}
    for path in all_files:
        digest = sha256_file(path)
        hash_groups[digest].append(path)
        size_by_hash[digest] = path.stat().st_size
    duplicate_groups = [
        {
            "sha256": digest,
            "bytes_each": size_by_hash[digest],
            "redundant_bytes": size_by_hash[digest] * (len(paths) - 1),
            "paths": [path.relative_to(candidate_root).as_posix() for path in paths],
        }
        for digest, paths in hash_groups.items()
        if len(paths) > 1
    ]
    duplicate_groups.sort(key=lambda row: (row["redundant_bytes"], len(row["paths"])), reverse=True)

    exact_contract_duplicate_groups = [paths for paths in module_hashes.values() if len(paths) > 1]
    live_exact_ids = [row for row in overlap_rows if row["exact_live_occurrences"]]
    result = {
        "schema": "axm.memory-continuity-content-review/v1",
        "candidate_root": candidate_root.as_posix(),
        "workshop_root": workshop_root.as_posix(),
        "module_directories": len(module_dirs),
        "registry_seeds": len(registry_seeds),
        "stable_ids": len(stable_ids),
        "unique_stable_ids": len(set(stable_ids)),
        "duplicate_stable_ids": sorted(
            stable_id for stable_id, count in Counter(stable_ids).items() if count > 1
        ),
        "risk_distribution": dict(sorted(Counter(row["risk"] for row in records).items())),
        "posture_distribution": dict(sorted(Counter(row["posture"] for row in records).items())),
        "full_semantic_implementations_claimed": sum(
            1 for row in records if row["full_seed_semantics_implemented"]
        ),
        "per_seed_python_implementation_files": sum(
            len(row["per_seed_python_implementation_files"]) for row in records
        ),
        "shared_harness_python_files": len(
            [path for path in (candidate_root / "harness").glob("*.py") if path.is_file()]
        ),
        "exact_contract_duplicate_groups": exact_contract_duplicate_groups,
        "live_text_files_scanned": len(live_text),
        "exact_live_stable_id_matches": len(live_exact_ids),
        "live_exact_id_details": live_exact_ids,
        "highest_live_token_jaccard": max((row["token_jaccard"] for row in overlap_rows), default=0.0),
        "archive_exact_duplicate_groups": len(duplicate_groups),
        "archive_redundant_bytes": sum(row["redundant_bytes"] for row in duplicate_groups),
        "largest_archive_duplicate_groups": duplicate_groups[:50],
        "modules": records,
        "live_overlap": overlap_rows,
        "boundaries": [
            "Exact identity or content matches are duplicates; token similarity is routing evidence only.",
            "A compiled/reference contract is not a full semantic implementation.",
            "No source authority, owner acceptance, CANON status, or permissions are transferred by analysis.",
        ],
    }

    encoded = json.dumps(result, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(encoded, encoding="utf-8")
    print(
        json.dumps(
            {
                "modules": result["module_directories"],
                "unique_stable_ids": result["unique_stable_ids"],
                "exact_live_stable_id_matches": result["exact_live_stable_id_matches"],
                "full_semantic_implementations_claimed": result["full_semantic_implementations_claimed"],
                "archive_redundant_bytes": result["archive_redundant_bytes"],
                "output": args.output.as_posix(),
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
