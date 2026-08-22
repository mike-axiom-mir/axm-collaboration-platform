from __future__ import annotations

from copy import deepcopy
from pathlib import Path, PurePosixPath
from typing import Any
import hashlib
import re

from .canonical_json import canonical_sha256
from .io import load_json
from .discovery_integrity import classify_registry_role

CATALOG_VERSION = "0.2.0"
AXM_PUBLIC_CAPABILITY_SCHEMA = "axm.public-capability/v1"
AXM_PUBLIC_MODULES_SCHEMA = "axm.public-modules/v1"


def _dict(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _strings(value: Any) -> list[str]:
    result: list[str] = []
    for item in _list(value):
        if isinstance(item, (str, int, float)):
            text = str(item).strip()
            if text and text not in result:
                result.append(text)
    return sorted(result)


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _safe_relative(value: str) -> bool:
    p = PurePosixPath(value)
    return bool(value) and not p.is_absolute() and "." not in p.parts and ".." not in p.parts


def _resolve_repo_file(root: Path, relative: str) -> Path:
    if not _safe_relative(relative):
        raise ValueError(f"Unsafe enrichment source path: {relative!r}")
    candidate = root / PurePosixPath(relative)
    if candidate.is_symlink():
        raise ValueError(f"Enrichment source may not be a symbolic link: {relative}")
    resolved = candidate.resolve(strict=True)
    root_resolved = root.resolve(strict=True)
    if root_resolved != resolved and root_resolved not in resolved.parents:
        raise ValueError(f"Enrichment source escapes repository root: {relative}")
    if not resolved.is_file():
        raise ValueError(f"Enrichment source is not a regular file: {relative}")
    return resolved


def _evidence_ref(role: str, relative_path: str, path: Path) -> dict[str, Any]:
    return {
        "role": role,
        "relative_path": relative_path,
        "sha256": _sha256_file(path),
        "bytes": path.stat().st_size,
    }


def _manifest_summary(value: Any) -> dict[str, Any]:
    manifest = _dict(value)
    return {
        "id": manifest.get("id", ""),
        "name": manifest.get("name", ""),
        "version": manifest.get("version", ""),
        "status": manifest.get("status", ""),
        "kind": manifest.get("kind", ""),
        "type": manifest.get("type", ""),
        "category": manifest.get("category", ""),
        "layer": manifest.get("layer", ""),
        "audience": manifest.get("audience", ""),
        "risk": manifest.get("risk", ""),
        "tags": _strings(manifest.get("tags")),
        "uses": _strings(manifest.get("uses")),
        "permissions": _strings(manifest.get("permissions")),
        "actions": _strings(manifest.get("actions")),
        "accepts": _strings(manifest.get("accepts")),
        "produces": _strings(manifest.get("produces")),
        "readiness": _strings(manifest.get("readiness")),
        "summary": str(manifest.get("summary", "") or ""),
        "notes": str(manifest.get("notes", "") or ""),
    }


def _contract_summary(value: Any) -> dict[str, Any]:
    contract = _dict(value)
    handoffs = _dict(contract.get("handoffs"))
    boundaries = _dict(contract.get("boundaries"))
    lifecycle = _dict(contract.get("lifecycle"))
    return {
        "id": contract.get("id", ""),
        "version": contract.get("version", ""),
        "provides": _strings(contract.get("provides")),
        "consumes": _strings(contract.get("consumes")),
        "permissions": _strings(contract.get("permissions")),
        "handoffs": {
            "emits": _strings(handoffs.get("emits")),
            "accepts": _strings(handoffs.get("accepts")),
        },
        "lifecycle": lifecycle,
        "boundaries": {
            "writes": _strings(boundaries.get("writes")),
            "refuses": _strings(boundaries.get("refuses")),
        },
    }


def _module_summary(module: dict[str, Any]) -> dict[str, Any]:
    contract = _dict(module.get("contract"))
    manifest = _dict(module.get("manifest"))
    return {
        "id": str(module.get("id", "")),
        "name": str(module.get("name", "") or ""),
        "status": str(module.get("status", "") or ""),
        "kind": str(module.get("kind", "") or ""),
        "audience": str(module.get("audience", "") or ""),
        "source_path": str(module.get("source_path", "") or ""),
        "entry_path": str(module.get("entry_path", "") or ""),
        "tests": _strings(module.get("tests")),
        "verified_at": module.get("verified_at"),
        "freshness": _dict(module.get("freshness")),
        "promotion": _dict(module.get("promotion")),
        "manifest": {
            "path": str(manifest.get("path", "") or ""),
            "declared_sha256": str(manifest.get("sha256", "") or ""),
            "valid": manifest.get("valid"),
            "errors": _list(manifest.get("errors")),
        },
        "contract": {
            "path": str(contract.get("path", "") or ""),
            "present": contract.get("present"),
            "valid": contract.get("valid"),
            "provides": _strings(contract.get("provides")),
            "consumes": _strings(contract.get("consumes")),
            "errors": _list(contract.get("errors")),
        },
    }


def _stable_catalog_payload(catalog: dict[str, Any]) -> dict[str, Any]:
    return {
        "catalog_version": catalog.get("catalog_version"),
        "module_registry": catalog.get("module_registry"),
        "global_truth": catalog.get("global_truth"),
        "source_files": catalog.get("source_files"),
        "modules": catalog.get("modules"),
    }


def build_enrichment_catalog(repository_root: str | Path) -> dict[str, Any]:
    root = Path(repository_root)
    if root.is_symlink():
        raise ValueError(f"Enrichment repository root may not be a symbolic link: {root}")
    root = root.resolve(strict=True)
    if not root.is_dir():
        raise ValueError(f"Enrichment repository root is not a directory: {root}")

    modules_rel = "registry/modules.json"
    modules_path = _resolve_repo_file(root, modules_rel)
    modules_doc = load_json(modules_path)
    if modules_doc.get("schema") != AXM_PUBLIC_MODULES_SCHEMA:
        raise ValueError(
            f"Unsupported AXM module registry schema: {modules_doc.get('schema')!r}; "
            f"expected {AXM_PUBLIC_MODULES_SCHEMA!r}"
        )
    modules = _list(modules_doc.get("modules"))
    if not modules:
        raise ValueError("AXM public module registry contains no modules")

    status_rel = "registry/public-status.json"
    proofs_rel = "registry/proofs.json"
    status_candidate = root / status_rel
    proofs_candidate = root / proofs_rel

    global_truth = {
        "verification_state": "UNVERIFIED_GLOBAL_CONTEXT",
        "release_status": None,
        "source_digest": None,
        "public_safe_is_runnable": None,
        "declaration_is_runtime_proof": None,
        "selftest_is_human_approval": None,
        "automatic_promotion": None,
        "canon_requires_human_merge_gate": None,
        "discovery_structure_proves": [],
        "discovery_structure_does_not_prove": [],
        "public_status": None,
        "proof_registry": None,
    }

    source_files: dict[str, dict[str, Any]] = {
        modules_rel: _evidence_ref("module_registry", modules_rel, modules_path),
    }

    if status_candidate.is_file() and proofs_candidate.is_file():
        status_path = _resolve_repo_file(root, status_rel)
        proofs_path = _resolve_repo_file(root, proofs_rel)
        status_doc = load_json(status_path)
        proofs_doc = load_json(proofs_path)

        if status_doc.get("schema") != "axm.public-status/v1":
            raise ValueError(
                f"Unsupported AXM public-status schema: {status_doc.get('schema')!r}"
            )
        if proofs_doc.get("schema") != "axm.public-proofs/v1":
            raise ValueError(
                f"Unsupported AXM public-proofs schema: {proofs_doc.get('schema')!r}"
            )

        discovery_claim = next(
            (
                item for item in _list(proofs_doc.get("claims"))
                if isinstance(item, dict) and item.get("id") == "discovery-structure"
            ),
            {},
        )
        status_truth = _dict(status_doc.get("truth"))
        global_truth = {
            "verification_state": "SOURCE_PRESENT",
            "release_status": status_doc.get("release_status"),
            "source_digest": status_doc.get("source_digest"),
            "public_safe_is_runnable": status_truth.get("public_safe_is_runnable"),
            "declaration_is_runtime_proof": status_truth.get("declaration_is_runtime_proof"),
            "selftest_is_human_approval": status_truth.get("selftest_is_human_approval"),
            "automatic_promotion": status_truth.get("automatic_promotion"),
            "canon_requires_human_merge_gate": status_truth.get("canon_requires_human_merge_gate"),
            "discovery_structure_proves": _list(_dict(discovery_claim).get("proves")),
            "discovery_structure_does_not_prove": _list(
                _dict(discovery_claim).get("does_not_prove")
            ),
            "public_status": {
                "relative_path": status_rel,
                "sha256": _sha256_file(status_path),
            },
            "proof_registry": {
                "relative_path": proofs_rel,
                "sha256": _sha256_file(proofs_path),
            },
        }
        source_files[status_rel] = _evidence_ref("public_status", status_rel, status_path)
        source_files[proofs_rel] = _evidence_ref("public_proofs", proofs_rel, proofs_path)
    elif status_candidate.exists() or proofs_candidate.exists():
        raise ValueError(
            "Public status/proof context is incomplete: both registry/public-status.json "
            "and registry/proofs.json must be present together."
        )
    module_map: dict[str, dict[str, Any]] = {}
    issues: list[str] = []

    for raw_module in modules:
        if not isinstance(raw_module, dict) or not raw_module.get("id"):
            issues.append("Module registry contains an entry without an id")
            continue
        module_id = str(raw_module["id"])
        if module_id in module_map:
            issues.append(f"Duplicate module id in public module registry: {module_id}")
            continue

        entry = {
            "module": _module_summary(raw_module),
            "manifest": None,
            "contract": None,
            "evidence_sources": [source_files[modules_rel]],
            "issues": [],
        }

        manifest_meta = _dict(raw_module.get("manifest"))
        manifest_rel = str(manifest_meta.get("path", "") or "")
        if manifest_rel:
            try:
                path = _resolve_repo_file(root, manifest_rel)
                evidence = _evidence_ref("module_manifest", manifest_rel, path)
                source_files.setdefault(manifest_rel, evidence)
                manifest_doc = load_json(path)
                summary = _manifest_summary(manifest_doc)
                entry["manifest"] = {
                    **summary,
                    "relative_path": manifest_rel,
                    "sha256": evidence["sha256"],
                }
                entry["evidence_sources"].append(evidence)
                declared_sha = str(manifest_meta.get("sha256", "") or "")
                if declared_sha and declared_sha != evidence["sha256"]:
                    entry["issues"].append(
                        f"Manifest SHA-256 mismatch: modules.json={declared_sha} bytes={evidence['sha256']}"
                    )
                if summary.get("id") and summary["id"] != module_id:
                    entry["issues"].append(
                        f"Manifest id mismatch: registry={module_id!r} manifest={summary['id']!r}"
                    )
                module_status = str(raw_module.get("status", "") or "")
                manifest_status = str(summary.get("status", "") or "")
                if module_status and manifest_status and module_status != manifest_status:
                    entry["issues"].append(
                        f"Manifest status mismatch: registry={module_status!r} manifest={manifest_status!r}"
                    )
            except Exception as exc:
                entry["issues"].append(f"Manifest unavailable/invalid: {exc}")

        contract_meta = _dict(raw_module.get("contract"))
        contract_rel = str(contract_meta.get("path", "") or "")
        if contract_rel:
            try:
                path = _resolve_repo_file(root, contract_rel)
                evidence = _evidence_ref("module_contract", contract_rel, path)
                source_files.setdefault(contract_rel, evidence)
                contract_doc = load_json(path)
                summary = _contract_summary(contract_doc)
                entry["contract"] = {
                    **summary,
                    "relative_path": contract_rel,
                    "sha256": evidence["sha256"],
                }
                entry["evidence_sources"].append(evidence)
                if summary.get("id") and summary["id"] != module_id:
                    entry["issues"].append(
                        f"Contract id mismatch: registry={module_id!r} contract={summary['id']!r}"
                    )
                index_provides = set(entry["module"]["contract"]["provides"])
                actual_provides = set(summary["provides"])
                if index_provides != actual_provides:
                    entry["issues"].append(
                        "Module registry contract.provides differs from referenced contract bytes"
                    )
                index_consumes = set(entry["module"]["contract"]["consumes"])
                actual_consumes = set(summary["consumes"])
                if index_consumes != actual_consumes:
                    entry["issues"].append(
                        "Module registry contract.consumes differs from referenced contract bytes"
                    )
            except Exception as exc:
                entry["issues"].append(f"Contract unavailable/invalid: {exc}")

        entry["evidence_sources"] = sorted(
            {item["relative_path"]: item for item in entry["evidence_sources"]}.values(),
            key=lambda item: (item["role"], item["relative_path"]),
        )
        module_map[module_id] = entry

    source_file_list = sorted(source_files.values(), key=lambda item: item["relative_path"])
    source_seal_hash = canonical_sha256(source_file_list)
    catalog = {
        "catalog_version": CATALOG_VERSION,
        "repository_root_at_generation": str(root),
        "module_registry": {
            "schema": modules_doc.get("schema"),
            "relative_path": modules_rel,
            "sha256": source_files[modules_rel]["sha256"],
            "generated_at": modules_doc.get("generated_at"),
            "source": _dict(modules_doc.get("source")),
            "summary": _dict(modules_doc.get("summary")),
            "truth": _dict(modules_doc.get("truth")),
        },
        "global_truth": global_truth,
        "source_files": source_file_list,
        "source_seal_hash": source_seal_hash,
        "modules": dict(sorted(module_map.items())),
        "issues": sorted(issues),
    }
    catalog["catalog_hash"] = canonical_sha256(_stable_catalog_payload(catalog))
    catalog["summary"] = {
        "module_count": len(module_map),
        "source_file_count": len(source_file_list),
        "module_issue_count": sum(bool(item.get("issues")) for item in module_map.values()),
        "catalog_issue_count": len(issues),
        "declared_capability_count": _dict(modules_doc.get("summary")).get("capabilities"),
        "global_truth_verification_state": global_truth.get("verification_state"),
    }
    return catalog


def verify_enrichment_catalog(repository_root: str | Path, catalog: dict[str, Any]) -> dict[str, Any]:
    from .validators import validate_enrichment_catalog

    root = Path(repository_root)
    issues: list[str] = [f"schema: {item}" for item in validate_enrichment_catalog(catalog)]
    expected_files = {
        str(item.get("relative_path", "")): item
        for item in _list(catalog.get("source_files"))
        if isinstance(item, dict) and item.get("relative_path")
    }
    missing: list[str] = []
    changed: list[dict[str, Any]] = []

    if catalog.get("catalog_hash") != canonical_sha256(_stable_catalog_payload(catalog)):
        issues.append("Enrichment catalog hash is invalid")
    if catalog.get("source_seal_hash") != canonical_sha256(
        sorted(expected_files.values(), key=lambda item: item["relative_path"])
    ):
        issues.append("Enrichment source seal hash is invalid")

    for relative, expected in sorted(expected_files.items()):
        try:
            path = _resolve_repo_file(root, relative)
        except Exception:
            missing.append(relative)
            continue
        actual_hash = _sha256_file(path)
        actual_bytes = path.stat().st_size
        if actual_hash != expected.get("sha256") or actual_bytes != expected.get("bytes"):
            changed.append({
                "relative_path": relative,
                "expected_sha256": expected.get("sha256"),
                "observed_sha256": actual_hash,
                "expected_bytes": expected.get("bytes"),
                "observed_bytes": actual_bytes,
            })

    if missing:
        issues.append(f"{len(missing)} enrichment source file(s) are missing")
    if changed:
        issues.append(f"{len(changed)} enrichment source file(s) changed")

    return {
        "valid": not issues,
        "catalog_hash": catalog.get("catalog_hash", ""),
        "source_seal_hash": catalog.get("source_seal_hash", ""),
        "missing_files": missing,
        "changed_files": changed,
        "issues": issues,
    }



_HUMANIZATION_STOPWORDS = {
    "axm", "capability", "service", "tool", "module", "api", "v1", "v2",
    "v0", "the", "and", "or", "to", "of", "a", "an",
}


def _human_tokens(value: str) -> list[str]:
    tokens = []
    for token in re.findall(r"[a-z0-9]+", str(value).casefold()):
        if token in _HUMANIZATION_STOPWORDS or re.fullmatch(r"v\d+", token):
            continue
        # Tiny deterministic normalization for human wording candidates only.
        # It is deliberately not a semantic parser.
        if len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
            token = token[:-1]
        tokens.append(token)
    return tokens


def _human_label_from_id(capability_id: str) -> str:
    parts = [part for part in re.split(r"[:./_-]+", capability_id) if part]
    return " ".join(part.upper() if part.isupper() else part.capitalize() for part in parts)


def _action_candidates(
    capability_id: str,
    provider_contexts: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    cap_tokens = set(_human_tokens(capability_id))
    if not cap_tokens:
        return []
    candidates = []
    for provider in provider_contexts:
        manifest = _dict(provider.get("manifest"))
        actions = _strings(manifest.get("actions"))
        for action in actions:
            action_tokens = set(_human_tokens(action))
            shared = sorted(cap_tokens & action_tokens)
            if not shared:
                continue
            score = round(len(shared) / max(1, len(cap_tokens)), 4)
            candidates.append({
                "module_id": provider.get("module_id", ""),
                "action": action,
                "score": score,
                "shared_tokens": shared,
                "claim_status": "CONTEXT_CANDIDATE_NOT_CAPABILITY_FACT",
                "evidence_reference": {
                    "relative_path": manifest.get("relative_path", ""),
                    "sha256": manifest.get("sha256", ""),
                },
            })
    candidates.sort(
        key=lambda item: (-float(item["score"]), str(item["module_id"]), str(item["action"]))
    )
    return candidates[:3]


def _humanization_seed(
    capability_id: str,
    registry_role: dict[str, Any],
    provider_contexts: list[dict[str, Any]],
    consumer_contexts: list[dict[str, Any]],
    proof_ceiling: dict[str, Any],
) -> dict[str, Any]:
    classification = str(registry_role.get("classification", "UNBOUND"))
    providers = [
        {
            "module_id": item.get("module_id", ""),
            "name": _dict(item.get("module")).get("name", ""),
            "summary": _dict(item.get("manifest")).get("summary", ""),
            "join_status": item.get("join_status", ""),
        }
        for item in provider_contexts
    ]
    consumers = [
        {
            "module_id": item.get("module_id", ""),
            "name": _dict(item.get("module")).get("name", ""),
            "join_status": item.get("join_status", ""),
        }
        for item in consumer_contexts
    ]

    if classification == "PROVIDED_ONLY":
        orientation = (
            "AXM declares this identifier as a provided capability. "
            "Provider/module context can orient human wording but does not by itself define capability-specific behavior."
        )
    elif classification == "PROVIDED_AND_CONSUMED":
        orientation = (
            "AXM declares this identifier as both provided and consumed. "
            "Treat it as an AXM capability that also participates as a dependency/interface elsewhere."
        )
    elif classification == "CONSUMER_ONLY_DEPENDENCY":
        orientation = (
            "AXM currently declares this identifier only as something consumed by modules. "
            "Present it as a dependency/reference, not as an AXM-provided human ability."
        )
    else:
        orientation = (
            "This registry identifier has no declared provider or consumer relation and requires review before human presentation."
        )

    return {
        "display_label": _human_label_from_id(capability_id),
        "registry_role": registry_role,
        "orientation": orientation,
        "providers": providers,
        "consumers": consumers,
        "action_candidates": _action_candidates(capability_id, provider_contexts),
        "proof_ceiling": proof_ceiling,
        "wording_policy": (
            "Candidate context may improve human wording, but module-wide text must not be promoted "
            "to capability-specific KNOWN facts without capability-specific evidence."
        ),
    }

def _registry_context(record: dict[str, Any]) -> dict[str, Any]:
    return _dict(record.get("registry_context"))


def _provider_status_map(context: dict[str, Any]) -> dict[str, str]:
    result: dict[str, str] = {}
    for item in _list(context.get("provider_statuses")):
        if isinstance(item, dict) and item.get("id"):
            result[str(item["id"])] = str(item.get("status", "") or "")
    return result


def _compact_module_context(
    module_id: str,
    entry: dict[str, Any],
    capability_id: str,
    role: str,
    registry_status: str = "",
) -> dict[str, Any]:
    module = _dict(entry.get("module"))
    manifest = _dict(entry.get("manifest"))
    contract = _dict(entry.get("contract"))
    module_contract = _dict(module.get("contract"))

    relation = "provides" if role == "provider" else "consumes"
    index_values = set(_strings(module_contract.get(relation)))
    contract_values = set(_strings(contract.get(relation)))
    index_match = capability_id in index_values
    contract_present = bool(contract)
    contract_match = capability_id in contract_values if contract_present else None

    issues = list(entry.get("issues", []))
    if not index_match:
        issues.append(f"Public module registry does not list capability as {role} relation")
    if contract_present and contract_match is False:
        issues.append(f"Referenced module contract does not list capability as {role} relation")
    if role == "provider" and registry_status and module.get("status") and registry_status != module.get("status"):
        issues.append(
            f"Provider status mismatch: capability registry={registry_status!r} module registry={module.get('status')!r}"
        )

    conflict_terms = ("mismatch", "differs", "does not list")
    if any(any(term in issue.lower() for term in conflict_terms) for issue in issues):
        join_status = "CONFLICTED"
    elif index_match and contract_match is True:
        join_status = "VERIFIED"
    elif index_match:
        join_status = "PARTIAL"
    else:
        join_status = "UNRESOLVED"

    return {
        "module_id": module_id,
        "role": role,
        "join_status": join_status,
        "registry_status": registry_status,
        "module": {
            "name": module.get("name", ""),
            "status": module.get("status", ""),
            "kind": module.get("kind", ""),
            "audience": module.get("audience", ""),
            "source_path": module.get("source_path", ""),
            "entry_path": module.get("entry_path", ""),
            "tests": _strings(module.get("tests")),
            "freshness": _dict(module.get("freshness")),
            "promotion": _dict(module.get("promotion")),
        },
        "manifest": {
            key: manifest.get(key)
            for key in (
                "relative_path", "sha256", "name", "version", "status", "kind",
                "category", "layer", "audience", "risk", "tags", "uses",
                "permissions", "actions", "accepts", "produces", "readiness",
                "summary", "notes",
            )
            if key in manifest
        },
        "contract": {
            key: contract.get(key)
            for key in (
                "relative_path", "sha256", "version", "provides", "consumes",
                "permissions", "handoffs", "lifecycle", "boundaries",
            )
            if key in contract
        },
        "join_checks": {
            "module_registry_relation_match": index_match,
            "contract_relation_match": contract_match,
        },
        "evidence_sources": deepcopy(_list(entry.get("evidence_sources"))),
        "issues": sorted(set(str(issue) for issue in issues)),
    }


def enrich_normalized_record(record: dict[str, Any], catalog: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    enriched = deepcopy(record)
    capability_id = str(enriched.get("capability_id", ""))
    context = _registry_context(enriched)
    modules = _dict(catalog.get("modules"))

    providers = _strings(context.get("providers"))
    consumers = _strings(context.get("consumers"))
    provider_statuses = _provider_status_map(context)
    registry_role = _dict(context.get("registry_role")) or classify_registry_role({
        "providers": providers,
        "consumers": consumers,
    })
    proof_ceiling = _dict(catalog.get("global_truth"))
    provider_contexts: list[dict[str, Any]] = []
    consumer_contexts: list[dict[str, Any]] = []
    unresolved_modules: list[dict[str, str]] = []

    for module_id in providers:
        entry = _dict(modules.get(module_id))
        if not entry:
            unresolved_modules.append({"module_id": module_id, "role": "provider"})
            provider_contexts.append({
                "module_id": module_id,
                "role": "provider",
                "join_status": "UNRESOLVED",
                "registry_status": provider_statuses.get(module_id, ""),
                "issues": ["Provider module is absent from registry/modules.json"],
                "evidence_sources": [],
            })
        else:
            provider_contexts.append(
                _compact_module_context(module_id, entry, capability_id, "provider", provider_statuses.get(module_id, ""))
            )

    for module_id in consumers:
        entry = _dict(modules.get(module_id))
        if not entry:
            unresolved_modules.append({"module_id": module_id, "role": "consumer"})
            consumer_contexts.append({
                "module_id": module_id,
                "role": "consumer",
                "join_status": "UNRESOLVED",
                "issues": ["Consumer module is absent from registry/modules.json"],
                "evidence_sources": [],
            })
        else:
            consumer_contexts.append(_compact_module_context(module_id, entry, capability_id, "consumer"))

    all_contexts = provider_contexts + consumer_contexts
    statuses = [str(item.get("join_status", "")) for item in all_contexts]
    if any(status == "CONFLICTED" for status in statuses):
        overall = "CONFLICTED"
    elif any(status in {"UNRESOLVED", "PARTIAL"} for status in statuses):
        overall = "PARTIAL"
    elif all_contexts:
        overall = "VERIFIED"
    else:
        overall = "NO_MODULE_RELATION"

    evidence_sources: dict[str, dict[str, Any]] = {}
    for item in all_contexts:
        for source in _list(item.get("evidence_sources")):
            if isinstance(source, dict) and source.get("relative_path"):
                evidence_sources[str(source["relative_path"])] = source

    enrichment_context = {
        "enrichment_version": "0.2.0",
        "source_schema": context.get("schema", ""),
        "status": overall,
        "registry_role": registry_role,
        "providers": provider_contexts,
        "consumers": consumer_contexts,
        "registry_truth": _dict(context.get("truth")),
        "proof_ceiling": proof_ceiling,
        "humanization_seed": _humanization_seed(
            capability_id,
            registry_role,
            provider_contexts,
            consumer_contexts,
            proof_ceiling,
        ),
        "catalog_hash": catalog.get("catalog_hash", ""),
        "source_seal_hash": catalog.get("source_seal_hash", ""),
        "evidence_sources": sorted(
            evidence_sources.values(),
            key=lambda item: (str(item.get("role", "")), str(item.get("relative_path", ""))),
        ),
    }
    enrichment_context["enrichment_hash"] = canonical_sha256(enrichment_context)
    enriched["enrichment_context"] = enrichment_context

    ref = _dict(enriched.get("source_reference"))
    ref["enrichment_status"] = overall
    ref["enrichment_catalog_hash"] = catalog.get("catalog_hash", "")
    ref["enrichment_source_seal_hash"] = catalog.get("source_seal_hash", "")
    ref["enrichment_hash"] = enrichment_context["enrichment_hash"]
    ref["enrichment_sources"] = enrichment_context["evidence_sources"]
    ref["registry_role"] = registry_role
    ref["proof_ceiling"] = proof_ceiling
    enriched["source_reference"] = ref

    trace = _dict(enriched.get("adapter_trace"))
    trace["enrichment"] = {
        "engine": "axm-public-module-contract-enrichment-v2",
        "status": overall,
        "provider_count": len(provider_contexts),
        "consumer_count": len(consumer_contexts),
        "unresolved_modules": unresolved_modules,
        "catalog_hash": catalog.get("catalog_hash", ""),
        "enrichment_hash": enrichment_context["enrichment_hash"],
        "registry_role": registry_role,
    }
    enriched["adapter_trace"] = trace

    report = {
        "capability_id": capability_id,
        "status": overall,
        "provider_count": len(provider_contexts),
        "consumer_count": len(consumer_contexts),
        "verified_join_count": sum(item.get("join_status") == "VERIFIED" for item in all_contexts),
        "partial_join_count": sum(item.get("join_status") == "PARTIAL" for item in all_contexts),
        "conflicted_join_count": sum(item.get("join_status") == "CONFLICTED" for item in all_contexts),
        "unresolved_join_count": sum(item.get("join_status") == "UNRESOLVED" for item in all_contexts),
        "enrichment_hash": enrichment_context["enrichment_hash"],
        "registry_role": registry_role.get("classification", "UNBOUND"),
        "human_surface": registry_role.get("human_surface", "REVIEW_HOLD"),
        "action_candidate_count": len(
            _dict(enrichment_context.get("humanization_seed")).get("action_candidates", [])
        ),
        "provider_modules": [item.get("module_id") for item in provider_contexts],
        "consumer_modules": [item.get("module_id") for item in consumer_contexts],
    }
    return enriched, report


def build_enrichment_report(
    catalog: dict[str, Any],
    records: list[dict[str, Any]],
    *,
    pre_verification: dict[str, Any] | None = None,
    post_verification: dict[str, Any] | None = None,
) -> dict[str, Any]:
    statuses: dict[str, int] = {}
    roles: dict[str, int] = {}
    for item in records:
        status = str(item.get("status", "UNKNOWN"))
        statuses[status] = statuses.get(status, 0) + 1
        role = str(item.get("registry_role", "UNBOUND"))
        roles[role] = roles.get(role, 0) + 1
    return {
        "report_version": "0.1.0",
        "engine": "axm-public-module-contract-enrichment-v2",
        "catalog_hash": catalog.get("catalog_hash", ""),
        "source_seal_hash": catalog.get("source_seal_hash", ""),
        "global_truth": _dict(catalog.get("global_truth")),
        "catalog_summary": _dict(catalog.get("summary")),
        "pre_verification": pre_verification or {},
        "post_verification": post_verification or {},
        "summary": {
            "record_count": len(records),
            "status_counts": dict(sorted(statuses.items())),
            "registry_role_counts": dict(sorted(roles.items())),
            "provider_backed_record_count": (
                roles.get("PROVIDED_ONLY", 0) + roles.get("PROVIDED_AND_CONSUMED", 0)
            ),
            "consumer_only_dependency_count": roles.get("CONSUMER_ONLY_DEPENDENCY", 0),
            "unbound_record_count": roles.get("UNBOUND", 0),
            "verified_record_count": statuses.get("VERIFIED", 0),
            "partial_record_count": statuses.get("PARTIAL", 0),
            "conflicted_record_count": statuses.get("CONFLICTED", 0),
            "no_module_relation_count": statuses.get("NO_MODULE_RELATION", 0),
            "verified_join_count": sum(int(item.get("verified_join_count", 0)) for item in records),
            "partial_join_count": sum(int(item.get("partial_join_count", 0)) for item in records),
            "conflicted_join_count": sum(int(item.get("conflicted_join_count", 0)) for item in records),
            "unresolved_join_count": sum(int(item.get("unresolved_join_count", 0)) for item in records),
        },
        "records": records,
        "integrity_notes": [
            "Provider and consumer module IDs are never inserted into capability-to-capability relationship fields.",
            "Module-wide accepts/produces/actions/risk are preserved as provider context, not silently promoted to capability-specific KNOWN facts.",
            "A VERIFIED enrichment join proves declaration consistency across registry/module contract surfaces; it does not prove runtime execution.",
            "Consumer-only registry identifiers are dependency/reference records and are not counted as AXM-provided human capabilities.",
            "Humanization action matches are deterministic wording candidates only, never capability facts.",
        ],
    }
