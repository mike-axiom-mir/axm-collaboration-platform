from __future__ import annotations

import argparse
import json
from pathlib import Path

from .adapters import adapt_file, detect_file
from .ingest import ingest_path
from .identity import load_normalized_records
from .graph import save_analysis
from .quality import build_quality_report, load_cards
from .search import build_search_index, search_index, related_capabilities
from .ecosystem_learning import build_learning_path
from .review_ledger import append_event, verify_ledger
from .registry_snapshot import build_registry_snapshot
from .registry_diff import compare_registry_snapshots
from .io import load_json, save_json, loads_json
from .source_seal import build_source_seal, verify_source_seal
from .enrichment import build_enrichment_catalog, verify_enrichment_catalog
from .public_intake import prepare_axm_public_intake
from .discovery_integrity import build_discovery_integrity_report
from .implementation_identity import implementation_manifest
from .public_preflight import verify_public_intake_preflight
from .batching import (
    build_batch_plan, verify_batch_plan, verify_plan_source_alignment,
    build_batch, verify_batch_receipt,
    finalize_batch_run_to_file, verify_production_run_file,
    verify_production_run_chain_file,
)
from .pipeline import build_from_file
from .conformance import validate_stable_handoff_card, verify_producer_receipt
from .validators import compatible_contract
from .validators import (
    validate_card, validate_source, validate_course, validate_ingestion_report,
    validate_identity_report, validate_capability_graph, validate_quality_report,
    validate_search_index, validate_learning_path, validate_registry_snapshot,
    validate_registry_diff, validate_source_seal, validate_producer_receipt, validate_batch_plan,
    validate_batch_receipt, validate_production_run_manifest,
    validate_enrichment_catalog, validate_enrichment_report,
    validate_discovery_integrity_report, validate_repository_snapshot,
    validate_public_intake_preflight, validate_normalized_inventory,
)


def main() -> int:
    parser = argparse.ArgumentParser(prog="axm-capability-atlas")
    sub = parser.add_subparsers(dest="command", required=True)

    build = sub.add_parser("build", help="Build a Capability Card and human views from a normalized source")
    build.add_argument("source")
    build.add_argument("--output", required=True)

    validate = sub.add_parser("validate", help="Validate a JSON record")
    validate.add_argument("path")
    validate.add_argument("--kind", choices=["source", "card", "course", "ingestion", "identity", "graph", "quality", "search", "learning_path", "snapshot", "diff", "source_seal", "producer_receipt", "batch_plan", "batch_receipt", "production_run", "enrichment_catalog", "enrichment_report", "discovery_integrity", "repository_snapshot", "public_preflight", "normalized_inventory"], default="card")

    detect = sub.add_parser("detect", help="Detect a manifest or registry format without changing it")
    detect.add_argument("path")
    detect.add_argument("--show-records", action="store_true", help="Include adapter acceptance/rejection summaries")

    ingest = sub.add_parser("ingest", help="Normalize heterogeneous JSON/JSONL manifests and optionally build cards")
    ingest.add_argument("source", help="Input file or directory")
    ingest.add_argument("--output", required=True)
    ingest.add_argument("--no-build-cards", action="store_true")
    ingest.add_argument("--no-recursive", action="store_true")
    ingest.add_argument("--strict", action="store_true", help="Stop after the first unrecognized or invalid record")
    ingest.add_argument("--resume", action="store_true", help="Reuse only card outputs with a valid matching producer receipt")
    ingest.add_argument("--source-seal", help="Require the raw source tree to match this seal before and after ingestion")
    ingest.add_argument("--enrichment-root", help="AXM repository root containing registry/modules.json and referenced module contracts/manifests")

    public_intake = sub.add_parser("axm-public-intake", help="Seal, enrich, normalize, count-check, and batch-plan the generated AXM public registry")
    public_intake.add_argument("repository_root")
    public_intake.add_argument("--output", required=True)
    public_intake.add_argument("--batch-size", type=int, default=100)
    public_intake.add_argument(
        "--allow-dirty",
        action="store_true",
        help="Explicitly allow a dirty Git worktree; exact file hashes still bind the intake",
    )

    enrich_catalog = sub.add_parser("enrichment-catalog", help="Build the deterministic AXM provider/module enrichment catalog")
    enrich_catalog.add_argument("repository_root")
    enrich_catalog.add_argument("--output", required=True)

    enrich_verify = sub.add_parser("enrichment-verify", help="Verify an enrichment catalog against exact repository bytes")
    enrich_verify.add_argument("repository_root")
    enrich_verify.add_argument("catalog")

    discovery_verify = sub.add_parser(
        "discovery-verify",
        help="Verify generated public registries exactly against tools-index.json and proof ceilings",
    )
    discovery_verify.add_argument("repository_root")
    discovery_verify.add_argument("--output")

    analyze = sub.add_parser("analyze", help="Resolve identities and build the capability relationship graph")
    analyze.add_argument("source", help="Normalized source directory, ingestion output, or JSON record")
    analyze.add_argument("--output", required=True)

    audit = sub.add_parser("audit", help="Measure human-usability coverage without changing cards")
    audit.add_argument("source", help="Card file or directory containing capability_card.json files")
    audit.add_argument("--output", required=True)
    audit.add_argument("--graph", help="Optional capability_graph.json for relationship integrity checks")

    index = sub.add_parser("index", help="Build a deterministic local capability search index")
    index.add_argument("source", help="Card file or directory containing capability_card.json files")
    index.add_argument("--output", required=True)
    index.add_argument("--quality", help="Optional quality_report.json")
    index.add_argument("--identity", help="Optional identity_report.json")

    search = sub.add_parser("search", help="Query a deterministic capability search index")
    search.add_argument("index")
    search.add_argument("query")
    search.add_argument("--filter", action="append", default=[], help="Facet filter key=value; may be repeated")
    search.add_argument("--limit", type=int, default=20)

    related = sub.add_parser("related", help="Find related capabilities with explicit scoring reasons")
    related.add_argument("index")
    related.add_argument("capability_id")
    related.add_argument("--limit", type=int, default=20)

    learn = sub.add_parser("learn-path", help="Build a dependency-aware capability learning path")
    learn.add_argument("source", help="Card file or directory")
    learn.add_argument("target_capability_id")
    learn.add_argument("--output", required=True)

    review_add = sub.add_parser("review-add", help="Append a correction or dissent event to the review ledger")
    review_add.add_argument("ledger")
    review_add.add_argument("--capability-id", required=True)
    review_add.add_argument("--event-type", required=True)
    review_add.add_argument("--actor", required=True)
    review_add.add_argument("--reason", required=True)
    review_add.add_argument("--field", default="")
    review_add.add_argument("--proposed-value", default=None, help="JSON value or plain text")
    review_add.add_argument("--source-reference", action="append", default=[])

    review_verify = sub.add_parser("review-verify", help="Verify the append-only review ledger hash chain")
    review_verify.add_argument("ledger")

    snapshot = sub.add_parser("snapshot", help="Create a deterministic capability registry snapshot")
    snapshot.add_argument("source", help="Normalized source directory, ingestion output, or JSON record")
    snapshot.add_argument("--output", required=True)
    snapshot.add_argument("--identity", help="Optional identity_report.json")
    snapshot.add_argument("--quality", help="Optional quality_report.json")

    diff = sub.add_parser("diff", help="Compare two registry snapshots and produce a rebuild plan")
    diff.add_argument("before")
    diff.add_argument("after")
    diff.add_argument("--output", required=True)

    policy_validate = sub.add_parser(
        "policy-validate",
        help="Validate a Capability Card against shared schema plus stable handoff evidence/provenance policy",
    )
    policy_validate.add_argument("card")

    receipt_verify = sub.add_parser(
        "receipt-verify",
        help="Verify a generated capability directory and producer receipt",
    )
    receipt_verify.add_argument("output_dir")

    contract_check = sub.add_parser(
        "contract-check",
        help="Check whether a shared-contract version is explicitly supported",
    )
    contract_check.add_argument("version")

    seal = sub.add_parser("seal-source", help="Create a byte-for-byte seal of all capability source files before a long intake")
    seal.add_argument("source")
    seal.add_argument("--output", required=True)
    seal.add_argument("--no-recursive", action="store_true")

    seal_verify = sub.add_parser("seal-verify", help="Verify that a source tree still exactly matches a prior source seal")
    seal_verify.add_argument("source")
    seal_verify.add_argument("seal")

    batch_plan = sub.add_parser("batch-plan", help="Create deterministic non-overlapping production batches from normalized sources")
    batch_plan.add_argument("source", help="Normalized source directory or ingestion output")
    batch_plan.add_argument("--output", required=True)
    batch_plan.add_argument("--batch-size", type=int, default=100)

    batch_plan_verify = sub.add_parser(
        "batch-plan-verify",
        help="Verify a deterministic production batch plan and optionally its current normalized source alignment",
    )
    batch_plan_verify.add_argument("plan")
    batch_plan_verify.add_argument(
        "source",
        nargs="?",
        help="Optional normalized source/intake root for full plan-to-source alignment verification",
    )

    batch_build = sub.add_parser("batch-build", help="Build one deterministic batch and write a batch receipt")
    batch_build.add_argument("plan")
    batch_build.add_argument("source", help="Normalized source directory or ingestion output")
    batch_build.add_argument("batch_id")
    batch_build.add_argument("--output", required=True)
    batch_build.add_argument("--no-resume", action="store_true")

    batch_verify = sub.add_parser("batch-verify", help="Verify one completed production batch against its plan")
    batch_verify.add_argument("plan")
    batch_verify.add_argument("source")
    batch_verify.add_argument("batch_id")
    batch_verify.add_argument("--output", required=True)

    batch_finalize = sub.add_parser("batch-finalize", help="Verify complete batch coverage with no gaps or overlaps")
    batch_finalize.add_argument("plan")
    batch_finalize.add_argument("source")
    batch_finalize.add_argument("--output-root", required=True)
    batch_finalize.add_argument("--manifest", required=True)

    production_verify = sub.add_parser("production-verify", help="Verify a finalized production-run manifest hash and internal consistency")
    production_verify.add_argument("manifest")

    production_chain_verify = sub.add_parser(
        "production-chain-verify",
        help="Re-verify the complete normalized source -> plan -> batch -> producer receipt -> manifest chain",
    )
    production_chain_verify.add_argument("manifest")
    production_chain_verify.add_argument("plan")
    production_chain_verify.add_argument("source")
    production_chain_verify.add_argument("--output-root", required=True)

    preflight_verify = sub.add_parser(
        "preflight-verify",
        help="Re-verify a public-intake preflight and all source-bound artifacts against the current repository",
    )
    preflight_verify.add_argument("intake_root")
    preflight_verify.add_argument(
        "--repository-root",
        help="Optional relocated repository copy; defaults to the repository path stored in the preflight",
    )

    implementation_info = sub.add_parser(
        "implementation-info",
        help="Print the deterministic runtime implementation/schema fingerprint bound into v0.11 receipts and plans",
    )

    args = parser.parse_args()
    if args.command == "build":
        card = build_from_file(args.source, args.output)
        print(json.dumps({"status": "built", "capability_id": card["capability_id"], "output": args.output}, indent=2))
        return 0

    if args.command == "validate":
        data = load_json(args.path)
        errors = {
            "source": validate_source,
            "card": validate_card,
            "course": validate_course,
            "ingestion": validate_ingestion_report,
            "identity": validate_identity_report,
            "graph": validate_capability_graph,
            "quality": validate_quality_report,
            "search": validate_search_index,
            "learning_path": validate_learning_path,
            "snapshot": validate_registry_snapshot,
            "diff": validate_registry_diff,
            "source_seal": validate_source_seal,
            "producer_receipt": validate_producer_receipt,
            "batch_plan": validate_batch_plan,
            "batch_receipt": validate_batch_receipt,
            "production_run": validate_production_run_manifest,
            "enrichment_catalog": validate_enrichment_catalog,
            "enrichment_report": validate_enrichment_report,
            "discovery_integrity": validate_discovery_integrity_report,
            "repository_snapshot": validate_repository_snapshot,
            "public_preflight": validate_public_intake_preflight,
            "normalized_inventory": validate_normalized_inventory,
        }[args.kind](data)
        if errors:
            print(json.dumps({"valid": False, "errors": errors}, indent=2))
            return 1
        print(json.dumps({"valid": True, "kind": args.kind, "path": str(Path(args.path))}, indent=2))
        return 0

    if args.command == "detect":
        detection = detect_file(args.path)
        result = {"path": str(Path(args.path)), "detection": detection.to_dict()}
        if args.show_records and detection.format_id != "unknown":
            _, records = adapt_file(args.path)
            result["records"] = [item.to_report_dict(include_raw=False) for item in records]
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if detection.format_id != "unknown" else 2

    if args.command == "policy-validate":
        result = validate_stable_handoff_card(load_json(args.card))
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if result["valid"] else 1

    if args.command == "receipt-verify":
        result = verify_producer_receipt(args.output_dir)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if result["valid"] else 1

    if args.command == "contract-check":
        valid, reason = compatible_contract(args.version)
        print(json.dumps({"valid": valid, "version": args.version, "reason": reason}, indent=2))
        return 0 if valid else 1

    if args.command == "seal-source":
        result = build_source_seal(args.source, recursive=not args.no_recursive)
        errors = validate_source_seal(result)
        if errors:
            print(json.dumps({"error": "Generated source seal failed schema validation", "errors": errors}, indent=2))
            return 1
        save_json(args.output, result)
        print(json.dumps({"status": "sealed", "output": args.output, "summary": result["summary"], "seal_hash": result["seal_hash"]}, indent=2))
        return 0

    if args.command == "seal-verify":
        result = verify_source_seal(args.source, load_json(args.seal))
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if result["valid"] else 1

    if args.command == "batch-plan":
        result = build_batch_plan(args.source, batch_size=args.batch_size)
        errors = validate_batch_plan(result)
        if errors:
            print(json.dumps({"error": "Generated batch plan failed schema validation", "errors": errors}, indent=2))
            return 1
        save_json(args.output, result)
        print(json.dumps({"status": "planned", "output": args.output, "summary": result["summary"], "plan_hash": result["plan_hash"]}, indent=2))
        return 0

    if args.command == "batch-plan-verify":
        plan_value = load_json(args.plan)
        result = verify_batch_plan(plan_value)
        if args.source:
            alignment = verify_plan_source_alignment(plan_value, args.source)
            result = {
                **result,
                "valid": bool(result.get("valid")) and bool(alignment.get("valid")),
                "source_alignment": alignment,
                "issues": list(result.get("issues", []))
                + [f"source alignment: {item}" for item in alignment.get("issues", [])],
            }
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if result["valid"] else 1

    if args.command == "batch-build":
        receipt = build_batch(load_json(args.plan), args.source, args.batch_id, args.output, resume=not args.no_resume)
        errors = validate_batch_receipt(receipt)
        if errors:
            print(json.dumps({"error": "Batch receipt failed schema validation", "errors": errors}, indent=2))
            return 1
        print(json.dumps({"status": receipt["status"], "batch_id": args.batch_id, "summary": receipt["summary"], "batch_receipt_hash": receipt["batch_receipt_hash"]}, indent=2))
        return 0 if receipt["status"] == "PASS" else 1

    if args.command == "batch-verify":
        result = verify_batch_receipt(load_json(args.plan), args.source, args.batch_id, args.output)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if result["valid"] else 1

    if args.command == "batch-finalize":
        try:
            result = finalize_batch_run_to_file(
                load_json(args.plan), args.source, args.output_root, args.manifest
            )
        except Exception as exc:
            print(json.dumps({
                "status": "TEST_HOLD_REVIEW",
                "manifest": args.manifest,
                "error": str(exc),
            }, indent=2))
            return 1
        print(json.dumps({"status": result["status"], "manifest": args.manifest, "summary": result["summary"], "manifest_hash": result["manifest_hash"]}, indent=2))
        return 0 if result["status"] == "COMPLETE_VERIFIED" else 1

    if args.command == "production-verify":
        result = verify_production_run_file(args.manifest)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if result["valid"] else 1

    if args.command == "production-chain-verify":
        result = verify_production_run_chain_file(
            args.manifest,
            load_json(args.plan),
            args.source,
            args.output_root,
        )
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if result["valid"] else 1

    if args.command == "preflight-verify":
        result = verify_public_intake_preflight(
            args.intake_root, repository_root=args.repository_root
        )
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if result["valid"] else 1

    if args.command == "implementation-info":
        print(json.dumps(implementation_manifest(), indent=2, ensure_ascii=False))
        return 0

    if args.command == "axm-public-intake":
        result = prepare_axm_public_intake(
            args.repository_root,
            args.output,
            batch_size=args.batch_size,
            allow_dirty_repository=args.allow_dirty,
        )
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if result["status"] == "READY_FOR_BATCH_PRODUCTION" else 1

    if args.command == "enrichment-catalog":
        catalog = build_enrichment_catalog(args.repository_root)
        save_json(args.output, catalog)
        print(json.dumps({
            "status": "built",
            "output": args.output,
            "catalog_hash": catalog["catalog_hash"],
            "source_seal_hash": catalog["source_seal_hash"],
            "summary": catalog["summary"],
        }, indent=2, ensure_ascii=False))
        return 0

    if args.command == "enrichment-verify":
        result = verify_enrichment_catalog(args.repository_root, load_json(args.catalog))
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if result["valid"] else 1

    if args.command == "discovery-verify":
        result = build_discovery_integrity_report(args.repository_root)
        schema_errors = validate_discovery_integrity_report(result)
        if schema_errors:
            print(json.dumps({"valid": False, "schema_errors": schema_errors}, indent=2))
            return 1
        if args.output:
            save_json(args.output, result)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if result["valid"] else 1

    if args.command == "analyze":
        records = load_normalized_records(args.source)
        identity, graph = save_analysis(records, args.output)
        print(json.dumps({
            "status": "analyzed",
            "source": args.source,
            "output": args.output,
            "identity_summary": identity["summary"],
            "graph_summary": graph["summary"],
        }, indent=2, ensure_ascii=False))
        return 0

    if args.command == "audit":
        cards = load_cards(args.source)
        graph = load_json(args.graph) if args.graph else None
        report = build_quality_report(cards, graph)
        save_json(args.output, report)
        print(json.dumps({"status": "audited", "output": args.output, "summary": report["summary"]}, indent=2, ensure_ascii=False))
        return 0

    if args.command == "index":
        cards = load_cards(args.source)
        quality = load_json(args.quality) if args.quality else None
        identity = load_json(args.identity) if args.identity else None
        built = build_search_index(cards, quality, identity)
        save_json(args.output, built)
        print(json.dumps({"status": "indexed", "output": args.output, "summary": built["summary"]}, indent=2, ensure_ascii=False))
        return 0

    if args.command == "search":
        filters = {}
        for item in args.filter:
            if "=" not in item:
                print(json.dumps({"error": f"Invalid filter {item!r}; expected key=value"}, indent=2))
                return 2
            key, value = item.split("=", 1)
            filters[key] = value
        result = search_index(load_json(args.index), args.query, filters=filters, limit=args.limit)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    if args.command == "related":
        try:
            result = related_capabilities(load_json(args.index), args.capability_id, limit=args.limit)
        except KeyError as exc:
            print(json.dumps({"error": str(exc)}, indent=2))
            return 2
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    if args.command == "learn-path":
        cards = load_cards(args.source)
        try:
            plan = build_learning_path(cards, args.target_capability_id)
        except KeyError as exc:
            print(json.dumps({"error": str(exc)}, indent=2))
            return 2
        save_json(args.output, plan)
        print(json.dumps({"status": "planned", "output": args.output, "summary": plan["summary"]}, indent=2, ensure_ascii=False))
        return 0

    if args.command == "review-add":
        proposed = args.proposed_value
        if proposed is not None:
            try:
                proposed = loads_json(proposed)
            except ValueError:
                pass
        try:
            event = append_event(
                args.ledger,
                capability_id=args.capability_id,
                event_type=args.event_type,
                actor=args.actor,
                reason=args.reason,
                field=args.field,
                proposed_value=proposed,
                source_references=args.source_reference,
            )
        except ValueError as exc:
            print(json.dumps({"error": str(exc)}, indent=2))
            return 2
        print(json.dumps({"status": "appended", "event": event}, indent=2, ensure_ascii=False))
        return 0

    if args.command == "review-verify":
        result = verify_ledger(args.ledger)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if result["valid"] else 1

    if args.command == "snapshot":
        records = load_normalized_records(args.source)
        identity = load_json(args.identity) if args.identity else None
        quality = load_json(args.quality) if args.quality else None
        snapshot_data = build_registry_snapshot(records, identity, quality)
        save_json(args.output, snapshot_data)
        print(json.dumps({"status": "snapshotted", "output": args.output, "summary": snapshot_data["summary"], "snapshot_hash": snapshot_data["snapshot_hash"]}, indent=2, ensure_ascii=False))
        return 0

    if args.command == "diff":
        diff_data = compare_registry_snapshots(load_json(args.before), load_json(args.after))
        save_json(args.output, diff_data)
        print(json.dumps({"status": "compared", "output": args.output, "summary": diff_data["summary"]}, indent=2, ensure_ascii=False))
        return 0

    report = ingest_path(
        args.source,
        args.output,
        build_cards=not args.no_build_cards,
        recursive=not args.no_recursive,
        strict=args.strict,
        resume=args.resume,
        source_seal=load_json(args.source_seal) if args.source_seal else None,
        enrichment_root=args.enrichment_root,
    )
    print(json.dumps({
        "status": "completed",
        "source": args.source,
        "output": args.output,
        "summary": report["summary"],
    }, indent=2, ensure_ascii=False))
    if args.strict and (report["summary"]["files_failed"] or report["summary"]["records_rejected"]):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
