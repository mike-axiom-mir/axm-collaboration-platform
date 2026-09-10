#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

EXPECTED_REPOSITORY = "mike-axiom-mir/axm-collaboration-platform"
EXPECTED_DISPLAY_NAME = "AXM Workshop"
MARKER_SCHEMA = "axm.discovery-public/v1"
INDEX_SCHEMA = "axm.discovery-index/v0.1"
CAPABILITY_SCHEMA = "axm.discovery-capability/v0.1"
QUERY_SCHEMA = "axm.discovery-query/v0.1"
REGISTRY_PRIMARY = "registry/capabilities.jsonl"
MAX_JSONL_BYTES = 4 * 1024 * 1024

CLOSED_QUERY_AUTHORITY = {
    "classification": "DISCOVERY_EVIDENCE_ONLY",
    "execute": False,
    "install": False,
    "select": False,
    "merge": False,
    "canon": False,
}


class ContractError(RuntimeError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ContractError(message)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def strict_json_loads(text: str, label: str) -> Any:
    def reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise ContractError(f"{label}: duplicate JSON key {key!r}")
            result[key] = value
        return result

    try:
        return json.loads(text, object_pairs_hook=reject_duplicates)
    except ContractError:
        raise
    except (json.JSONDecodeError, TypeError) as exc:
        raise ContractError(f"{label}: invalid JSON ({exc.__class__.__name__})") from exc


def read_regular_bytes(path: Path, label: str, max_bytes: int | None = None) -> bytes:
    require(path.exists(), f"{label}: missing {path}")
    require(not path.is_symlink(), f"{label}: symlink refused: {path}")
    require(path.is_file(), f"{label}: not a regular file: {path}")
    if max_bytes is not None:
        require(path.stat().st_size <= max_bytes, f"{label}: exceeds {max_bytes} byte limit")
    return path.read_bytes()


def registry_candidates(repo_root: Path) -> list[Path]:
    registry = repo_root / "registry"
    preferred = [
        registry / "capabilities.jsonl",
        registry / "capabilities.v0.1.jsonl",
    ]
    found: list[Path] = []
    seen: set[Path] = set()
    for path in preferred:
        if path.is_file() and path not in seen:
            found.append(path)
            seen.add(path)
    if registry.is_dir():
        for path in sorted(registry.glob("*capabilit*.jsonl")):
            if path not in seen:
                found.append(path)
                seen.add(path)
    return found


def normalize_source(repo_root: Path, path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    relative = path.relative_to(repo_root).as_posix()
    raw = read_regular_bytes(path, relative, MAX_JSONL_BYTES)
    records: list[dict[str, Any]] = []
    nonblank = 0
    for line_number, raw_line in enumerate(raw.decode("utf-8-sig").splitlines(), 1):
        if not raw_line.strip():
            continue
        nonblank += 1
        item = strict_json_loads(raw_line, f"{relative}:{line_number}")
        require(isinstance(item, dict), f"{relative}:{line_number}: record must be an object")
        capability_id = item.get("id")
        require(isinstance(capability_id, str) and capability_id.strip(), f"{relative}:{line_number}: missing capability id")
        providers = item.get("providers") if isinstance(item.get("providers"), list) else []
        consumers = item.get("consumers") if isinstance(item.get("consumers"), list) else []
        status = item.get("status") if isinstance(item.get("status"), str) else None
        records.append(
            {
                "schema": CAPABILITY_SCHEMA,
                "id": capability_id,
                "providers": sorted({value for value in providers if isinstance(value, str)}),
                "consumers": sorted({value for value in consumers if isinstance(value, str)}),
                "status": status,
                "source": relative,
                "line": line_number,
            }
        )
    return (
        {
            "path": relative,
            "sha256": sha256_bytes(raw),
            "records": nonblank,
            "errors": 0,
        },
        records,
    )


def expected_registry(repo_root: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    paths = registry_candidates(repo_root)
    require(paths, "no capability registry candidates found")
    require((repo_root / REGISTRY_PRIMARY) in paths, f"primary registry missing: {REGISTRY_PRIMARY}")
    sources: list[dict[str, Any]] = []
    records: list[dict[str, Any]] = []
    for path in paths:
        source, source_records = normalize_source(repo_root, path)
        sources.append(source)
        records.extend(source_records)
    records.sort(key=lambda row: (row["id"], row["source"], row["line"]))
    return sources, records


def validate_marker(repo_root: Path) -> tuple[dict[str, Any], str]:
    marker_path = repo_root / ".axm" / "discovery-public.json"
    raw = read_regular_bytes(marker_path, "public discovery marker", 64 * 1024)
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ContractError("public discovery marker: invalid UTF-8") from exc
    marker = strict_json_loads(text, "public discovery marker")
    require(
        marker == {
            "schema": MARKER_SCHEMA,
            "repo": EXPECTED_REPOSITORY,
            "display_name": EXPECTED_DISPLAY_NAME,
            "public": True,
        },
        "public discovery marker must remain the exact bounded opt-in contract",
    )
    return marker, sha256_bytes(raw)


def validate_index(index_path: Path, repo_root: Path) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    marker, marker_sha256 = validate_marker(repo_root)
    expected_sources, expected_records = expected_registry(repo_root)
    raw = read_regular_bytes(index_path, "Discovery Buddy public index", 16 * 1024 * 1024)
    try:
        index = strict_json_loads(raw.decode("utf-8"), "Discovery Buddy public index")
    except UnicodeDecodeError as exc:
        raise ContractError("Discovery Buddy public index: invalid UTF-8") from exc
    require(isinstance(index, dict), "Discovery Buddy public index must be an object")
    require(index.get("schema") == INDEX_SCHEMA, "unexpected Discovery Buddy index schema")
    require(index.get("visibility") == "PUBLIC_SAFE_DECLARED_ONLY", "public scan visibility widened")
    require(index.get("root") == ".", "public scan exported a non-dot root")

    policy = index.get("policy")
    require(isinstance(policy, dict), "public scan policy missing")
    require(policy.get("public") is True, "public scan policy is not public")
    require(policy.get("absolute_paths_exported") is False, "absolute paths must not be exported")
    require(policy.get("file_contents_exported") is False, "file contents must not be exported")
    require(policy.get("public_requires_explicit_marker") is True, "explicit public marker policy lost")

    repositories = index.get("repositories")
    require(isinstance(repositories, list) and len(repositories) == 1, "public bridge must resolve exactly one repository")
    repository = repositories[0]
    require(isinstance(repository, dict), "public repository record must be an object")
    require(repository.get("repo") == EXPECTED_REPOSITORY, "repository identity mismatch")
    require(repository.get("display_name") == EXPECTED_DISPLAY_NAME, "repository display name mismatch")
    require(repository.get("public_marker_sha256") == marker_sha256, "public marker digest mismatch")
    forbidden = {"path", "name", "git", "readme", "agents", "public_marker"}
    require(forbidden.isdisjoint(repository), "public record leaked local repository fields")

    capabilities = repository.get("capabilities")
    require(isinstance(capabilities, dict), "public capability block missing")
    require(capabilities.get("sources") == expected_sources, "capability source inventory/digest mismatch")
    require(capabilities.get("records") == expected_records, "normalized capability records drifted from registry")

    summary = index.get("summary")
    require(isinstance(summary, dict), "public index summary missing")
    require(summary.get("repositories") == 1, "public index repository count mismatch")
    require(summary.get("capability_records") == len(expected_records), "public index capability count mismatch")
    require(summary.get("beacons") in (0, 1), "public index beacon count invalid")

    digest_payload = {"schema": INDEX_SCHEMA, "policy": policy, "repositories": repositories}
    canonical = json.dumps(digest_payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    expected_digest = sha256_bytes(canonical.encode("utf-8"))
    require(index.get("content_sha256") == expected_digest, "public index content digest mismatch")

    return index, marker, expected_records


def validate_query(query_path: Path, expected_id: str, expected_records: list[dict[str, Any]]) -> dict[str, Any]:
    raw = read_regular_bytes(query_path, "Discovery Buddy query result", 2 * 1024 * 1024)
    try:
        result = strict_json_loads(raw.decode("utf-8"), "Discovery Buddy query result")
    except UnicodeDecodeError as exc:
        raise ContractError("Discovery Buddy query result: invalid UTF-8") from exc
    require(isinstance(result, dict), "Discovery Buddy query result must be an object")
    require(result.get("schema") == QUERY_SCHEMA, "unexpected query schema")
    require(result.get("authority") == CLOSED_QUERY_AUTHORITY, "Discovery Buddy query authority widened")
    summary = result.get("summary")
    require(isinstance(summary, dict) and summary.get("matches") == 1, "expected exactly one query match")
    candidates = result.get("candidates")
    require(isinstance(candidates, list) and len(candidates) == 1, "expected exactly one query candidate")
    candidate = candidates[0]
    require(candidate.get("repository") == EXPECTED_REPOSITORY, "query candidate repository mismatch")
    capability = candidate.get("capability")
    require(isinstance(capability, dict), "query candidate capability missing")
    require(capability.get("id") == expected_id, "query capability id mismatch")
    matching = [row for row in expected_records if row["id"] == expected_id]
    require(len(matching) == 1, "query id is not unique in source registry")
    require(capability == matching[0], "query candidate drifted from normalized source declaration")
    return result


def choose_unique_capability(records: list[dict[str, Any]]) -> str:
    counts = Counter(row["id"] for row in records)
    for capability_id in sorted(counts):
        if counts[capability_id] == 1:
            return capability_id
    raise ContractError("source registry has no unique capability id for query proof")


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify the Workshop -> portable Discovery Buddy public capability bridge")
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--index", required=True)
    parser.add_argument("--query")
    parser.add_argument("--expected-query-id")
    parser.add_argument("--emit-query-id")
    parser.add_argument("--receipt")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    index, _marker, records = validate_index(Path(args.index), repo_root)
    selected_id = choose_unique_capability(records)

    if args.emit_query_id:
        Path(args.emit_query_id).write_text(selected_id + "\n", "utf-8")

    query_result = None
    if args.query:
        require(args.expected_query_id == selected_id, "query proof must use the deterministic selected capability id")
        query_result = validate_query(Path(args.query), selected_id, records)
    else:
        require(args.expected_query_id is None, "--expected-query-id requires --query")

    if args.receipt:
        sources, _ = expected_registry(repo_root)
        receipt = {
            "schema": "axm.workshop.discovery-buddy-public-bridge-receipt/v0.1",
            "status": "PASS",
            "repository": EXPECTED_REPOSITORY,
            "discovery_index_sha256": index["content_sha256"],
            "capability_records": len(records),
            "registry_sources": sources,
            "query": {
                "capability_id": selected_id,
                "matches": query_result["summary"]["matches"] if query_result else None,
            },
            "authority": {
                "classification": "DISCOVERY_EVIDENCE_ONLY",
                "execute": False,
                "install": False,
                "select": False,
                "merge": False,
                "canon": False,
            },
            "truth": {
                "declarations_are_runtime_proof": False,
                "discovery_grants_execution": False,
                "discovery_grants_installation": False,
                "discovery_changes_workshop_state": False,
                "automatic_merge": False,
                "automatic_canon": False,
            },
        }
        Path(args.receipt).write_text(
            json.dumps(receipt, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            "utf-8",
        )

    print(
        "Workshop public Discovery Buddy bridge: PASS "
        f"({len(records)} declarations; query={selected_id!r}; queried={bool(query_result)})"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ContractError as exc:
        print(f"Workshop public Discovery Buddy bridge: FAIL: {exc}")
        raise SystemExit(1)
