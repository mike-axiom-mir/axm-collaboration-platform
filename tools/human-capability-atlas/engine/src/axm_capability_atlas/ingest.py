from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import hashlib
import json
import re

from . import __version__, INGEST_IN_PROGRESS_MARKER
from .adapters import adapt_file, discover_source_files
from .index import build_index
from .io import save_json, load_json, remove_file_durable
from .pipeline import build_from_file
from .validators import validate_source, validate_enrichment_catalog, validate_enrichment_report
from .graph import save_analysis
from .quality import build_quality_report
from .search import build_search_index
from .registry_snapshot import build_registry_snapshot
from .conformance import receipt_matches_source, verify_producer_receipt
from .intake_gate import build_intake_gate_report
from .normalized_inventory import (
    build_normalized_inventory, verify_normalized_inventory,
)
from .validators import validate_intake_gate
from .source_seal import verify_source_seal
from .enrichment import (
    build_enrichment_catalog,
    verify_enrichment_catalog,
    enrich_normalized_record,
    build_enrichment_report,
)


def _safe_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "-", value.strip()).strip("-").lower()
    return cleaned or "unnamed-capability"


def _short_identity(capability_id: str, source_identity: str, pointer: str) -> str:
    """Portable output identity.

    source_identity is repository/source-root relative rather than an absolute
    machine path, so moving an unchanged read-only registry copy does not rename
    every normalized record or break safe resume.
    """
    raw = f"{capability_id}|{source_identity}|{pointer}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:10]


def _portable_source_identity(source_root: Path, source_file: Path) -> str:
    if source_root.is_file():
        return source_file.name
    try:
        return source_file.resolve().relative_to(source_root.resolve()).as_posix()
    except ValueError:
        # discover_source_files already rejects symlink escapes; this is a
        # defensive fallback rather than permission to cross the source root.
        return source_file.name


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ingest_path(
    source_path: str | Path,
    output_dir: str | Path,
    *,
    build_cards: bool = True,
    recursive: bool = True,
    strict: bool = False,
    resume: bool = False,
    source_seal: dict[str, Any] | None = None,
    enrichment_root: str | Path | None = None,
) -> dict[str, Any]:
    """Ingest heterogeneous manifests without modifying their original files."""
    source_root = Path(source_path)
    output_root = Path(output_dir)

    source_resolved = source_root.resolve()
    output_resolved = output_root.resolve()
    if source_root.is_dir() and (
        output_resolved == source_resolved or source_resolved in output_resolved.parents
    ):
        raise ValueError(
            "Output directory may not be the source directory or a descendant of it. "
            "Use a separate staging directory so intake never pollutes the source tree."
        )

    output_root.mkdir(parents=True, exist_ok=True)
    # Invalidate earlier completion evidence before any new intake attempt.
    # If this run fails, the marker remains and downstream production is held.
    remove_file_durable(output_root / "ingestion_report.json")
    remove_file_durable(output_root / "intake_gate_report.json")
    remove_file_durable(output_root / "normalized_inventory.json")
    ingest_marker = output_root / INGEST_IN_PROGRESS_MARKER
    save_json(ingest_marker, {
        "ingest_state_version": "0.1.0",
        "state": "IN_PROGRESS",
        "module_version": __version__,
        "source_path": str(source_root),
    })
    source_seal_pre = verify_source_seal(source_root, source_seal) if source_seal else None
    if source_seal_pre is not None and not source_seal_pre["valid"]:
        raise ValueError("Source seal verification failed before ingestion: " + "; ".join(
            [
                f"missing={source_seal_pre['summary']['missing_count']}",
                f"added={source_seal_pre['summary']['added_count']}",
                f"changed={source_seal_pre['summary']['changed_count']}",
            ]
        ))
    enrichment_catalog = None
    enrichment_pre = None
    enrichment_records: list[dict[str, Any]] = []
    enrichment_error = ""
    if enrichment_root is not None:
        try:
            enrichment_catalog = build_enrichment_catalog(enrichment_root)
            catalog_schema_errors = validate_enrichment_catalog(enrichment_catalog)
            if catalog_schema_errors:
                raise ValueError("Enrichment catalog schema failed: " + "; ".join(catalog_schema_errors))
            enrichment_pre = verify_enrichment_catalog(enrichment_root, enrichment_catalog)
            if not enrichment_pre["valid"]:
                raise ValueError("; ".join(enrichment_pre["issues"]))
        except Exception as exc:
            enrichment_error = str(exc)
            if strict:
                raise

    normalized_dir = output_root / "normalized_sources"
    generated_dir = output_root / "generated"
    report_dir = output_root / "reports"
    normalized_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)
    if build_cards:
        generated_dir.mkdir(parents=True, exist_ok=True)

    started = _utc_now()
    files = discover_source_files(source_root, recursive=recursive)
    file_reports: list[dict[str, Any]] = []
    rejected_records: list[dict[str, Any]] = []
    accepted_records: list[dict[str, Any]] = []
    cards: list[dict[str, Any]] = []
    cards_reused = 0
    receipt_failures = 0
    adapter_usage: Counter[str] = Counter()
    format_usage: Counter[str] = Counter()
    capability_sources: dict[str, list[dict[str, str]]] = defaultdict(list)

    for source_file in files:
        file_report: dict[str, Any] = {
            "source_file": str(source_file),
            "status": "processed",
            "detection": None,
            "records_found": 0,
            "accepted": 0,
            "rejected": 0,
            "cards_built": 0,
            "cards_reused": 0,
            "errors": [],
        }
        try:
            detection, adapted = adapt_file(source_file)
            file_report["detection"] = detection.to_dict()
            file_report["records_found"] = len(adapted)
            format_usage[detection.format_id] += 1
            if detection.format_id == "unknown":
                file_report["status"] = "unrecognized"
                file_report["errors"].append(detection.reason)
                if strict:
                    raise ValueError(detection.reason)
                file_reports.append(file_report)
                continue

            for item in adapted:
                adapter_usage[item.adapter_id] += 1
                if item.status != "accepted" or item.normalized is None:
                    file_report["rejected"] += 1
                    rejected_records.append({
                        "source_file": str(source_file),
                        **item.to_report_dict(include_raw=True),
                    })
                    if strict:
                        raise ValueError("; ".join(item.errors) or "Adapter rejected record")
                    continue

                if enrichment_catalog is not None:
                    item.normalized, enrichment_record = enrich_normalized_record(
                        item.normalized, enrichment_catalog
                    )
                    enrichment_records.append(enrichment_record)

                validation_errors = validate_source(item.normalized)
                if validation_errors:
                    file_report["rejected"] += 1
                    rejected_records.append({
                        "source_file": str(source_file),
                        **item.to_report_dict(include_raw=True),
                        "errors": validation_errors,
                    })
                    if strict:
                        raise ValueError("Normalized source validation failed: " + "; ".join(validation_errors))
                    continue

                capability_id = item.normalized["capability_id"]
                pointer = item.normalized.get("source_reference", {}).get("source_pointer", "")
                suffix = _short_identity(
                    capability_id,
                    _portable_source_identity(source_root, source_file),
                    pointer,
                )
                record_name = f"{_safe_name(capability_id)}__{suffix}"
                normalized_path = normalized_dir / f"{record_name}.json"
                save_json(normalized_path, item.normalized)

                accepted_entry = {
                    "capability_id": capability_id,
                    "source_file": str(source_file),
                    "source_pointer": pointer,
                    "normalized_path": str(normalized_path),
                    "adapter_id": item.adapter_id,
                    "warnings": item.warnings,
                    "enrichment_status": (
                        item.normalized.get("enrichment_context", {}).get("status", "")
                        if enrichment_catalog is not None else ""
                    ),
                }
                accepted_records.append(accepted_entry)
                capability_sources[capability_id].append({
                    "source_file": str(source_file),
                    "source_pointer": pointer,
                    "normalized_path": str(normalized_path),
                })
                file_report["accepted"] += 1

                if build_cards:
                    card_output = generated_dir / record_name
                    try:
                        reused = False
                        if resume and card_output.exists():
                            reusable = receipt_matches_source(card_output, item.normalized)
                            if reusable["valid"]:
                                card = load_json(card_output / "capability_card.json")
                                cards.append(card)
                                accepted_entry["card_output"] = str(card_output)
                                accepted_entry["card_reused"] = True
                                file_report["cards_reused"] += 1
                                cards_reused += 1
                                reused = True
                            else:
                                accepted_entry["resume_rebuild_reasons"] = reusable["issues"]
                                receipt_failures += 1
                        if not reused:
                            card = build_from_file(normalized_path, card_output)
                            cards.append(card)
                            accepted_entry["card_output"] = str(card_output)
                            accepted_entry["card_reused"] = False
                            file_report["cards_built"] += 1
                    except Exception as exc:  # report exact pipeline failure without losing normalized source
                        accepted_entry["card_build_error"] = str(exc)
                        file_report["errors"].append(f"Card build failed for {capability_id}: {exc}")
                        if strict:
                            raise
        except Exception as exc:
            file_report["status"] = "failed"
            file_report["errors"].append(str(exc))
            if strict:
                file_reports.append(file_report)
                break
        file_reports.append(file_report)

    duplicates = {
        capability_id: sources
        for capability_id, sources in capability_sources.items()
        if len(sources) > 1
    }

    expected_normalized_names = {
        Path(entry["normalized_path"]).name for entry in accepted_records
    }
    actual_normalized_names = {
        path.name for path in normalized_dir.glob("*.json") if path.is_file()
    }
    stale_normalized_files = sorted(actual_normalized_names - expected_normalized_names)

    expected_generated_names = {
        Path(entry["card_output"]).name
        for entry in accepted_records
        if entry.get("card_output")
    }
    actual_generated_names = (
        {
            path.name
            for path in generated_dir.iterdir()
            if path.is_dir()
        }
        if build_cards and generated_dir.is_dir()
        else set()
    )
    stale_generated_outputs = sorted(actual_generated_names - expected_generated_names)

    if cards:
        save_json(output_root / "capability_index.json", build_index(cards))

    analysis_summary: dict[str, Any] = {}
    if accepted_records:
        normalized_records = [load_json(entry["normalized_path"]) for entry in accepted_records]
        identity_report, capability_graph = save_analysis(normalized_records, output_root / "analysis")
        quality_report = build_quality_report(cards, capability_graph) if cards else None
        search_index = build_search_index(cards, quality_report, identity_report) if cards else None
        if quality_report is not None:
            save_json(output_root / "analysis" / "quality_report.json", quality_report)
        if search_index is not None:
            save_json(output_root / "capability_search_index.json", search_index)
        registry_snapshot = build_registry_snapshot(normalized_records, identity_report, quality_report)
        save_json(output_root / "registry_snapshot.json", registry_snapshot)
        analysis_summary = {
            "identity": identity_report["summary"],
            "graph": capability_graph["summary"],
            "quality": quality_report["summary"] if quality_report else {},
            "search": search_index["summary"] if search_index else {},
            "snapshot": registry_snapshot["summary"],
            "identity_report": str(output_root / "analysis" / "identity_report.json"),
            "capability_graph": str(output_root / "analysis" / "capability_graph.json"),
            "quality_report": str(output_root / "analysis" / "quality_report.json") if quality_report else "",
            "search_index": str(output_root / "capability_search_index.json") if search_index else "",
            "registry_snapshot": str(output_root / "registry_snapshot.json"),
        }

    save_json(report_dir / "accepted_records.json", accepted_records)
    save_json(report_dir / "rejected_records.json", rejected_records)
    save_json(report_dir / "duplicate_capability_ids.json", duplicates)
    save_json(report_dir / "stale_normalized_files.json", stale_normalized_files)
    save_json(report_dir / "stale_generated_outputs.json", stale_generated_outputs)

    normalized_inventory = None
    normalized_inventory_verification = None
    normalized_inventory_error = ""
    if not stale_normalized_files:
        try:
            normalized_inventory = build_normalized_inventory(output_root)
            save_json(output_root / "normalized_inventory.json", normalized_inventory)
            normalized_inventory_verification = verify_normalized_inventory(
                output_root, normalized_inventory
            )
            if not normalized_inventory_verification.get("valid"):
                normalized_inventory_error = "; ".join(
                    normalized_inventory_verification.get("issues", [])
                )
        except Exception as exc:
            normalized_inventory_error = str(exc)
    else:
        normalized_inventory_error = (
            f"{len(stale_normalized_files)} stale normalized file(s) prevent a sealed normalized inventory"
        )

    completed = _utc_now()
    report = {
        "module": "AXM Human Capability Atlas",
        "module_version": __version__,
        "shared_contract_version": "0.1.0",
        "operation": "heterogeneous_source_ingestion",
        "started_at": started,
        "completed_at": completed,
        "source_path": str(source_root),
        "output_path": str(output_root),
        "settings": {
            "build_cards": build_cards,
            "recursive": recursive,
            "strict": strict,
            "resume": resume,
            "source_seal_enforced": source_seal is not None,
            "enrichment_enabled": enrichment_root is not None,
            "enrichment_root": str(enrichment_root) if enrichment_root is not None else "",
        },
        "summary": {
            "files_seen": len(files),
            "files_processed": len([item for item in file_reports if item["status"] == "processed"]),
            "files_unrecognized": len([item for item in file_reports if item["status"] == "unrecognized"]),
            "files_failed": len([item for item in file_reports if item["status"] == "failed"]),
            "records_found": sum(item["records_found"] for item in file_reports),
            "records_accepted": len(accepted_records),
            "records_rejected": len(rejected_records),
            "cards_built": sum(item["cards_built"] for item in file_reports),
            "cards_reused": cards_reused,
            "producer_receipt_rebuild_trigger_count": receipt_failures,
            "duplicate_capability_id_count": len(duplicates),
            "card_build_failure_count": sum(
                1 for entry in accepted_records if entry.get("card_build_error")
            ),
            "stale_normalized_file_count": len(stale_normalized_files),
            "stale_generated_output_count": len(stale_generated_outputs),
            "normalized_inventory_failures": 1 if normalized_inventory_error else 0,
            "normalized_inventory_record_count": int(
                (normalized_inventory or {}).get("summary", {}).get("record_count", 0)
            ),
            "enrichment_record_count": len(enrichment_records),
            "enrichment_verified_count": sum(item.get("status") == "VERIFIED" for item in enrichment_records),
            "enrichment_partial_count": sum(item.get("status") == "PARTIAL" for item in enrichment_records),
            "enrichment_conflicted_count": sum(item.get("status") == "CONFLICTED" for item in enrichment_records),
            "enrichment_no_module_relation_count": sum(item.get("status") == "NO_MODULE_RELATION" for item in enrichment_records),
            "enrichment_setup_failure_count": 1 if enrichment_error else 0,
        },
        "adapter_usage": dict(sorted(adapter_usage.items())),
        "detected_format_usage": dict(sorted(format_usage.items())),
        "duplicates": duplicates,
        "file_reports": file_reports,
        "analysis": analysis_summary,
        "normalized_inventory": {
            "path": str(output_root / "normalized_inventory.json") if normalized_inventory else "",
            "inventory_hash": str((normalized_inventory or {}).get("inventory_hash", "")),
            "inventory_semantic_hash": str(
                (normalized_inventory or {}).get("inventory_semantic_hash", "")
            ),
            "verification": normalized_inventory_verification or {},
            "error": normalized_inventory_error,
        },
        "integrity_notes": [
            "Original source files were read only and were not rewritten.",
            "Normalized records retain source file hash and JSON pointer or JSONL line provenance.",
            "Rejected records remain in reports/rejected_records.json for repair instead of being silently dropped.",
            "Duplicate capability IDs are reported and never silently overwritten.",
            "Identity resolution and relationship graph analysis are read-only and perform no automatic merge.",
            "Human-usability coverage scores expose their checks and cannot average away explicit blockers.",
            "The local search index uses deterministic published weights and no language-model ranking.",
            "The registry snapshot separates semantic, interface, relationship, lifecycle, alias, and provenance fingerprints.",
            "normalized_inventory.json binds every accepted normalized source file and semantic hash before batch planning.",
            "The intake gate blocks incomplete Capability Card coverage and producer-receipt coverage gaps.",
            "Stale normalized/generated artifacts are reported and block merge review instead of being silently reused.",
            "The staging output directory is forbidden inside the source tree.",
            "AXM public capability rows can be joined deterministically to registry/modules.json and referenced module contracts/manifests without promoting module-wide context into capability-specific facts.",
        ],
    }
    source_seal_post = verify_source_seal(source_root, source_seal) if source_seal else None
    if source_seal is not None:
        report["source_seal_verification"] = {
            "seal_hash": source_seal.get("seal_hash", ""),
            "pre": source_seal_pre,
            "post": source_seal_post,
        }
        report["summary"]["source_seal_failures"] = 0 if source_seal_post and source_seal_post["valid"] else 1

    enrichment_post = None
    if enrichment_catalog is not None:
        enrichment_post = verify_enrichment_catalog(enrichment_root, enrichment_catalog)
        enrichment_report = build_enrichment_report(
            enrichment_catalog,
            enrichment_records,
            pre_verification=enrichment_pre,
            post_verification=enrichment_post,
        )
        enrichment_report_errors = validate_enrichment_report(enrichment_report)
        if enrichment_report_errors:
            raise ValueError("Enrichment report schema failed: " + "; ".join(enrichment_report_errors))
        save_json(output_root / "analysis" / "enrichment_catalog.json", enrichment_catalog)
        save_json(report_dir / "enrichment_report.json", enrichment_report)
        report["enrichment"] = {
            "catalog_hash": enrichment_catalog.get("catalog_hash", ""),
            "source_seal_hash": enrichment_catalog.get("source_seal_hash", ""),
            "pre_verification": enrichment_pre,
            "post_verification": enrichment_post,
            "report": str(report_dir / "enrichment_report.json"),
            "catalog": str(output_root / "analysis" / "enrichment_catalog.json"),
        }
        report["summary"]["enrichment_source_failures"] = 0 if enrichment_post and enrichment_post["valid"] else 1
    elif enrichment_root is not None:
        report["enrichment"] = {
            "setup_error": enrichment_error,
            "pre_verification": enrichment_pre or {},
            "post_verification": {},
        }
        report["summary"]["enrichment_source_failures"] = 1

    # Verify all complete generated-card receipts before declaring intake readiness.
    receipts_verified = 0
    receipts_failed = 0
    if build_cards:
        for entry in accepted_records:
            card_output = entry.get("card_output")
            if not card_output:
                continue
            verification = verify_producer_receipt(card_output)
            if verification["valid"]:
                receipts_verified += 1
            else:
                receipts_failed += 1
                entry["producer_receipt_verification_errors"] = verification["issues"]

    report["summary"]["producer_receipts_verified"] = receipts_verified
    report["summary"]["producer_receipts_failed"] = receipts_failed
    # accepted_records may receive receipt errors during the final verification pass.
    save_json(report_dir / "accepted_records.json", accepted_records)

    identity_report_value = None
    graph_value = None
    quality_value = None
    if analysis_summary:
        identity_report_value = load_json(analysis_summary["identity_report"])
        graph_value = load_json(analysis_summary["capability_graph"])
        if analysis_summary.get("quality_report"):
            quality_value = load_json(analysis_summary["quality_report"])

    gate = build_intake_gate_report(
        report,
        identity_report_value,
        graph_value,
        quality_value,
        receipts_verified=receipts_verified,
        receipts_failed=receipts_failed,
    )
    gate_errors = validate_intake_gate(gate)
    if gate_errors:
        raise ValueError("Intake gate validation failed: " + "; ".join(gate_errors))
    save_json(output_root / "intake_gate_report.json", gate)
    report["analysis"]["intake_gate"] = {
        "status": gate["status"],
        "blocker_count": len(gate["blockers"]),
        "warning_count": len(gate["warnings"]),
        "report": str(output_root / "intake_gate_report.json"),
    }
    save_json(output_root / "ingestion_report.json", report)
    remove_file_durable(ingest_marker)
    return report
