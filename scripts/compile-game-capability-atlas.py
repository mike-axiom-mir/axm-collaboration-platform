"""Compile the 500-game steward source into one compact live AXM catalog.

The full checkpoint remains the immutable provenance source.  This compiler
validates every extracted module against MODULE_INDEX.jsonl, removes repeated
steward/governance scaffolding from the live representation, and emits a
searchable catalog plus an intake analysis receipt.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


TOKEN_RE = re.compile(r"[a-z0-9]+")
STOPWORDS = {
    "and", "the", "for", "with", "from", "into", "game", "games", "axm",
    "tool", "tools", "module", "modules", "system", "systems", "local",
    "shared", "current", "one", "using", "through", "without", "runtime",
}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]


def tokens(value: str) -> set[str]:
    return {
        token for token in TOKEN_RE.findall(value.lower())
        if len(token) > 2 and token not in STOPWORDS
    }


def normalized(value: str) -> str:
    return " ".join(TOKEN_RE.findall(value.lower()))


def duplicate_groups(rows: list[tuple[str, str]]) -> list[dict[str, Any]]:
    grouped: defaultdict[str, list[str]] = defaultdict(list)
    for key, module_id in rows:
        grouped[key].append(module_id)
    return [
        {"value": key, "moduleIds": sorted(ids)}
        for key, ids in sorted(grouped.items())
        if key and len(ids) > 1
    ]


def compact_module(module: dict[str, Any]) -> dict[str, Any]:
    category = module["category"]
    source = module["source_atom"]
    knowledge = module["deepened_knowledge"]
    interface = module["interface_contract"]
    verification = module["verification"]
    engines = module["engine_translation"]
    return {
        "id": module["module_id"],
        "number": int(module["lineage"]["source_entry_number"]),
        "slug": module["slug"],
        "title": module["title"],
        "category": category["number"],
        "family": category["family"],
        "layer": category["system_layer"],
        "tags": source.get("tags", []),
        "shortcut": source["shortcut"],
        "rationale": source["why_it_works"],
        "guard": source["watch"],
        "purpose": knowledge["purpose"],
        "problem": knowledge["problem_addressed"],
        "operatingRule": knowledge["operating_rule"],
        "minimumApplication": knowledge["minimum_viable_application"],
        "inputs": interface.get("inputs", []),
        "outputs": interface.get("outputs", []),
        "requiredEvidence": verification.get("required_evidence_artifacts", []),
        "minimumEvidenceCount": verification.get("minimum_evidence_count", 0),
        "proofStatus": verification.get("current_proof_status"),
        "authorityBoundary": interface.get("authority_boundary"),
        "engines": {
            "agnostic": engines.get("engine_agnostic"),
            "unreal": engines.get("unreal"),
            "unity": engines.get("unity"),
            "godot": engines.get("godot"),
        },
        "related": module.get("relationships", {}).get("related_module_ids", []),
        "sourceEntrySha256": source["source_entry_sha256"],
    }


def live_module_texts(workshop: Path) -> list[dict[str, Any]]:
    records: dict[str, dict[str, Any]] = {}
    candidates = list((workshop / "tools").glob("*/manifest.json"))
    candidates += list((workshop / "tools").glob("*/module.contract.json"))
    candidates += list((workshop / "shared").glob("*/module.contract.json"))
    for path in candidates:
        try:
            data = load_json(path)
        except (OSError, json.JSONDecodeError):
            continue
        module_id = str(data.get("id") or path.parent.name)
        record = records.setdefault(module_id, {"id": module_id, "paths": [], "text": []})
        record["paths"].append(path.relative_to(workshop).as_posix())
        record["text"].append(json.dumps(data, ensure_ascii=False))
    return [
        {"id": row["id"], "paths": sorted(row["paths"]), "tokens": tokens(" ".join(row["text"]))}
        for row in records.values()
    ]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--index", type=Path, required=True)
    parser.add_argument("--waves", type=Path, required=True)
    parser.add_argument("--workshop-root", type=Path, required=True)
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--analysis", type=Path, required=True)
    parser.add_argument("--checkpoint-sha256", required=True)
    args = parser.parse_args()

    source_root = args.source_root.resolve()
    workshop = args.workshop_root.resolve()
    index_path = args.index.resolve()
    waves_path = args.waves.resolve()
    index_rows = load_jsonl(index_path)
    index_by_id = {row["module_id"]: row for row in index_rows}
    if len(index_rows) != 500 or len(index_by_id) != 500:
        raise SystemExit("MODULE_INDEX must contain exactly 500 unique modules")

    source_files = sorted(source_root.rglob("*.json"))
    if len(source_files) != 500:
        raise SystemExit(f"expected 500 extracted source modules, found {len(source_files)}")

    modules: list[dict[str, Any]] = []
    file_hash_rows: list[tuple[str, str]] = []
    atom_hash_rows: list[tuple[str, str]] = []
    title_rows: list[tuple[str, str]] = []
    shortcut_rows: list[tuple[str, str]] = []
    mismatches: list[dict[str, str]] = []
    source_bytes = 0
    categories: dict[str, dict[str, Any]] = {}

    for path in source_files:
        raw = path.read_bytes()
        source_bytes += len(raw)
        module = json.loads(raw.decode("utf-8-sig"))
        module_id = str(module["module_id"])
        expected = index_by_id.get(module_id)
        actual_hash = sha256_bytes(raw)
        if expected is None or actual_hash != str(expected["source_file_sha256"]).lower():
            mismatches.append({
                "moduleId": module_id,
                "path": path.relative_to(source_root).as_posix(),
                "actual": actual_hash,
                "expected": str(expected.get("source_file_sha256")) if expected else "MISSING_INDEX_ROW",
            })
        compact = compact_module(module)
        modules.append(compact)
        file_hash_rows.append((actual_hash, module_id))
        atom_hash_rows.append((compact["sourceEntrySha256"], module_id))
        title_rows.append((normalized(compact["title"]), module_id))
        shortcut_rows.append((normalized(compact["shortcut"]), module_id))
        category = module["category"]
        categories.setdefault(category["number"], {
            "id": category["number"],
            "title": category["title"],
            "truth": category["category_truth"],
            "moduleCount": 0,
        })["moduleCount"] += 1

    if mismatches:
        raise SystemExit(f"source/index hash mismatch count: {len(mismatches)}")
    module_ids = [module["id"] for module in modules]
    if len(set(module_ids)) != 500:
        raise SystemExit("extracted source contains duplicate module IDs")
    if any(category["moduleCount"] != 25 for category in categories.values()) or len(categories) != 20:
        raise SystemExit("expected 20 categories with 25 modules each")

    wave_data = load_json(waves_path)
    waves = [
        {
            "id": f"balanced-wave-{int(wave['wave']):02d}",
            "number": int(wave["wave"]),
            "moduleIds": [row["module_id"] for row in wave["modules"]],
        }
        for wave in wave_data["waves"]
    ]
    if len(waves) != 25 or any(len(wave["moduleIds"]) != 20 for wave in waves):
        raise SystemExit("expected 25 balanced waves with 20 modules each")

    modules.sort(key=lambda row: row["number"])
    category_list = [categories[key] for key in sorted(categories)]
    catalog = {
        "schema": "axm.game-capability-atlas/v1",
        "version": "1.0.0",
        "source": {
            "checkpoint": "AXM_500_GAME_STEWARD_FULL_CHECKPOINT_RUN_111_2026-07-27.zip",
            "checkpointSha256": args.checkpoint_sha256.lower(),
            "sourceIndexSha256": sha256_file(index_path),
            "modules": 500,
        },
        "categories": category_list,
        "balancedWaves": waves,
        "modules": modules,
        "truth": {
            "kind": "game-development knowledge and project-planning capability",
            "doesNotClaim": [
                "500 executable game-engine systems",
                "behavioral validation without a project-specific trial",
                "automatic installation, promotion, or canon change",
            ],
            "fullSourcePreserved": True,
        },
    }
    catalog_bytes = (json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    args.catalog.parent.mkdir(parents=True, exist_ok=True)
    args.catalog.write_bytes(catalog_bytes)

    live = live_module_texts(workshop)
    exact_live_ids: defaultdict[str, list[str]] = defaultdict(list)
    for path in list((workshop / "tools").glob("*/*")) + list((workshop / "shared").glob("*/*")):
        if not path.is_file() or path.suffix.lower() not in {".json", ".js", ".md", ".txt"}:
            continue
        if path.resolve() in {args.catalog.resolve(), args.analysis.resolve()} or path.stat().st_size > 2_000_000:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for module_id in module_ids:
            if module_id in text:
                exact_live_ids[module_id].append(path.relative_to(workshop).as_posix())

    category_overlap: list[dict[str, Any]] = []
    for category in category_list:
        category_modules = [row for row in modules if row["category"] == category["id"]]
        category_tokens = tokens(" ".join(
            [category["title"]]
            + [row["title"] + " " + row["shortcut"] + " " + " ".join(row["tags"]) for row in category_modules]
        ))
        ranked = []
        for live_row in live:
            intersection = category_tokens & live_row["tokens"]
            if intersection:
                ranked.append({
                    "moduleId": live_row["id"],
                    "sharedTerms": sorted(intersection),
                    "score": round(len(intersection) / max(1, len(category_tokens)), 6),
                    "paths": live_row["paths"],
                    "similarityIsNotEquivalence": True,
                })
        ranked.sort(key=lambda row: (-row["score"], row["moduleId"]))
        category_overlap.append({
            "category": category["id"],
            "title": category["title"],
            "nearestLiveModules": ranked[:5],
        })

    duplicate_report = {
        "exactFileGroups": duplicate_groups(file_hash_rows),
        "sourceAtomGroups": duplicate_groups(atom_hash_rows),
        "normalizedTitleGroups": duplicate_groups(title_rows),
        "normalizedShortcutGroups": duplicate_groups(shortcut_rows),
    }
    analysis = {
        "schema": "axm.game-steward-intake-analysis/v1",
        "source": {
            "checkpointSha256": args.checkpoint_sha256.lower(),
            "sourceRoot": source_root.as_posix(),
            "sourceFiles": len(source_files),
            "sourceBytes": source_bytes,
            "indexRows": len(index_rows),
            "hashMismatches": mismatches,
        },
        "identity": {
            "uniqueModuleIds": len(set(module_ids)),
            "categories": len(category_list),
            "modulesPerCategory": dict(sorted(Counter(row["category"] for row in modules).items())),
            "duplicates": duplicate_report,
            "exactLiveModuleIdMatchesBeforeIntegration": dict(sorted(exact_live_ids.items())),
        },
        "liveRepresentation": {
            "catalog": args.catalog.resolve().as_posix(),
            "catalogBytes": len(catalog_bytes),
            "bytesAvoidedVersusFullSource": source_bytes - len(catalog_bytes),
            "repeatedScaffoldingNotCopied": [
                "per-module daily version slot",
                "per-module portable packet example",
                "per-module repeated governance booleans",
                "per-module generic future-growth boilerplate",
                "checkpoint replay, telemetry, and duplicate run wrappers",
            ],
            "fullSourceStillPreserved": True,
        },
        "controlledIntake": {
            "firstBalancedWave": waves[0],
            "allModulesSearchable": True,
            "automaticPromotion": False,
        },
        "workshopOverlap": category_overlap,
        "boundaries": [
            "Exact identity and content checks determine duplication; token overlap only routes review.",
            "The imported records are game-production knowledge and planning contracts, not 500 executable engines.",
            "Project-specific behavior, feel, accessibility, performance, networking, and fun remain unproven until exercised.",
        ],
    }
    args.analysis.parent.mkdir(parents=True, exist_ok=True)
    args.analysis.write_text(json.dumps(analysis, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "modules": 500,
        "categories": 20,
        "balancedWaves": 25,
        "firstWaveModules": len(waves[0]["moduleIds"]),
        "sourceBytes": source_bytes,
        "catalogBytes": len(catalog_bytes),
        "bytesAvoided": source_bytes - len(catalog_bytes),
        "duplicateSourceGroups": sum(len(value) for value in duplicate_report.values()),
        "catalog": args.catalog.resolve().as_posix(),
        "analysis": args.analysis.resolve().as_posix(),
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
