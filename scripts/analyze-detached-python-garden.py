#!/usr/bin/env python3
"""Deterministically review a detached Python module garden against AXM.

The analyzer is deliberately read-only apart from its explicitly named JSON
output.  It does not import candidate code, install modules, or infer that a
name/capability similarity is a duplicate.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import tempfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


EXCLUDED_WORKSHOP_ROOTS = {
    ".claude",
    ".codex",
    ".git",
    "backups",
    "exports",
    "node_modules",
    "state",
}
TOKEN_STOPWORDS = {
    "a", "an", "and", "axm", "for", "from", "in", "into", "local",
    "module", "of", "on", "or", "service", "the", "to", "tool", "v1",
}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def public_symbols(tree: ast.AST) -> list[str]:
    symbols: list[str] = []
    for node in getattr(tree, "body", []):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and not node.name.startswith("_"):
            symbols.append(node.name)
    return sorted(symbols)


def imports(tree: ast.AST) -> list[str]:
    values: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            values.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            values.add(node.module.split(".")[0])
    return sorted(values)


def code_lines(source: str) -> int:
    return sum(1 for line in source.splitlines() if line.strip() and not line.lstrip().startswith("#"))


def normalized_source(source: str) -> str:
    return "\n".join(line.strip() for line in source.splitlines() if line.strip() and not line.lstrip().startswith("#"))


def source_line_set(source: str) -> set[str]:
    return {line for line in source.splitlines() if line}


def tokenize(value: Any) -> set[str]:
    if isinstance(value, dict):
        text = " ".join(str(item) for key, item in sorted(value.items()) if key not in {"sha256", "path"})
    elif isinstance(value, list):
        text = " ".join(str(item) for item in value)
    else:
        text = str(value or "")
    return {
        token for token in re.findall(r"[a-z0-9]+", text.lower().replace("_", "-").replace(".", "-"))
        if len(token) > 1 and token not in TOKEN_STOPWORDS
    }


def jaccard(left: set[str], right: set[str]) -> float:
    union = left | right
    return len(left & right) / len(union) if union else 0.0


def walk_live_files(root: Path) -> Iterable[Path]:
    for current, directories, files in os.walk(root, followlinks=False):
        current_path = Path(current)
        relative = current_path.relative_to(root)
        if not relative.parts:
            directories[:] = [name for name in directories if name not in EXCLUDED_WORKSHOP_ROOTS]
        directories[:] = [
            name for name in directories
            if name != "node_modules"
            if not (relative.parts == ("worlds",) and name == "foundation-planet")
            and not (current_path / name).is_symlink()
        ]
        for name in sorted(files):
            path = current_path / name
            if not path.is_symlink() and path.is_file():
                yield path


def live_evidence(workshop_root: Path) -> tuple[dict[str, list[str]], list[dict[str, Any]]]:
    digest_paths: dict[str, list[str]] = defaultdict(list)
    manifests: list[dict[str, Any]] = []
    for path in walk_live_files(workshop_root):
        relative = path.relative_to(workshop_root).as_posix()
        if path.suffix.lower() == ".py":
            try:
                digest_paths[sha256_file(path)].append(relative)
            except OSError:
                continue
        if path.name != "manifest.json" or path.parent.parent != workshop_root / "tools":
            continue
        try:
            manifest = read_json(path)
        except (OSError, ValueError):
            continue
        contract: dict[str, Any] = {}
        contract_path = path.parent / "module.contract.json"
        if contract_path.is_file():
            try:
                contract = read_json(contract_path)
            except (OSError, ValueError):
                pass
        searchable = {
            "id": manifest.get("id"),
            "name": manifest.get("name"),
            "summary": manifest.get("summary"),
            "tags": manifest.get("tags", []),
            "actions": manifest.get("actions", []),
            "provides": contract.get("provides", []),
        }
        manifests.append({
            "id": manifest.get("id"),
            "folder": path.parent.name,
            "tokens": tokenize(searchable),
        })
    for paths in digest_paths.values():
        paths.sort()
    manifests.sort(key=lambda item: (str(item["id"]), item["folder"]))
    return digest_paths, manifests


def module_test_counts(tests_root: Path) -> Counter[int]:
    counts: Counter[int] = Counter()
    test_pattern = re.compile(r"\bdef\s+test_(\d{3})(?:_|\b)")
    for path in sorted(tests_root.glob("test_*.py")):
        try:
            source = path.read_text(encoding="utf-8-sig")
        except OSError:
            continue
        for match in test_pattern.finditer(source):
            counts[int(match.group(1))] += 1
    return counts


def parse_module(directory: Path, live_digests: dict[str, list[str]], live_manifests: list[dict[str, Any]], test_counts: Counter[int]) -> dict[str, Any]:
    manifest_path = directory / "module.json"
    manifest = read_json(manifest_path)
    number = int(manifest["number"])
    implementation = directory / "implementation.py"
    implementation_record: dict[str, Any] | None = None
    issues: list[str] = []

    if implementation.is_file():
        source = implementation.read_text(encoding="utf-8-sig")
        try:
            tree = ast.parse(source, filename=str(implementation))
            syntax_valid = True
            syntax_error = None
            semantic_hash = sha256_bytes(ast.dump(tree, include_attributes=False).encode("utf-8"))
            symbols = public_symbols(tree)
            import_names = imports(tree)
        except SyntaxError as error:
            syntax_valid = False
            syntax_error = f"{error.msg} at line {error.lineno}"
            semantic_hash = None
            symbols = []
            import_names = []
            issues.append("implementation_syntax_invalid")
        digest = sha256_file(implementation)
        implementation_record = {
            "path": implementation.relative_to(directory.parent.parent).as_posix(),
            "sha256": digest,
            "bytes": implementation.stat().st_size,
            "code_lines": code_lines(source),
            "syntax_valid": syntax_valid,
            "syntax_error": syntax_error,
            "semantic_ast_sha256": semantic_hash,
            "public_symbols": symbols,
            "imports": import_names,
            "normalized_source": normalized_source(source),
            "exact_live_matches": live_digests.get(digest, []),
        }
    elif manifest.get("status") != "SHADOW_ONLY":
        issues.append("prototype_implementation_missing")

    declared_id = str(manifest.get("id") or "")
    exact_id_matches = [item for item in live_manifests if item["id"] == declared_id]
    candidate_tokens = tokenize({
        "id": declared_id,
        "name": manifest.get("name"),
        "purpose": manifest.get("purpose"),
        "category": manifest.get("category"),
    })
    overlaps = []
    for item in live_manifests:
        score = jaccard(candidate_tokens, item["tokens"])
        if score:
            overlaps.append({"id": item["id"], "folder": item["folder"], "token_jaccard": round(score, 6)})
    overlaps.sort(key=lambda item: (-item["token_jaccard"], str(item["id"]), item["folder"]))

    implementation_decl = manifest.get("implementation") or {}
    if manifest.get("default_enabled") is not False:
        issues.append("default_not_disabled")
    if implementation_decl.get("network_access") not in (None, False):
        issues.append("network_access_declared")
    if implementation_decl.get("native_writes") not in (None, False):
        issues.append("native_writes_declared")
    external_dependencies = implementation_decl.get("external_dependencies") or []
    if external_dependencies:
        issues.append("external_dependencies_declared")

    return {
        "number": number,
        "id": declared_id,
        "name": manifest.get("name"),
        "status": manifest.get("status"),
        "version": manifest.get("version"),
        "authority_mode": manifest.get("authority_mode"),
        "default_enabled": manifest.get("default_enabled"),
        "hard_dependencies": sorted(manifest.get("hard_dependencies") or []),
        "implementation": implementation_record,
        "declared_external_dependencies": external_dependencies,
        "direct_test_methods": test_counts[number],
        "exact_live_id_matches": [{"id": item["id"], "folder": item["folder"]} for item in exact_id_matches],
        "top_live_capability_overlaps": overlaps[:5],
        "issues": sorted(issues),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--garden", required=True, type=Path)
    parser.add_argument("--workshop-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    arguments = parser.parse_args()

    garden = arguments.garden.resolve()
    workshop_root = arguments.workshop_root.resolve()
    modules_root = garden / "modules"
    if not modules_root.is_dir() or not (garden / "garden_manifest.json").is_file():
        raise SystemExit("garden root must contain modules/ and garden_manifest.json")
    if garden.is_symlink() or workshop_root.is_symlink():
        raise SystemExit("symlink roots are refused")

    live_digests, live_manifests = live_evidence(workshop_root)
    test_counts = module_test_counts(garden / "tests")
    modules = [
        parse_module(directory, live_digests, live_manifests, test_counts)
        for directory in sorted(modules_root.iterdir(), key=lambda path: path.name)
        if directory.is_dir() and not directory.is_symlink()
    ]

    digest_groups: dict[str, list[str]] = defaultdict(list)
    ast_groups: dict[str, list[str]] = defaultdict(list)
    source_by_id: dict[str, str] = {}
    for module in modules:
        implementation = module["implementation"]
        if not implementation:
            continue
        digest_groups[implementation["sha256"]].append(module["id"])
        if implementation["semantic_ast_sha256"]:
            ast_groups[implementation["semantic_ast_sha256"]].append(module["id"])
        source_by_id[module["id"]] = implementation.pop("normalized_source")

    high_similarity_pairs = []
    identifiers = sorted(source_by_id)
    for left_index, left in enumerate(identifiers):
        for right in identifiers[left_index + 1:]:
            score = jaccard(source_line_set(source_by_id[left]), source_line_set(source_by_id[right]))
            if score >= 0.85:
                high_similarity_pairs.append({"left": left, "right": right, "ratio": round(score, 6)})
    high_similarity_pairs.sort(key=lambda item: (-item["ratio"], item["left"], item["right"]))

    shared_files = []
    shared_root = garden / "shared" / "axm_translation_core"
    if shared_root.is_dir():
        for path in sorted(shared_root.glob("*.py")):
            source = path.read_text(encoding="utf-8-sig")
            try:
                ast.parse(source, filename=str(path))
                syntax_valid = True
            except SyntaxError:
                syntax_valid = False
            digest = sha256_file(path)
            shared_files.append({
                "path": path.relative_to(garden).as_posix(),
                "sha256": digest,
                "bytes": path.stat().st_size,
                "code_lines": code_lines(source),
                "syntax_valid": syntax_valid,
                "exact_live_matches": live_digests.get(digest, []),
            })

    prototypes = [item for item in modules if item["status"] == "LOCAL_PROTOTYPE"]
    shadows = [item for item in modules if item["status"] == "SHADOW_ONLY"]
    duplicate_file_groups = [sorted(group) for group in digest_groups.values() if len(group) > 1]
    duplicate_ast_groups = [sorted(group) for group in ast_groups.values() if len(group) > 1]
    exact_live_ids = [item["id"] for item in modules if item["exact_live_id_matches"]]
    exact_live_files = [item["id"] for item in modules if item["implementation"] and item["implementation"]["exact_live_matches"]]
    issues = [{"id": item["id"], "issues": item["issues"]} for item in modules if item["issues"]]
    dependency_ids = {dependency for item in modules for dependency in item["hard_dependencies"]}
    module_ids = {item["id"] for item in modules}

    report = {
        "schema": "axm.detached-python-garden-review/v1",
        "source": {
            "garden_name": garden.name,
            "garden_manifest_sha256": sha256_file(garden / "garden_manifest.json"),
        },
        "workshop": {
            "label": workshop_root.name,
            "active_tool_manifests_scanned": len(live_manifests),
            "active_files_hashed": sum(len(paths) for paths in live_digests.values()),
            "excluded_roots": sorted(EXCLUDED_WORKSHOP_ROOTS),
            "foundation_planet_excluded_as_active_foreign_lane": True,
        },
        "summary": {
            "modules": len(modules),
            "prototypes": len(prototypes),
            "shadows": len(shadows),
            "implementations": sum(1 for item in modules if item["implementation"]),
            "shared_core_files": len(shared_files),
            "direct_test_methods": sum(test_counts.values()),
            "exact_intra_intake_implementation_duplicate_groups": len(duplicate_file_groups),
            "exact_intra_intake_ast_duplicate_groups": len(duplicate_ast_groups),
            "high_source_similarity_pairs_at_or_above_0_85": len(high_similarity_pairs),
            "exact_live_module_id_matches": len(exact_live_ids),
            "exact_live_implementation_file_matches": len(exact_live_files),
            "modules_with_static_issues": len(issues),
            "missing_hard_dependency_ids": sorted(dependency_ids - module_ids),
        },
        "duplicate_evidence": {
            "exact_implementation_sha256_groups": sorted(duplicate_file_groups),
            "exact_semantic_ast_sha256_groups": sorted(duplicate_ast_groups),
            "high_source_similarity_pairs": high_similarity_pairs,
            "exact_live_ids": sorted(exact_live_ids),
            "exact_live_implementation_files": sorted(exact_live_files),
            "capability_similarity_is_not_treated_as_duplication": True,
        },
        "static_issues": issues,
        "modules": modules,
        "shared_core": shared_files,
        "truth": {
            "candidate_code_imported": False,
            "candidate_code_executed": False,
            "candidate_installed": False,
            "candidate_enabled": False,
            "automatic_merge_performed": False,
            "name_or_token_similarity_proves_duplication": False,
            "runtime_verification_required_separately": True,
        },
    }
    report["report_sha256"] = sha256_bytes(stable_json(report).encode("utf-8"))

    output = arguments.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="\n", dir=output.parent, delete=False) as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2, sort_keys=True)
        stream.write("\n")
        temporary = Path(stream.name)
    os.replace(temporary, output)
    print(stable_json({"output": str(output), "report_sha256": report["report_sha256"], "summary": report["summary"]}))


if __name__ == "__main__":
    main()
