from __future__ import annotations

from pathlib import Path, PurePosixPath
from typing import Any
import hashlib

from .canonical_json import canonical_sha256
from .io import load_json, loads_json


REPORT_VERSION = "0.1.0"
TOOLS_INDEX_SCHEMA = "axm.tools-index/v1"
MODULES_SCHEMA = "axm.public-modules/v1"
CAPABILITY_SCHEMA = "axm.public-capability/v1"
STATUS_SCHEMA = "axm.public-status/v1"
PROOFS_SCHEMA = "axm.public-proofs/v1"


def _dict(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _safe_relative(value: str) -> bool:
    p = PurePosixPath(value)
    return bool(value) and not p.is_absolute() and "." not in p.parts and ".." not in p.parts


def _repo_file(root: Path, relative: str, *, required: bool = True) -> Path | None:
    if not _safe_relative(relative):
        raise ValueError(f"Unsafe discovery path: {relative!r}")
    candidate = root / PurePosixPath(relative)
    if candidate.is_symlink():
        raise ValueError(f"Discovery source may not be a symbolic link: {relative}")
    try:
        resolved = candidate.resolve(strict=True)
    except FileNotFoundError:
        if required:
            raise
        return None
    root_resolved = root.resolve(strict=True)
    if root_resolved != resolved and root_resolved not in resolved.parents:
        raise ValueError(f"Discovery source escapes repository root: {relative}")
    if not resolved.is_file():
        raise ValueError(f"Discovery source is not a regular file: {relative}")
    return resolved


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    records = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        text = line.strip()
        if not text:
            continue
        try:
            value = loads_json(text)
        except Exception as exc:
            raise ValueError(f"Invalid/ambiguous JSONL at line {line_no}: {exc}") from exc
        if not isinstance(value, dict):
            raise ValueError(f"Capability registry line {line_no} is not an object")
        records.append(value)
    return records


def classify_registry_role(row: dict[str, Any]) -> dict[str, Any]:
    providers = [str(item) for item in _list(row.get("providers")) if str(item)]
    consumers = [str(item) for item in _list(row.get("consumers")) if str(item)]
    if providers and consumers:
        classification = "PROVIDED_AND_CONSUMED"
        human_surface = "AXM_CAPABILITY"
    elif providers:
        classification = "PROVIDED_ONLY"
        human_surface = "AXM_CAPABILITY"
    elif consumers:
        classification = "CONSUMER_ONLY_DEPENDENCY"
        human_surface = "DEPENDENCY_REFERENCE"
    else:
        classification = "UNBOUND"
        human_surface = "REVIEW_HOLD"
    return {
        "classification": classification,
        "human_surface": human_surface,
        "provider_count": len(providers),
        "consumer_count": len(consumers),
        "is_provider_backed": bool(providers),
    }


def _expected_modules(index: dict[str, Any]) -> list[dict[str, Any]]:
    expected = []
    for tool in _list(index.get("tools")):
        if not isinstance(tool, dict):
            continue
        entry = _dict(tool.get("entry"))
        contract = _dict(tool.get("contract"))
        selftest = _dict(tool.get("selftest"))
        expected.append({
            "id": tool.get("id"),
            "name": tool.get("name"),
            "status": tool.get("status"),
            "kind": tool.get("kind"),
            "audience": tool.get("audience"),
            "source_path": "tools/" + str(tool.get("folder", "")),
            "entry_path": entry.get("path") if entry.get("exists") else None,
            "manifest": tool.get("manifest"),
            "contract": {
                "path": contract.get("path"),
                "present": contract.get("present"),
                "valid": contract.get("valid"),
                "provides": contract.get("provides"),
                "consumes": contract.get("consumes"),
                "errors": contract.get("errors"),
            },
            "tests": selftest.get("paths"),
            "verified_at": tool.get("verifiedAt"),
            "freshness": tool.get("freshness"),
            "promotion": tool.get("promotion"),
        })
    return expected


def _expected_capabilities(index: dict[str, Any]) -> list[dict[str, Any]]:
    by_id = {
        str(tool.get("id")): tool
        for tool in _list(index.get("tools"))
        if isinstance(tool, dict) and tool.get("id")
    }
    expected = []
    for capability in _list(index.get("capabilities")):
        if not isinstance(capability, dict):
            continue
        providers = list(capability.get("providers") or [])
        expected.append({
            "schema": CAPABILITY_SCHEMA,
            "id": capability.get("id"),
            "providers": providers,
            "consumers": list(capability.get("consumers") or []),
            "provider_statuses": [
                {
                    "id": provider_id,
                    "status": (
                        _dict(by_id.get(str(provider_id))).get("status")
                        if str(provider_id) in by_id
                        else "UNKNOWN"
                    ),
                }
                for provider_id in providers
            ],
            "truth": {
                "declaration_is_runtime_proof": False,
                "grants_authority": False,
            },
        })
    return expected


def _expected_public_status(index: dict[str, Any], module_count: int, capability_count: int) -> dict[str, Any]:
    return {
        "schema": STATUS_SCHEMA,
        "generated_at": index.get("generatedAt"),
        "release_status": "EXPERIMENTAL",
        "source_digest": index.get("sourceDigest"),
        "discovery": {
            "modules": module_count,
            "declared_capabilities": capability_count,
            "modules_registry": "registry/modules.json",
            "capabilities_registry": "registry/capabilities.jsonl",
        },
        "gates": {
            "public_safe": {
                "state": "VERIFY_AT_PUBLICATION",
                "evidence": "Deterministic public-safety scan and exact publication plan are required for each outgoing snapshot.",
            },
            "windows_source_launch": {
                "state": "TEST",
                "evidence": "tests/windows-clean-launch-smoke.ps1 and .github/workflows/public-launch.yml",
                "limitation": "First bootstrap needs internet when compatible Node.js is absent.",
            },
            "bundled_runtime": {
                "state": "NOT_INCLUDED",
                "evidence": "Top-level runtime is deliberately excluded from public source sync.",
            },
            "offline_first_launch": {"state": "NOT_CLAIMED", "evidence": None},
            "first_time_human_test": {"state": "NOT_RUN", "evidence": None},
            "proof_one_guided_demo": {"state": "PLANNED", "evidence": None},
        },
        "truth": {
            "public_safe_is_runnable": False,
            "declaration_is_runtime_proof": False,
            "selftest_is_human_approval": False,
            "automatic_promotion": False,
            "canon_requires_human_merge_gate": True,
        },
    }


def _expected_proofs(index: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": PROOFS_SCHEMA,
        "generated_at": index.get("generatedAt"),
        "claims": [
            {
                "id": "discovery-structure",
                "claim": "The public capability and module maps match tools-index.json.",
                "evidence": ["scripts/generate-public-discovery.js", "tests/public-discovery-selftest.js"],
                "proves": ["static structure", "registry consistency"],
                "does_not_prove": ["runtime behavior", "usability", "human approval"],
            },
            {
                "id": "windows-clean-launch",
                "claim": "The extracted Windows source candidate can bootstrap a pinned runtime and answer the Hub health route.",
                "evidence": ["tests/windows-clean-launch-smoke.ps1", ".github/workflows/public-launch.yml"],
                "proves": ["Windows x64/ARM64 first-run launch when nodejs.org is reachable"],
                "does_not_prove": ["offline first launch", "macOS/Linux launch", "first-time human comprehension"],
            },
            {
                "id": "public-safety",
                "claim": "The exact outgoing snapshot contains no configured public-safety blockers.",
                "evidence": ["tools/workshop-packager/package-planner.js", "shared/operations/github-sync-service.js"],
                "proves": ["only the exact digest verified during publication"],
                "does_not_prove": ["production security", "license clearance for every future use"],
            },
        ],
    }


def _file_evidence(root: Path, relative: str, role: str) -> dict[str, Any]:
    path = _repo_file(root, relative)
    return {
        "role": role,
        "relative_path": relative,
        "sha256": _sha256_file(path),
        "bytes": path.stat().st_size,
    }


def build_discovery_integrity_report(repository_root: str | Path) -> dict[str, Any]:
    raw_root = Path(repository_root)
    if raw_root.is_symlink():
        raise ValueError(f"Repository root may not be a symbolic link: {raw_root}")
    root = raw_root.resolve(strict=True)
    if not root.is_dir():
        raise ValueError(f"Repository root is not a directory: {root}")

    required = {
        "tools_index": "tools-index.json",
        "modules_registry": "registry/modules.json",
        "capabilities_registry": "registry/capabilities.jsonl",
        "public_status": "registry/public-status.json",
        "proofs": "registry/proofs.json",
        "tools_index_generator": "scripts/generate-tools-index.js",
        "discovery_generator": "scripts/generate-public-discovery.js",
        "discovery_selftest": "tests/public-discovery-selftest.js",
    }
    evidence: dict[str, dict[str, Any]] = {}
    missing_required_files: list[str] = []
    for key, relative in required.items():
        try:
            evidence[key] = _file_evidence(root, relative, key)
        except Exception:
            missing_required_files.append(relative)

    # Core registry documents are necessary to reconstruct the bundle. Return a
    # structured failure instead of throwing so automation can hold cleanly.
    core_required = [
        required["tools_index"],
        required["modules_registry"],
        required["capabilities_registry"],
        required["public_status"],
        required["proofs"],
    ]
    missing_core = [item for item in core_required if item in missing_required_files]
    if missing_core:
        stable_payload = {
            "report_version": REPORT_VERSION,
            "missing_required_files": sorted(missing_required_files),
        }
        return {
            "report_version": REPORT_VERSION,
            "operation": "axm_public_discovery_integrity",
            "repository_root_at_generation": str(root),
            "valid": False,
            "discovery_bundle_hash": canonical_sha256(stable_payload),
            "tools_index": {},
            "exact_checks": {},
            "role_counts": {},
            "proof_ceiling": {},
            "source_files": list(evidence.values()),
            "missing_proof_evidence": [],
            "missing_module_source_paths": [],
            "missing_module_test_paths": [],
            "module_test_hash_mismatches": [],
            "upstream_tools_index_scope": "SUPPLIED_TOOLS_INDEX_SNAPSHOT_NOT_REGENERATED",
            "missing_required_files": sorted(missing_required_files),
            "issues": [
                f"{len(missing_core)} core public discovery file(s) are missing"
            ],
            "warnings": [],
            "summary": {
                "module_count": 0,
                "registry_identifier_count": 0,
                "provider_backed_count": 0,
                "consumer_only_dependency_count": 0,
                "unbound_count": 0,
                "proof_evidence_file_count": 0,
                "missing_module_source_path_count": 0,
                "missing_module_test_path_count": 0,
                "module_test_hash_mismatch_count": 0,
                "missing_required_file_count": len(missing_required_files),
                "issue_count": 1,
                "warning_count": 0,
            },
            "integrity_notes": [
                "Public discovery integrity cannot be established while core generated registry files are missing."
            ],
        }

    index = load_json(_repo_file(root, required["tools_index"]))
    modules = load_json(_repo_file(root, required["modules_registry"]))
    capabilities = _read_jsonl(_repo_file(root, required["capabilities_registry"]))
    status = load_json(_repo_file(root, required["public_status"]))
    proofs = load_json(_repo_file(root, required["proofs"]))

    issues: list[str] = []
    warnings: list[str] = []
    missing_noncore = [
        item for item in missing_required_files if item not in core_required
    ]
    if missing_noncore:
        issues.append(
            f"{len(missing_noncore)} required discovery generator/test evidence file(s) are missing"
        )

    if index.get("schema") != TOOLS_INDEX_SCHEMA:
        issues.append(f"Unsupported tools-index schema: {index.get('schema')!r}; expected {TOOLS_INDEX_SCHEMA!r}")
    if modules.get("schema") != MODULES_SCHEMA:
        issues.append(f"Unsupported module registry schema: {modules.get('schema')!r}; expected {MODULES_SCHEMA!r}")
    if status.get("schema") != STATUS_SCHEMA:
        issues.append(f"Unsupported public-status schema: {status.get('schema')!r}; expected {STATUS_SCHEMA!r}")
    if proofs.get("schema") != PROOFS_SCHEMA:
        issues.append(f"Unsupported proof registry schema: {proofs.get('schema')!r}; expected {PROOFS_SCHEMA!r}")
    if any(row.get("schema") != CAPABILITY_SCHEMA for row in capabilities):
        issues.append("One or more public capability rows use an unsupported schema")

    expected_modules = _expected_modules(index)
    expected_capabilities = _expected_capabilities(index)

    index_summary = _dict(index.get("summary"))
    if index_summary.get("tools") != len(expected_modules):
        issues.append(
            f"tools-index summary.tools mismatch: declared {index_summary.get('tools')}, observed {len(expected_modules)}"
        )
    if index_summary.get("capabilities") != len(expected_capabilities):
        issues.append(
            f"tools-index summary.capabilities mismatch: declared {index_summary.get('capabilities')}, observed {len(expected_capabilities)}"
        )

    expected_status = _expected_public_status(index, len(expected_modules), len(expected_capabilities))
    expected_proofs = _expected_proofs(index)

    exact_checks = {
        "modules_match_tools_index": modules == {
            "schema": MODULES_SCHEMA,
            "generated_at": index.get("generatedAt"),
            "source": {"path": "tools-index.json", "digest": index.get("sourceDigest")},
            "summary": index.get("summary"),
            "truth": index.get("truth"),
            "modules": expected_modules,
        },
        "capabilities_match_tools_index": capabilities == expected_capabilities,
        "public_status_matches_generator_contract": status == expected_status,
        "proofs_match_generator_contract": proofs == expected_proofs,
    }
    for name, valid in exact_checks.items():
        if not valid:
            issues.append(name.replace("_", " ") + " failed")

    ids = [str(row.get("id", "")) for row in capabilities]
    seen = set()
    duplicates = set()
    for item in ids:
        if item in seen and item:
            duplicates.add(item)
        seen.add(item)
    duplicate_ids = sorted(duplicates)
    if duplicate_ids:
        issues.append(f"Public capability registry contains duplicate IDs: {duplicate_ids[:10]}")

    roles = {key: 0 for key in ("PROVIDED_ONLY", "PROVIDED_AND_CONSUMED", "CONSUMER_ONLY_DEPENDENCY", "UNBOUND")}
    for row in capabilities:
        roles[classify_registry_role(row)["classification"]] += 1

    missing_module_source_paths: list[str] = []
    missing_module_test_paths: list[str] = []
    module_test_hash_mismatches: list[dict[str, Any]] = []
    index_tools_by_id = {
        str(tool.get("id")): tool
        for tool in _list(index.get("tools"))
        if isinstance(tool, dict) and tool.get("id")
    }
    for module in expected_modules:
        source_path = str(module.get("source_path", "") or "")
        if not source_path or not _safe_relative(source_path):
            missing_module_source_paths.append(source_path or "<missing>")
        else:
            candidate = root / PurePosixPath(source_path)
            if candidate.is_symlink() or not candidate.is_dir():
                missing_module_source_paths.append(source_path)
        for test_path in _list(module.get("tests")):
            relative = str(test_path)
            try:
                test_file = _repo_file(root, relative)
            except Exception:
                missing_module_test_paths.append(relative)
                continue

            tool = _dict(index_tools_by_id.get(str(module.get("id", ""))))
            selftest = _dict(tool.get("selftest"))
            promotion_path = str(selftest.get("promotionPath", "") or "")
            declared_sha = str(selftest.get("sha256", "") or "")
            if promotion_path == relative and declared_sha:
                actual_sha = _sha256_file(test_file)
                if actual_sha != declared_sha:
                    module_test_hash_mismatches.append({
                        "module_id": module.get("id", ""),
                        "relative_path": relative,
                        "declared_sha256": declared_sha,
                        "observed_sha256": actual_sha,
                    })

    if missing_module_source_paths:
        issues.append(
            f"{len(set(missing_module_source_paths))} declared module source path(s) are missing/invalid"
        )
    if missing_module_test_paths:
        issues.append(
            f"{len(set(missing_module_test_paths))} declared module test evidence path(s) are missing"
        )
    if module_test_hash_mismatches:
        issues.append(
            f"{len(module_test_hash_mismatches)} declared promotion self-test hash(es) differ from tools-index.json"
        )

    proof_evidence_files: dict[str, dict[str, Any]] = {}
    missing_proof_evidence: list[str] = []
    for claim in _list(proofs.get("claims")):
        if not isinstance(claim, dict):
            issues.append("Proof registry contains a non-object claim")
            continue
        if not _list(claim.get("evidence")):
            issues.append(f"Proof claim {claim.get('id')!r} has no evidence paths")
        if not _list(claim.get("does_not_prove")):
            issues.append(f"Proof claim {claim.get('id')!r} has no proof ceiling")
        for relative in _list(claim.get("evidence")):
            text = str(relative)
            try:
                proof_evidence_files[text] = _file_evidence(root, text, "proof_evidence")
            except Exception:
                missing_proof_evidence.append(text)
    if missing_proof_evidence:
        issues.append(f"{len(set(missing_proof_evidence))} proof evidence file(s) are missing")

    attributes = _repo_file(root, ".gitattributes", required=False)
    if attributes:
        text = attributes.read_text(encoding="utf-8", errors="replace")
        if "registry/*.json text eol=lf" not in text:
            warnings.append(".gitattributes does not declare LF stability for registry/*.json")
        if "registry/*.jsonl text eol=lf" not in text:
            warnings.append(".gitattributes does not declare LF stability for registry/*.jsonl")
    else:
        warnings.append(".gitattributes is unavailable; line-ending policy was not verified")

    source_files = list(evidence.values()) + sorted(proof_evidence_files.values(), key=lambda item: item["relative_path"])
    stable_payload = {
        "report_version": REPORT_VERSION,
        "source_files": source_files,
        "exact_checks": exact_checks,
        "role_counts": roles,
        "tools_index_source_digest": index.get("sourceDigest"),
        "generated_at": index.get("generatedAt"),
    }
    discovery_bundle_hash = canonical_sha256(stable_payload)

    truth = _dict(status.get("truth"))
    discovery_claim = next(
        (claim for claim in _list(proofs.get("claims")) if isinstance(claim, dict) and claim.get("id") == "discovery-structure"),
        {},
    )
    proof_ceiling = {
        "release_status": status.get("release_status"),
        "public_safe_is_runnable": truth.get("public_safe_is_runnable"),
        "declaration_is_runtime_proof": truth.get("declaration_is_runtime_proof"),
        "selftest_is_human_approval": truth.get("selftest_is_human_approval"),
        "automatic_promotion": truth.get("automatic_promotion"),
        "canon_requires_human_merge_gate": truth.get("canon_requires_human_merge_gate"),
        "discovery_structure_proves": _list(_dict(discovery_claim).get("proves")),
        "discovery_structure_does_not_prove": _list(_dict(discovery_claim).get("does_not_prove")),
    }

    return {
        "report_version": REPORT_VERSION,
        "operation": "axm_public_discovery_integrity",
        "repository_root_at_generation": str(root),
        "valid": not issues,
        "discovery_bundle_hash": discovery_bundle_hash,
        "tools_index": {
            "schema": index.get("schema"),
            "generated_at": index.get("generatedAt"),
            "source_digest": index.get("sourceDigest"),
            "summary": _dict(index.get("summary")),
        },
        "exact_checks": exact_checks,
        "role_counts": roles,
        "proof_ceiling": proof_ceiling,
        "source_files": source_files,
        "missing_proof_evidence": sorted(set(missing_proof_evidence)),
        "missing_required_files": sorted(set(missing_required_files)),
        "missing_module_source_paths": sorted(set(missing_module_source_paths)),
        "missing_module_test_paths": sorted(set(missing_module_test_paths)),
        "module_test_hash_mismatches": module_test_hash_mismatches,
        "upstream_tools_index_scope": "SUPPLIED_TOOLS_INDEX_SNAPSHOT_NOT_REGENERATED",
        "issues": issues,
        "warnings": warnings,
        "summary": {
            "module_count": len(expected_modules),
            "registry_identifier_count": len(capabilities),
            "provider_backed_count": roles["PROVIDED_ONLY"] + roles["PROVIDED_AND_CONSUMED"],
            "consumer_only_dependency_count": roles["CONSUMER_ONLY_DEPENDENCY"],
            "unbound_count": roles["UNBOUND"],
            "proof_evidence_file_count": len(proof_evidence_files),
            "missing_module_source_path_count": len(set(missing_module_source_paths)),
            "missing_module_test_path_count": len(set(missing_module_test_paths)),
            "module_test_hash_mismatch_count": len(module_test_hash_mismatches),
            "missing_required_file_count": len(set(missing_required_files)),
            "issue_count": len(issues),
            "warning_count": len(warnings),
        },
        "integrity_notes": [
            "This validator reconstructs the current public discovery outputs from tools-index.json without writing the repository.",
            "A registry identifier with consumers but no provider is a consumed dependency/reference, not an AXM-provided ability.",
            "Static registry consistency does not prove runtime behavior, usability, or human approval.",
            "Module One does not regenerate tools-index.json or execute its promotion self-tests; that remains upstream authority. It verifies the supplied snapshot and declared self-test byte hashes where available.",
        ],
    }
