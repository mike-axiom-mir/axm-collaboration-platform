from __future__ import annotations

from typing import Any


def _dict(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, dict) else {}


def build_intake_gate_report(
    ingestion_report: dict[str, Any],
    identity_report: dict[str, Any] | None = None,
    capability_graph: dict[str, Any] | None = None,
    quality_report: dict[str, Any] | None = None,
    *,
    receipts_verified: int = 0,
    receipts_failed: int = 0,
) -> dict[str, Any]:
    summary = _dict(ingestion_report.get("summary"))
    settings = _dict(ingestion_report.get("settings"))
    identity = _dict(_dict(identity_report).get("summary"))
    graph = _dict(_dict(capability_graph).get("summary"))
    quality = _dict(_dict(quality_report).get("summary"))

    blockers: list[str] = []
    warnings: list[str] = []

    if summary.get("files_seen", 0) == 0:
        blockers.append("No supported capability source files were discovered.")
    if summary.get("records_found", 0) == 0:
        blockers.append("No capability records were discovered.")
    if summary.get("records_accepted", 0) == 0:
        blockers.append("No capability records were accepted.")

    if summary.get("files_failed", 0):
        blockers.append(f"{summary['files_failed']} source file(s) failed ingestion.")
    if summary.get("records_rejected", 0):
        blockers.append(f"{summary['records_rejected']} record(s) were rejected.")
    if summary.get("files_unrecognized", 0):
        blockers.append(f"{summary['files_unrecognized']} file(s) were unrecognized.")

    if summary.get("stale_normalized_file_count", 0):
        blockers.append(
            f"{summary['stale_normalized_file_count']} stale normalized source file(s) remain from another run."
        )
    if summary.get("stale_generated_output_count", 0):
        blockers.append(
            f"{summary['stale_generated_output_count']} stale generated output directorie(s) remain from another run."
        )
    if summary.get("normalized_inventory_failures", 0):
        blockers.append("Normalized source inventory could not be sealed and verified.")

    if summary.get("enrichment_setup_failure_count", 0):
        blockers.append("Provider/module enrichment setup failed.")
    if summary.get("enrichment_source_failures", 0):
        blockers.append("Provider/module enrichment source evidence changed or could not be verified during intake.")
    if summary.get("enrichment_conflicted_count", 0):
        blockers.append(
            f"{summary['enrichment_conflicted_count']} capability enrichment record(s) conflict with provider/module declarations."
        )
    if summary.get("enrichment_partial_count", 0):
        warnings.append(
            f"{summary['enrichment_partial_count']} capability enrichment record(s) have partial or unresolved module joins."
        )
    if summary.get("enrichment_no_module_relation_count", 0):
        warnings.append(
            f"{summary['enrichment_no_module_relation_count']} capability record(s) declare no provider/consumer module relation."
        )

    if settings.get("build_cards") is True:
        completed_cards = int(summary.get("cards_built", 0)) + int(summary.get("cards_reused", 0))
        expected_cards = int(summary.get("records_accepted", 0))
        if completed_cards != expected_cards:
            blockers.append(
                f"Capability Card completion gap: expected {expected_cards}, completed {completed_cards}."
            )
        if int(summary.get("card_build_failure_count", 0)):
            blockers.append(
                f"{summary['card_build_failure_count']} Capability Card build(s) failed."
            )
        if receipts_verified != expected_cards:
            blockers.append(
                f"Producer receipt coverage gap: expected {expected_cards}, verified {receipts_verified}."
            )

    if identity.get("conflict_group_count", 0):
        blockers.append(f"{identity['conflict_group_count']} capability ID conflict group(s) require review.")
    if identity.get("alias_collision_count", 0):
        blockers.append(f"{identity['alias_collision_count']} alias collision(s) require review.")
    if identity.get("alias_shadowing_count", 0):
        blockers.append(f"{identity['alias_shadowing_count']} alias shadowing case(s) require review.")
    if identity.get("normalized_id_collision_count", 0):
        blockers.append(f"{identity['normalized_id_collision_count']} normalized-ID collision(s) require review.")
    if identity.get("broken_lifecycle_link_count", 0):
        blockers.append(f"{identity['broken_lifecycle_link_count']} broken lifecycle link(s) require review.")
    if graph.get("unresolved_reference_count", 0):
        blockers.append(f"{graph['unresolved_reference_count']} relationship reference(s) are unresolved.")
    if graph.get("self_reference_count", 0):
        blockers.append(f"{graph['self_reference_count']} self-reference(s) require review.")
    if graph.get("dependency_cycle_count", 0):
        blockers.append(f"{graph['dependency_cycle_count']} dependency cycle(s) require review.")
    if receipts_failed:
        blockers.append(f"{receipts_failed} producer receipt(s) failed verification.")

    source_seal = _dict(ingestion_report.get("source_seal_verification"))
    if source_seal and _dict(source_seal.get("post")).get("valid") is not True:
        blockers.append("Source inventory changed during the sealed ingestion run.")

    if quality.get("blocked_count", 0):
        warnings.append(
            f"{quality['blocked_count']} capability card(s) are valid archive records but currently blocked for human usability."
        )
    if quality.get("conditional_count", 0):
        warnings.append(
            f"{quality['conditional_count']} capability card(s) are only conditionally human-usable."
        )
    if identity.get("duplicate_id_group_count", 0) and not identity.get("conflict_group_count", 0):
        warnings.append(
            f"{identity['duplicate_id_group_count']} duplicate/revision identity group(s) exist and remain non-destructively preserved."
        )

    if summary.get("files_failed", 0):
        status = "INGEST_FAILED"
    elif blockers:
        status = "TEST_HOLD_REVIEW"
    else:
        status = "READY_FOR_MERGE_REVIEW"

    return {
        "report_version": "0.1.0",
        "status": status,
        "merge_claim": False,
        "blockers": blockers,
        "warnings": warnings,
        "receipt_verification": {
            "verified": receipts_verified,
            "failed": receipts_failed,
        },
        "source_summary": summary,
        "identity_summary": identity,
        "graph_summary": graph,
        "quality_summary": quality,
        "integrity_notes": [
            "READY_FOR_MERGE_REVIEW is not local acceptance and does not bypass AXM Merge Gate.",
            "Human-usability blockers may coexist with a structurally valid archive record.",
            "No rejected, unrecognized, failed, stale, conflicted, unresolved, or incomplete card state is silently converted into a pass.",
        ],
    }
