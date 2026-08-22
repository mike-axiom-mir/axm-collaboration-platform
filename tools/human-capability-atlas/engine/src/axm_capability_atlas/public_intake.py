from __future__ import annotations

from pathlib import Path
from typing import Any

from . import __version__, PUBLIC_INTAKE_IN_PROGRESS_MARKER

from .batching import build_batch_plan, verify_batch_plan
from .ingest import ingest_path
from .io import load_json, save_json, remove_file_durable
from .source_seal import build_source_seal
from .discovery_integrity import build_discovery_integrity_report
from .validators import (
    validate_source_seal, validate_batch_plan, validate_discovery_integrity_report,
    validate_public_intake_preflight,
)
from .public_preflight import (
    PREFLIGHT_FILENAME, build_public_intake_preflight, verify_public_intake_preflight,
)


def prepare_axm_public_intake(
    repository_root: str | Path,
    output_dir: str | Path,
    *,
    batch_size: int = 100,
    allow_dirty_repository: bool = False,
) -> dict[str, Any]:
    """Prepare the generated AXM public capability registry for production.

    This is the deterministic front door for the current repository layout:
      registry/capabilities.jsonl  -> capability identities/provider routing
      registry/modules.json       -> module inventory/contract pointers
      referenced manifests/contracts -> provider/consumer context

    It deliberately normalizes/enriches first and only creates a batch plan when
    registry count, source seal, enrichment evidence, and structural intake gate
    all agree. It does not build all cards or claim Merge Gate acceptance.
    """
    repo = Path(repository_root)
    if repo.is_symlink():
        raise ValueError(f"Repository root may not be a symbolic link: {repo}")
    repo = repo.resolve(strict=True)
    if not repo.is_dir():
        raise ValueError(f"Repository root is not a directory: {repo}")

    capability_registry = repo / "registry" / "capabilities.jsonl"
    module_registry = repo / "registry" / "modules.json"
    if not capability_registry.is_file():
        raise FileNotFoundError(f"AXM capability registry not found: {capability_registry}")
    if not module_registry.is_file():
        raise FileNotFoundError(f"AXM module registry not found: {module_registry}")

    output = Path(output_dir)
    if output.is_symlink():
        raise ValueError(f"Public intake output may not be a symbolic link: {output}")
    output_resolved = output.resolve()
    if output_resolved == repo or repo in output_resolved.parents:
        raise ValueError(
            "Public intake output may not be the repository or a descendant of it. "
            "Use a separate staging directory so intake never pollutes source."
        )
    output.mkdir(parents=True, exist_ok=True)
    # Invalidate any earlier preparation/plan before beginning a new attempt.
    remove_file_durable(output / "batch_plan.json")
    remove_file_durable(output / PREFLIGHT_FILENAME)
    remove_file_durable(output / "AXM_PUBLIC_INTAKE_SUMMARY.json")
    public_marker = output / PUBLIC_INTAKE_IN_PROGRESS_MARKER
    save_json(public_marker, {
        "public_intake_state_version": "0.1.0",
        "state": "IN_PROGRESS",
        "module_version": __version__,
        "repository_root": str(repo),
    })

    analysis_dir = output / "analysis"
    report_dir = output / "reports"
    analysis_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)

    discovery = build_discovery_integrity_report(repo)
    discovery_schema_errors = validate_discovery_integrity_report(discovery)
    if discovery_schema_errors:
        raise ValueError(
            "Discovery integrity report schema failed: "
            + "; ".join(discovery_schema_errors)
        )
    discovery_path = analysis_dir / "discovery_integrity_report.json"
    save_json(discovery_path, discovery)

    seal = build_source_seal(capability_registry)
    seal_errors = validate_source_seal(seal)
    if seal_errors:
        raise ValueError("Generated capability-registry source seal is invalid: " + "; ".join(seal_errors))
    seal_path = output / "capability_registry_source_seal.json"
    save_json(seal_path, seal)

    report = ingest_path(
        capability_registry,
        output,
        build_cards=False,
        source_seal=seal,
        enrichment_root=repo,
    )
    gate = load_json(output / "intake_gate_report.json")
    enrichment = report.get("enrichment", {}) if isinstance(report.get("enrichment"), dict) else {}
    enrichment_report_path = enrichment.get("report")
    enrichment_report = load_json(enrichment_report_path) if enrichment_report_path else {}
    catalog_summary = enrichment_report.get("catalog_summary", {}) if isinstance(enrichment_report, dict) else {}

    accepted = int(report.get("summary", {}).get("records_accepted", 0) or 0)
    raw_found = int(report.get("summary", {}).get("records_found", 0) or 0)
    declared_count = catalog_summary.get("declared_capability_count")
    count_matches = (
        isinstance(declared_count, int)
        and declared_count == accepted
        and raw_found == accepted
    )

    blockers: list[str] = []
    warnings: list[str] = [str(item) for item in gate.get("warnings", [])]
    if discovery.get("valid") is not True:
        blockers.append("Generated public discovery bundle is stale or inconsistent with tools-index.json.")
        blockers.extend(str(item) for item in discovery.get("issues", []))
    warnings.extend(str(item) for item in discovery.get("warnings", []))

    if gate.get("status") != "READY_FOR_MERGE_REVIEW":
        blockers.extend(str(item) for item in gate.get("blockers", []))
    if not isinstance(declared_count, int):
        blockers.append("registry/modules.json does not declare an integer summary.capabilities count")
    elif declared_count != accepted:
        blockers.append(
            f"Public registry count mismatch: modules.json declares {declared_count}, capabilities.jsonl accepted {accepted}"
        )
    if raw_found != accepted:
        blockers.append(
            f"Capability registry normalization gap: found {raw_found}, accepted {accepted}"
        )
    duplicates = int(report.get("summary", {}).get("duplicate_capability_id_count", 0) or 0)
    if duplicates:
        blockers.append(f"Public capability registry contains {duplicates} duplicate capability ID group(s)")

    enrichment_conflicted = int(report.get("summary", {}).get("enrichment_conflicted_count", 0) or 0)
    enrichment_partial = int(report.get("summary", {}).get("enrichment_partial_count", 0) or 0)
    if enrichment_conflicted:
        blockers.append(
            f"{enrichment_conflicted} capability record(s) have conflicting provider/module enrichment evidence."
        )
    if enrichment_partial:
        warnings.append(
            f"{enrichment_partial} capability record(s) have partial provider/module enrichment and will retain UNKNOWN context."
        )

    role_counts = discovery.get("role_counts", {}) if isinstance(discovery.get("role_counts"), dict) else {}
    provider_backed = int(role_counts.get("PROVIDED_ONLY", 0) or 0) + int(
        role_counts.get("PROVIDED_AND_CONSUMED", 0) or 0
    )
    consumer_only = int(role_counts.get("CONSUMER_ONLY_DEPENDENCY", 0) or 0)
    unbound = int(role_counts.get("UNBOUND", 0) or 0)
    if unbound:
        blockers.append(
            f"{unbound} public registry identifier(s) have neither providers nor consumers and require review."
        )

    enrichment_records = (
        enrichment_report.get("records", [])
        if isinstance(enrichment_report, dict)
        and isinstance(enrichment_report.get("records"), list)
        else []
    )
    accepted_records_data = load_json(report_dir / "accepted_records.json")
    accepted_ids = [
        str(item.get("capability_id"))
        for item in accepted_records_data
        if isinstance(item, dict) and item.get("capability_id")
    ]
    enrichment_ids = [
        str(item.get("capability_id"))
        for item in enrichment_records
        if isinstance(item, dict) and item.get("capability_id")
    ]
    human_targets = sorted(
        str(item.get("capability_id"))
        for item in enrichment_records
        if isinstance(item, dict)
        and item.get("registry_role") in {"PROVIDED_ONLY", "PROVIDED_AND_CONSUMED"}
        and item.get("capability_id")
    )
    dependency_targets = sorted(
        str(item.get("capability_id"))
        for item in enrichment_records
        if isinstance(item, dict)
        and item.get("registry_role") == "CONSUMER_ONLY_DEPENDENCY"
        and item.get("capability_id")
    )
    review_targets = sorted(
        str(item.get("capability_id"))
        for item in enrichment_records
        if isinstance(item, dict)
        and item.get("registry_role") == "UNBOUND"
        and item.get("capability_id")
    )
    save_json(
        report_dir / "human_capability_targets.json",
        {
            "target_type": "AXM_PROVIDER_BACKED_HUMAN_CAPABILITY",
            "count": len(human_targets),
            "capability_ids": human_targets,
        },
    )
    save_json(
        report_dir / "dependency_reference_targets.json",
        {
            "target_type": "CONSUMER_ONLY_DEPENDENCY_REFERENCE",
            "count": len(dependency_targets),
            "capability_ids": dependency_targets,
        },
    )
    save_json(
        report_dir / "registry_role_review_targets.json",
        {
            "target_type": "UNBOUND_REGISTRY_IDENTIFIER_REVIEW",
            "count": len(review_targets),
            "capability_ids": review_targets,
        },
    )

    # The role-target files must be an exact, unique, non-overlapping partition
    # of accepted public registry identifiers. A pretty count is not enough.
    accepted_set = set(accepted_ids)
    human_set = set(human_targets)
    dependency_set = set(dependency_targets)
    review_set = set(review_targets)
    if len(accepted_ids) != len(accepted_set):
        blockers.append("Accepted public registry capability IDs are not unique")
    if len(enrichment_ids) != len(set(enrichment_ids)):
        blockers.append("Enrichment report capability IDs are not unique")
    if set(enrichment_ids) != accepted_set:
        blockers.append("Enrichment report membership does not exactly match accepted normalized records")
    if human_set & dependency_set or human_set & review_set or dependency_set & review_set:
        blockers.append("Public registry role target lists overlap")
    partition_union = human_set | dependency_set | review_set
    if partition_union != accepted_set:
        blockers.append("Public registry role target lists do not exactly cover accepted records")
    if len(human_targets) != provider_backed:
        blockers.append("Provider-backed target count disagrees with discovery role counts")
    if len(dependency_targets) != consumer_only:
        blockers.append("Dependency-reference target count disagrees with discovery role counts")
    if len(review_targets) != unbound:
        blockers.append("Unbound review target count disagrees with discovery role counts")
    if sum(int(value or 0) for value in role_counts.values()) != accepted:
        blockers.append("Discovery registry-role counts do not sum to accepted records")

    counts = {
        "records_found": raw_found,
        "records_accepted": accepted,
        "modules_declared_capability_count": declared_count,
        "duplicate_capability_id_group_count": duplicates,
        "enrichment_verified_count": int(report.get("summary", {}).get("enrichment_verified_count", 0) or 0),
        "enrichment_partial_count": enrichment_partial,
        "enrichment_conflicted_count": enrichment_conflicted,
    }
    role_partition = {
        "registry_role_counts": role_counts,
        "provider_backed_human_capability_count": len(human_targets),
        "consumer_only_dependency_reference_count": len(dependency_targets),
        "unbound_registry_identifier_count": len(review_targets),
        "human_target_count": len(human_targets),
        "dependency_target_count": len(dependency_targets),
        "review_target_count": len(review_targets),
        "partition_complete": partition_union == accepted_set,
        "partition_disjoint": not (human_set & dependency_set or human_set & review_set or dependency_set & review_set),
    }

    preflight_path = output / PREFLIGHT_FILENAME
    preflight = None
    try:
        preflight = build_public_intake_preflight(
            repo,
            output,
            status="READY" if not blockers else "TEST_HOLD_REVIEW",
            blockers=blockers,
            warnings=warnings,
            counts=counts,
            role_partition=role_partition,
            discovery_bundle_hash=str(discovery.get("discovery_bundle_hash", "")),
            source_seal_hash=str(seal.get("seal_hash", "")),
            enrichment_catalog_hash=str(enrichment.get("catalog_hash", "")),
            enrichment_source_seal_hash=str(enrichment.get("source_seal_hash", "")),
            allow_dirty_repository=allow_dirty_repository,
        )
        preflight_errors = validate_public_intake_preflight(preflight)
        if preflight_errors:
            blockers.extend(f"public preflight schema: {item}" for item in preflight_errors)
        else:
            save_json(preflight_path, preflight)
            preflight_verification = verify_public_intake_preflight(
                output, preflight, repository_root=repo, ignore_in_progress=True
            )
            if not preflight_verification["valid"]:
                blockers.extend(preflight_verification["issues"])
        blockers = list(preflight.get("blockers", blockers)) + [
            item for item in blockers if item not in preflight.get("blockers", [])
        ]
        warnings = list(preflight.get("warnings", warnings))
    except Exception as exc:
        blockers.append(f"Public intake preflight could not be sealed: {exc}")

    plan_path = output / "batch_plan.json"
    plan = None
    if not blockers and preflight is not None and preflight.get("status") == "READY":
        plan = build_batch_plan(
            output, batch_size=batch_size, ignore_in_progress=True
        )
        schema_errors = validate_batch_plan(plan)
        semantic = verify_batch_plan(plan)
        if schema_errors or not semantic["valid"]:
            blockers.extend(schema_errors)
            blockers.extend(semantic["issues"])
        else:
            save_json(plan_path, plan)

    status = "READY_FOR_BATCH_PRODUCTION" if not blockers and plan is not None else "TEST_HOLD_REVIEW"
    summary = {
        "operation": "axm_public_registry_intake_prepare",
        "status": status,
        "merge_claim": False,
        "repository_root": str(repo),
        "capability_registry": str(capability_registry),
        "module_registry": str(module_registry),
        "source_seal": str(seal_path),
        "source_seal_hash": seal.get("seal_hash", ""),
        "public_intake_preflight": str(preflight_path) if preflight is not None else "",
        "public_intake_preflight_hash": str(preflight.get("preflight_hash", "")) if preflight else "",
        "repository_snapshot": preflight.get("repository_snapshot", {}) if preflight else {},
        "discovery_integrity_report": str(discovery_path),
        "discovery_integrity_valid": discovery.get("valid") is True,
        "discovery_bundle_hash": discovery.get("discovery_bundle_hash", ""),
        "enrichment_catalog_hash": enrichment.get("catalog_hash", ""),
        "enrichment_source_seal_hash": enrichment.get("source_seal_hash", ""),
        "records_found": raw_found,
        "records_accepted": accepted,
        "modules_declared_capability_count": declared_count,
        "registry_count_matches": count_matches,
        "duplicate_capability_id_group_count": duplicates,
        "enrichment_verified_count": int(report.get("summary", {}).get("enrichment_verified_count", 0) or 0),
        "enrichment_partial_count": int(report.get("summary", {}).get("enrichment_partial_count", 0) or 0),
        "enrichment_conflicted_count": enrichment_conflicted,
        "registry_role_counts": role_counts,
        "provider_backed_human_capability_count": len(human_targets),
        "consumer_only_dependency_reference_count": len(dependency_targets),
        "unbound_registry_identifier_count": len(review_targets),
        "human_capability_targets": str(report_dir / "human_capability_targets.json"),
        "dependency_reference_targets": str(report_dir / "dependency_reference_targets.json"),
        "registry_role_review_targets": str(report_dir / "registry_role_review_targets.json"),
        "batch_plan_scope": "ALL_REGISTRY_IDENTIFIERS_FOR_COMPLETE_PROVENANCE",
        "human_usability_coverage_scope": "PROVIDER_BACKED_REGISTRY_IDENTIFIERS_ONLY",
        "batch_plan": str(plan_path) if plan is not None and not blockers else "",
        "batch_count": int(plan.get("summary", {}).get("batch_count", 0)) if plan else 0,
        "batch_size": batch_size,
        "allow_dirty_repository": bool(allow_dirty_repository),
        "blockers": sorted(set(blockers)),
        "warnings": sorted(set(warnings)),
        "next_action": (
            "Run planned batches and verify each batch receipt; use human_capability_targets.json for the human-facing provider-backed surface."
            if status == "READY_FOR_BATCH_PRODUCTION"
            else "Resolve blockers; do not start mass card production."
        ),
    }
    save_json(output / "AXM_PUBLIC_INTAKE_SUMMARY.json", summary)
    remove_file_durable(public_marker)
    return summary
