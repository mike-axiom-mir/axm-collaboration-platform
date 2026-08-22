from __future__ import annotations

from pathlib import Path
import hashlib
import json

import pytest

from axm_capability_atlas.adapters import adapt_file
from axm_capability_atlas.atlas import build_card
from axm_capability_atlas.enrichment import (
    build_enrichment_catalog,
    verify_enrichment_catalog,
    enrich_normalized_record,
)
from axm_capability_atlas.ingest import ingest_path
from axm_capability_atlas.io import load_json
from axm_capability_atlas.source_seal import build_source_seal
from axm_capability_atlas.validators import validate_card, validate_source
from axm_capability_atlas.conformance import validate_stable_handoff_card
from axm_capability_atlas.views import quick_view, practical_view, deep_view
from axm_capability_atlas.discovery_integrity import (
    _expected_public_status,
    _expected_proofs,
    build_discovery_integrity_report,
)


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def _fixture_repo(root: Path, *, provider_status: str = "TEST", contract_has_capability: bool = True) -> tuple[Path, Path]:
    provider_manifest = root / "tools" / "accessibility-adaptation-lab" / "manifest.json"
    provider_contract = root / "tools" / "accessibility-adaptation-lab" / "module.contract.json"
    consumer_manifest = root / "tools" / "json-consumer" / "manifest.json"
    consumer_contract = root / "tools" / "json-consumer" / "module.contract.json"

    _write_json(provider_manifest, {
        "schema": "axm.tool-manifest/v1",
        "kind": "product",
        "id": "accessibility-adaptation-lab",
        "name": "AXM Accessibility Adaptation Lab",
        "version": "v0.1",
        "status": "TEST",
        "category": "ACCESSIBILITY",
        "audience": "human-machine",
        "risk": "MEDIUM",
        "tags": ["accessibility", "adaptive-interface"],
        "permissions": ["storage"],
        "actions": ["rank packets against explicit user goals"],
        "accepts": ["axm.accessibility-adaptation-request/v1", "application/json"],
        "produces": ["axm.accessibility-adaptation-plan/v1"],
        "summary": "A local accessibility planning module.",
        "notes": "No diagnosis or global apply authority."
    })
    _write_json(provider_contract, {
        "schema": "axm.module-contract/v1",
        "id": "accessibility-adaptation-lab",
        "version": "v0.1",
        "provides": ["accessibility.goal-routing"] if contract_has_capability else ["different.capability"],
        "consumes": ["application/json"],
        "permissions": ["storage"],
        "handoffs": {
            "emits": ["axm.accessibility-adaptation-plan/v1"],
            "accepts": ["application/json"]
        },
        "boundaries": {
            "writes": ["browser-local-storage:preview"],
            "refuses": ["diagnosis", "automatic-activation"]
        }
    })
    _write_json(consumer_manifest, {
        "schema": "axm.tool-manifest/v1",
        "kind": "service",
        "id": "json-consumer",
        "name": "JSON Consumer",
        "version": "v0.1",
        "status": "TEST",
        "summary": "Consumes JSON input."
    })
    _write_json(consumer_contract, {
        "schema": "axm.module-contract/v1",
        "id": "json-consumer",
        "version": "v0.1",
        "provides": ["json.result"],
        "consumes": ["application/json"]
    })

    modules = {
        "schema": "axm.public-modules/v1",
        "generated_at": "2026-08-08T00:00:00Z",
        "source": {"path": "tools-index.json", "digest": "d" * 64},
        "summary": {"tools": 2, "capabilities": 3},
        "truth": {
            "automaticPromotion": False,
            "capabilityCatalogGrantsAuthority": False,
            "missingValuesRemainVisible": True,
        },
        "modules": [
            {
                "id": "accessibility-adaptation-lab",
                "name": "AXM Accessibility Adaptation Lab",
                "status": "TEST",
                "kind": "product",
                "audience": "human-machine",
                "source_path": "tools/accessibility-adaptation-lab",
                "entry_path": "tools/accessibility-adaptation-lab/index.html",
                "manifest": {
                    "path": "tools/accessibility-adaptation-lab/manifest.json",
                    "sha256": _sha(provider_manifest),
                    "valid": True,
                    "errors": [],
                },
                "contract": {
                    "path": "tools/accessibility-adaptation-lab/module.contract.json",
                    "present": True,
                    "valid": True,
                    "provides": ["accessibility.goal-routing"],
                    "consumes": ["application/json"],
                    "errors": [],
                },
                "tests": ["tools/accessibility-adaptation-lab/selftest.js"],
                "verified_at": None,
                "freshness": {"state": "MISSING", "ageDays": None},
                "promotion": {"state": "READY_FOR_HUMAN_REVIEW", "blockers": []},
            },
            {
                "id": "json-consumer",
                "name": "JSON Consumer",
                "status": "TEST",
                "kind": "service",
                "audience": "machine",
                "source_path": "tools/json-consumer",
                "entry_path": "tools/json-consumer/index.js",
                "manifest": {
                    "path": "tools/json-consumer/manifest.json",
                    "sha256": _sha(consumer_manifest),
                    "valid": True,
                    "errors": [],
                },
                "contract": {
                    "path": "tools/json-consumer/module.contract.json",
                    "present": True,
                    "valid": True,
                    "provides": ["json.result"],
                    "consumes": ["application/json"],
                    "errors": [],
                },
                "tests": [],
                "verified_at": None,
                "freshness": {"state": "MISSING", "ageDays": None},
                "promotion": {"state": "READY_FOR_HUMAN_REVIEW", "blockers": []},
            },
        ],
    }
    _write_json(root / "registry" / "modules.json", modules)

    capabilities = root / "registry" / "capabilities.jsonl"
    capabilities.parent.mkdir(parents=True, exist_ok=True)
    rows = [
        {
            "schema": "axm.public-capability/v1",
            "id": "accessibility.goal-routing",
            "providers": ["accessibility-adaptation-lab"],
            "consumers": [],
            "provider_statuses": [{"id": "accessibility-adaptation-lab", "status": provider_status}],
            "truth": {"declaration_is_runtime_proof": False, "grants_authority": False},
        },
        {
            "schema": "axm.public-capability/v1",
            "id": "application/json",
            "providers": [],
            "consumers": ["accessibility-adaptation-lab", "json-consumer"],
            "provider_statuses": [],
            "truth": {"declaration_is_runtime_proof": False, "grants_authority": False},
        },
    ]
    capabilities.write_text("\n".join(json.dumps(row, separators=(",", ":")) for row in rows) + "\n", encoding="utf-8")
    return root, capabilities


def _complete_discovery_bundle(root: Path) -> None:
    modules = load_json(root / "registry" / "modules.json")
    capability_rows = [
        json.loads(line)
        for line in (root / "registry" / "capabilities.jsonl").read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]

    tools = []
    for module in modules["modules"]:
        source_path = str(module.get("source_path", ""))
        folder = source_path[len("tools/"):] if source_path.startswith("tools/") else source_path
        entry_path = module.get("entry_path")
        tools.append({
            "id": module.get("id"),
            "name": module.get("name"),
            "status": module.get("status"),
            "kind": module.get("kind"),
            "audience": module.get("audience"),
            "folder": folder,
            "entry": {"exists": bool(entry_path), "path": entry_path},
            "manifest": module.get("manifest"),
            "contract": module.get("contract"),
            "selftest": {"paths": module.get("tests", [])},
            "verifiedAt": module.get("verified_at"),
            "freshness": module.get("freshness"),
            "promotion": module.get("promotion"),
        })

    index = {
        "schema": "axm.tools-index/v1",
        "generatedAt": modules["generated_at"],
        "sourceDigest": modules["source"]["digest"],
        "summary": modules["summary"],
        "truth": modules["truth"],
        "tools": tools,
        "capabilities": [
            {
                "id": row["id"],
                "providers": row.get("providers", []),
                "consumers": row.get("consumers", []),
            }
            for row in capability_rows
        ],
    }
    _write_json(root / "tools-index.json", index)

    status = _expected_public_status(index, len(tools), len(capability_rows))
    proofs = _expected_proofs(index)
    _write_json(root / "registry" / "public-status.json", status)
    _write_json(root / "registry" / "proofs.json", proofs)

    for module in modules["modules"]:
        for relative in module.get("tests", []):
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(f"fixture module test evidence: {relative}\n", encoding="utf-8")

    required_text_files = [
        "scripts/generate-tools-index.js",
        "scripts/generate-public-discovery.js",
        "tests/public-discovery-selftest.js",
        "tests/windows-clean-launch-smoke.ps1",
        ".github/workflows/public-launch.yml",
        "tools/workshop-packager/package-planner.js",
        "shared/operations/github-sync-service.js",
    ]
    for relative in required_text_files:
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f"fixture evidence: {relative}\n", encoding="utf-8")

    (root / ".gitattributes").write_text(
        "registry/*.json text eol=lf\nregistry/*.jsonl text eol=lf\n",
        encoding="utf-8",
    )




def test_public_registry_adapter_preserves_provider_consumer_truth(tmp_path):
    _, source = _fixture_repo(tmp_path / "repo")
    detection, records = adapt_file(source)
    assert detection.format_id == "jsonl_records"
    assert len(records) == 2
    first = records[0].normalized
    assert first["capability_id"] == "accessibility.goal-routing"
    assert first["registry_context"]["providers"] == ["accessibility-adaptation-lab"]
    assert first["registry_context"]["truth"]["declaration_is_runtime_proof"] is False
    assert first["maturity_profile"]["proof_status"] == "declared_not_runtime_proof"
    assert first["source_reference"]["source_type"] == "registry"
    assert records[0].adapter_id == "axm-public-capability-registry-v1"
    assert validate_source(first) == []


def test_exact_provider_and_consumer_joins_are_verified(tmp_path):
    repo, source = _fixture_repo(tmp_path / "repo")
    catalog = build_enrichment_catalog(repo)
    assert catalog["summary"]["module_count"] == 2
    assert verify_enrichment_catalog(repo, catalog)["valid"] is True

    _, records = adapt_file(source)
    provider, provider_report = enrich_normalized_record(records[0].normalized, catalog)
    consumer, consumer_report = enrich_normalized_record(records[1].normalized, catalog)

    assert provider_report["status"] == "VERIFIED"
    context = provider["enrichment_context"]["providers"][0]
    assert context["join_status"] == "VERIFIED"
    assert context["manifest"]["summary"] == "A local accessibility planning module."
    assert "diagnosis" in context["contract"]["boundaries"]["refuses"]
    assert consumer_report["status"] == "VERIFIED"
    assert {x["module_id"] for x in consumer["enrichment_context"]["consumers"]} == {
        "accessibility-adaptation-lab", "json-consumer"
    }


def test_module_context_is_not_silently_promoted_into_capability_semantics(tmp_path):
    repo, source = _fixture_repo(tmp_path / "repo")
    catalog = build_enrichment_catalog(repo)
    _, records = adapt_file(source)
    normalized, _ = enrich_normalized_record(records[0].normalized, catalog)
    normalized_path = tmp_path / "normalized.json"
    _write_json(normalized_path, normalized)
    card = build_card(normalized, normalized_path)

    assert card["purpose"]["plain_explanation"].startswith("UNKNOWN")
    assert card["input_profile"]["input_types"] == []
    assert card["output_profile"]["output_types"] == []
    assert card["relationships"]["dependency_capability_ids"] == []
    assert card["source_reference"]["enrichment"]["status"] == "VERIFIED"
    assert card["knowledge"]["field_states"]["/source_reference/enrichment"] == "known"
    assert validate_card(card) == []
    assert validate_stable_handoff_card(card)["valid"] is True

    assert "Accessibility Adaptation Lab" in quick_view(card)
    assert "Provider/module context" in practical_view(card)
    assert "diagnosis" in deep_view(card)


def test_provider_contract_mismatch_becomes_conflicted_not_hidden(tmp_path):
    repo, source = _fixture_repo(tmp_path / "repo", contract_has_capability=False)
    catalog = build_enrichment_catalog(repo)
    _, records = adapt_file(source)
    normalized, report = enrich_normalized_record(records[0].normalized, catalog)
    assert report["status"] == "CONFLICTED"
    assert normalized["enrichment_context"]["providers"][0]["join_status"] == "CONFLICTED"


def test_ingest_enrichment_writes_cards_reports_and_gate(tmp_path):
    repo, source = _fixture_repo(tmp_path / "repo")
    output = tmp_path / "intake"
    seal = build_source_seal(source)
    report = ingest_path(source, output, source_seal=seal, enrichment_root=repo)
    assert report["summary"]["records_accepted"] == 2
    assert report["summary"]["enrichment_verified_count"] == 2
    assert report["summary"]["enrichment_source_failures"] == 0
    assert report["summary"]["cards_built"] == 2
    gate = load_json(output / "intake_gate_report.json")
    assert gate["status"] == "READY_FOR_MERGE_REVIEW"
    enrichment_report = load_json(output / "reports" / "enrichment_report.json")
    assert enrichment_report["summary"]["verified_record_count"] == 2
    cards = sorted((output / "generated").glob("*/capability_card.json"))
    assert len(cards) == 2
    card = load_json(cards[0])
    assert "enrichment" in card["source_reference"]


def test_consistent_enrichment_change_forces_resume_rebuild(tmp_path):
    repo, source = _fixture_repo(tmp_path / "repo")
    output = tmp_path / "intake"
    seal = build_source_seal(source)
    first = ingest_path(source, output, source_seal=seal, enrichment_root=repo)
    assert first["summary"]["cards_built"] == 2

    manifest_path = repo / "tools" / "accessibility-adaptation-lab" / "manifest.json"
    manifest = load_json(manifest_path)
    manifest["summary"] = "A changed but still source-declared module summary."
    _write_json(manifest_path, manifest)
    modules_path = repo / "registry" / "modules.json"
    modules = load_json(modules_path)
    modules["modules"][0]["manifest"]["sha256"] = _sha(manifest_path)
    _write_json(modules_path, modules)

    second = ingest_path(source, output, source_seal=seal, enrichment_root=repo, resume=True)
    # application/json also carries accessibility-adaptation-lab as a consumer,
    # so both source-bound cards must rebuild when that provider/consumer context changes.
    assert second["summary"]["cards_built"] == 2
    assert second["summary"]["cards_reused"] == 0
    assert second["summary"]["producer_receipt_rebuild_trigger_count"] >= 2


def test_enrichment_source_change_during_run_is_detectable(tmp_path):
    repo, _ = _fixture_repo(tmp_path / "repo")
    catalog = build_enrichment_catalog(repo)
    contract = repo / "tools" / "accessibility-adaptation-lab" / "module.contract.json"
    value = load_json(contract)
    value["boundaries"]["refuses"].append("new-boundary")
    _write_json(contract, value)
    result = verify_enrichment_catalog(repo, catalog)
    assert result["valid"] is False
    assert result["changed_files"]


def test_axm_public_intake_one_command_prepares_verified_batch_plan(tmp_path):
    from axm_capability_atlas.public_intake import prepare_axm_public_intake

    repo, _ = _fixture_repo(tmp_path / "repo")
    # Fixture modules.json truthfully declares three capabilities in contracts,
    # while capabilities.jsonl intentionally has two rows. Make the public count
    # exact for this positive test.
    modules_path = repo / "registry" / "modules.json"
    modules = load_json(modules_path)
    modules["summary"]["capabilities"] = 2
    _write_json(modules_path, modules)
    _complete_discovery_bundle(repo)
    assert build_discovery_integrity_report(repo)["valid"] is True

    output = tmp_path / "prepared"
    result = prepare_axm_public_intake(repo, output, batch_size=1)
    assert result["status"] == "READY_FOR_BATCH_PRODUCTION"
    assert result["registry_count_matches"] is True
    assert result["records_accepted"] == 2
    assert result["batch_count"] == 2
    assert (output / "capability_registry_source_seal.json").is_file()
    assert (output / "batch_plan.json").is_file()
    assert (output / "AXM_PUBLIC_INTAKE_SUMMARY.json").is_file()


def test_axm_public_intake_holds_when_generated_registry_counts_disagree(tmp_path):
    from axm_capability_atlas.public_intake import prepare_axm_public_intake

    repo, _ = _fixture_repo(tmp_path / "repo")
    _complete_discovery_bundle(repo)
    assert build_discovery_integrity_report(repo)["valid"] is False
    output = tmp_path / "prepared"
    result = prepare_axm_public_intake(repo, output, batch_size=100)
    assert result["status"] == "TEST_HOLD_REVIEW"
    assert result["registry_count_matches"] is False
    assert any("count mismatch" in item.lower() for item in result["blockers"])
    assert not (output / "batch_plan.json").exists()


def _enriched_fixture_cards(tmp_path):
    repo, source = _fixture_repo(tmp_path / "repo")
    modules_path = repo / "registry" / "modules.json"
    modules = load_json(modules_path)
    modules["summary"]["capabilities"] = 2
    _write_json(modules_path, modules)
    _complete_discovery_bundle(repo)

    catalog = build_enrichment_catalog(repo)
    _, adapted = adapt_file(source)
    cards = []
    normalized_records = []
    for index, item in enumerate(adapted):
        normalized, _ = enrich_normalized_record(item.normalized, catalog)
        normalized_records.append(normalized)
        normalized_path = tmp_path / f"normalized_{index}.json"
        _write_json(normalized_path, normalized)
        cards.append(build_card(normalized, normalized_path))
    return repo, source, catalog, normalized_records, cards


def test_v010_consumer_only_identifier_is_dependency_reference_not_axm_capability(tmp_path):
    _, _, _, normalized, cards = _enriched_fixture_cards(tmp_path)
    dependency = next(item for item in normalized if item["capability_id"] == "application/json")
    assert dependency["registry_context"]["registry_role"]["classification"] == "CONSUMER_ONLY_DEPENDENCY"
    assert dependency["registry_context"]["registry_role"]["human_surface"] == "DEPENDENCY_REFERENCE"

    card = next(item for item in cards if item["capability_id"] == "application/json")
    assert card["source_reference"]["registry_role"]["human_surface"] == "DEPENDENCY_REFERENCE"
    assert "not an AXM-provided ability" in quick_view(card)


def test_v010_provider_backed_identifier_is_human_capability_target(tmp_path):
    _, _, _, normalized, cards = _enriched_fixture_cards(tmp_path)
    provided = next(item for item in normalized if item["capability_id"] == "accessibility.goal-routing")
    assert provided["registry_context"]["registry_role"]["classification"] == "PROVIDED_ONLY"
    assert provided["registry_context"]["registry_role"]["human_surface"] == "AXM_CAPABILITY"
    card = next(item for item in cards if item["capability_id"] == "accessibility.goal-routing")
    assert "AXM-provided capability" in quick_view(card)


def test_v010_discovery_integrity_reconstructs_generated_bundle_and_rejects_stale_row(tmp_path):
    repo, _ = _fixture_repo(tmp_path / "repo")
    modules_path = repo / "registry" / "modules.json"
    modules = load_json(modules_path)
    modules["summary"]["capabilities"] = 2
    _write_json(modules_path, modules)
    _complete_discovery_bundle(repo)

    clean = build_discovery_integrity_report(repo)
    assert clean["valid"] is True
    assert all(clean["exact_checks"].values())
    assert clean["summary"]["registry_identifier_count"] == 2
    assert clean["summary"]["provider_backed_count"] == 1
    assert clean["summary"]["consumer_only_dependency_count"] == 1

    capability_path = repo / "registry" / "capabilities.jsonl"
    lines = capability_path.read_text(encoding="utf-8").splitlines()
    first = json.loads(lines[0])
    first["provider_statuses"][0]["status"] = "WORKING"
    lines[0] = json.dumps(first, separators=(",", ":"))
    capability_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    stale = build_discovery_integrity_report(repo)
    assert stale["valid"] is False
    assert stale["exact_checks"]["capabilities_match_tools_index"] is False


def test_v010_missing_declared_test_or_proof_evidence_invalidates_discovery(tmp_path):
    repo, _ = _fixture_repo(tmp_path / "repo")
    modules_path = repo / "registry" / "modules.json"
    modules = load_json(modules_path)
    modules["summary"]["capabilities"] = 2
    _write_json(modules_path, modules)
    _complete_discovery_bundle(repo)

    (repo / "tools" / "accessibility-adaptation-lab" / "selftest.js").unlink()
    missing_test = build_discovery_integrity_report(repo)
    assert missing_test["valid"] is False
    assert missing_test["summary"]["missing_module_test_path_count"] == 1

    # Restore test and remove one proof evidence source instead.
    path = repo / "tools" / "accessibility-adaptation-lab" / "selftest.js"
    path.write_text("restored fixture test\n", encoding="utf-8")
    (repo / "tests" / "public-discovery-selftest.js").unlink()
    missing_proof = build_discovery_integrity_report(repo)
    assert missing_proof["valid"] is False
    assert "tests/public-discovery-selftest.js" in missing_proof["missing_required_files"]
    assert any("missing" in issue.lower() for issue in missing_proof["issues"])


def test_v010_proof_ceiling_is_bound_to_card_and_human_views(tmp_path):
    _, _, _, _, cards = _enriched_fixture_cards(tmp_path)
    card = next(item for item in cards if item["capability_id"] == "accessibility.goal-routing")
    ceiling = card["source_reference"]["proof_ceiling"]
    assert ceiling["declaration_is_runtime_proof"] is False
    assert ceiling["selftest_is_human_approval"] is False
    assert ceiling["automatic_promotion"] is False
    assert ceiling["canon_requires_human_merge_gate"] is True
    assert card["maturity_profile"]["proof_status"] == "declared_not_runtime_proof"
    assert "not runtime proof" in quick_view(card)
    assert "human approval" in deep_view(card)


def test_v010_humanization_seed_never_becomes_capability_fact(tmp_path):
    _, _, _, normalized, cards = _enriched_fixture_cards(tmp_path)
    record = next(item for item in normalized if item["capability_id"] == "accessibility.goal-routing")
    seed = record["enrichment_context"]["humanization_seed"]
    assert seed["display_label"] == "Accessibility Goal Routing"
    assert seed["action_candidates"]
    assert seed["action_candidates"][0]["claim_status"] == "CONTEXT_CANDIDATE_NOT_CAPABILITY_FACT"
    assert "goal" in seed["action_candidates"][0]["shared_tokens"]

    card = next(item for item in cards if item["capability_id"] == "accessibility.goal-routing")
    assert card["purpose"]["plain_explanation"].startswith("UNKNOWN")
    assert card["input_profile"]["input_types"] == []
    assert card["output_profile"]["output_types"] == []
    assert "Deterministic humanization candidates" in practical_view(card)


def test_v010_quality_coverage_denominator_excludes_dependency_references(tmp_path):
    from axm_capability_atlas.quality import build_quality_report

    _, _, _, _, cards = _enriched_fixture_cards(tmp_path)
    report = build_quality_report(cards)
    summary = report["summary"]
    assert summary["registry_identifier_count"] == 2
    assert summary["provider_backed_capability_count"] == 1
    assert summary["capability_count"] == 1
    assert summary["consumer_only_dependency_reference_count"] == 1
    assert summary["coverage_scope"] == "provider_backed_registry_identifiers_only"


def test_v010_public_intake_emits_separate_human_and_dependency_targets(tmp_path):
    from axm_capability_atlas.public_intake import prepare_axm_public_intake

    repo, _ = _fixture_repo(tmp_path / "repo")
    modules_path = repo / "registry" / "modules.json"
    modules = load_json(modules_path)
    modules["summary"]["capabilities"] = 2
    _write_json(modules_path, modules)
    _complete_discovery_bundle(repo)

    output = tmp_path / "prepared"
    result = prepare_axm_public_intake(repo, output, batch_size=1)
    assert result["status"] == "READY_FOR_BATCH_PRODUCTION"
    assert result["provider_backed_human_capability_count"] == 1
    assert result["consumer_only_dependency_reference_count"] == 1
    assert result["discovery_integrity_valid"] is True

    humans = load_json(output / "reports" / "human_capability_targets.json")
    dependencies = load_json(output / "reports" / "dependency_reference_targets.json")
    assert humans["capability_ids"] == ["accessibility.goal-routing"]
    assert dependencies["capability_ids"] == ["application/json"]


def test_v010_search_can_filter_dependency_reference_surface(tmp_path):
    from axm_capability_atlas.search import build_search_index, search_index

    _, _, _, _, cards = _enriched_fixture_cards(tmp_path)
    index = build_search_index(cards)
    result = search_index(
        index,
        "application/json",
        filters={"human_surface": "DEPENDENCY_REFERENCE"},
    )
    assert result["result_count"] == 1
    assert result["results"][0]["capability_id"] == "application/json"
    assert result["results"][0]["registry_role"] == "CONSUMER_ONLY_DEPENDENCY"


def test_v010_registry_role_change_triggers_card_and_module_two_recheck(tmp_path):
    from copy import deepcopy
    from axm_capability_atlas.discovery_integrity import classify_registry_role
    from axm_capability_atlas.registry_snapshot import build_registry_snapshot
    from axm_capability_atlas.registry_diff import compare_registry_snapshots

    _, source = _fixture_repo(tmp_path / "repo")
    _, adapted = adapt_file(source)
    dependency = next(
        deepcopy(item.normalized)
        for item in adapted
        if item.normalized["capability_id"] == "application/json"
    )
    before = build_registry_snapshot([dependency])

    promoted = deepcopy(dependency)
    promoted["registry_context"]["providers"] = ["json-consumer"]
    promoted["registry_context"]["provider_statuses"] = [{"id": "json-consumer", "status": "TEST"}]
    promoted["registry_context"]["registry_role"] = classify_registry_role(
        {"providers": ["json-consumer"], "consumers": promoted["registry_context"]["consumers"]}
    )
    after = build_registry_snapshot([promoted])
    diff = compare_registry_snapshots(before, after)

    change = diff["changed"][0]
    assert "registry_role_changed" in change["categories"]
    assert "application/json" in diff["rebuild_plan"]["rebuild_capability_cards"]
    assert "application/json" in diff["rebuild_plan"]["rerun_human_interface_intelligence"]


def test_v010_stale_discovery_hard_blocks_batch_plan(tmp_path):
    from axm_capability_atlas.public_intake import prepare_axm_public_intake

    repo, _ = _fixture_repo(tmp_path / "repo")
    modules_path = repo / "registry" / "modules.json"
    modules = load_json(modules_path)
    modules["summary"]["capabilities"] = 2
    _write_json(modules_path, modules)
    _complete_discovery_bundle(repo)

    status_path = repo / "registry" / "public-status.json"
    status = load_json(status_path)
    status["release_status"] = "WORKING"
    _write_json(status_path, status)

    output = tmp_path / "held"
    result = prepare_axm_public_intake(repo, output, batch_size=100)
    assert result["status"] == "TEST_HOLD_REVIEW"
    assert result["discovery_integrity_valid"] is False
    assert result["batch_plan"] == ""
    assert any("discovery bundle" in item.lower() for item in result["blockers"])


def test_v010_dependency_reference_gets_orientation_not_operational_course(tmp_path):
    from axm_capability_atlas.learning import course_plan, learning_atoms

    _, _, _, _, cards = _enriched_fixture_cards(tmp_path)
    dependency = next(item for item in cards if item["capability_id"] == "application/json")
    plan = course_plan(dependency)
    kinds = [item["kind"] for item in learning_atoms(dependency)]

    assert plan["plan_type"] == "dependency_reference_orientation"
    assert plan["registry_role"] == "CONSUMER_ONLY_DEPENDENCY"
    assert "guided_use" not in kinds
    assert "inputs" not in kinds
    assert "outputs" not in kinds
    assert "consumers" in kinds
    assert "where AXM consumes it" in plan["goal"]


def test_v010_declared_promotion_selftest_hash_drift_is_detected(tmp_path):
    repo, _ = _fixture_repo(tmp_path / "repo")
    modules_path = repo / "registry" / "modules.json"
    modules = load_json(modules_path)
    modules["summary"]["capabilities"] = 2
    _write_json(modules_path, modules)
    _complete_discovery_bundle(repo)

    selftest_path = repo / "tools" / "accessibility-adaptation-lab" / "selftest.js"
    index_path = repo / "tools-index.json"
    index = load_json(index_path)
    index["tools"][0]["selftest"]["promotionPath"] = "tools/accessibility-adaptation-lab/selftest.js"
    index["tools"][0]["selftest"]["sha256"] = _sha(selftest_path)
    _write_json(index_path, index)

    assert build_discovery_integrity_report(repo)["valid"] is True

    selftest_path.write_text("changed selftest bytes\n", encoding="utf-8")
    report = build_discovery_integrity_report(repo)
    assert report["valid"] is False
    assert report["summary"]["module_test_hash_mismatch_count"] == 1
    assert report["module_test_hash_mismatches"][0]["module_id"] == "accessibility-adaptation-lab"


def test_v010_non_public_source_declarations_remain_capabilities_in_coverage(tmp_path):
    from axm_capability_atlas.quality import build_quality_report

    source_path = Path(__file__).resolve().parents[1] / "fixtures" / "source" / "file_rename.json"
    source = load_json(source_path)
    card = build_card(source, source_path)
    report = build_quality_report([card])
    assert report["summary"]["registry_identifier_count"] == 1
    assert report["summary"]["provider_backed_capability_count"] == 1
    assert report["summary"]["capability_count"] == 1
    assert report["capabilities"][0]["registry_role"] == "NON_PUBLIC_CAPABILITY"


def test_v011_public_intake_rejects_output_inside_source_repository(tmp_path):
    from axm_capability_atlas.public_intake import prepare_axm_public_intake
    import pytest

    repo, _ = _fixture_repo(tmp_path / "repo")
    with pytest.raises(ValueError, match="may not be the repository or a descendant"):
        prepare_axm_public_intake(repo, repo / "atlas-output")


def test_v011_public_preflight_tamper_blocks_planned_batch(tmp_path):
    from axm_capability_atlas.public_intake import prepare_axm_public_intake
    from axm_capability_atlas.batching import build_batch
    import pytest

    repo, _ = _fixture_repo(tmp_path / "repo")
    modules_path = repo / "registry" / "modules.json"
    modules = load_json(modules_path)
    modules["summary"]["capabilities"] = 2
    _write_json(modules_path, modules)
    _complete_discovery_bundle(repo)

    output = tmp_path / "prepared"
    result = prepare_axm_public_intake(repo, output, batch_size=2)
    assert result["status"] == "READY_FOR_BATCH_PRODUCTION"
    plan = load_json(output / "batch_plan.json")

    targets = output / "reports" / "human_capability_targets.json"
    value = load_json(targets)
    value["capability_ids"].append("tampered.capability")
    value["count"] += 1
    _write_json(targets, value)

    with pytest.raises(ValueError, match="Upstream ingestion/preflight evidence changed"):
        build_batch(plan, output, "batch_0001", tmp_path / "batches")


def test_v011_repository_source_drift_after_preflight_blocks_batch(tmp_path):
    from axm_capability_atlas.public_intake import prepare_axm_public_intake
    from axm_capability_atlas.batching import build_batch
    import pytest

    repo, _ = _fixture_repo(tmp_path / "repo")
    modules_path = repo / "registry" / "modules.json"
    modules = load_json(modules_path)
    modules["summary"]["capabilities"] = 2
    _write_json(modules_path, modules)
    _complete_discovery_bundle(repo)

    output = tmp_path / "prepared"
    result = prepare_axm_public_intake(repo, output, batch_size=2)
    assert result["status"] == "READY_FOR_BATCH_PRODUCTION"
    plan = load_json(output / "batch_plan.json")

    manifest_path = repo / "tools" / "accessibility-adaptation-lab" / "manifest.json"
    manifest = load_json(manifest_path)
    manifest["summary"] = "changed after sealed preflight"
    _write_json(manifest_path, manifest)

    with pytest.raises(ValueError, match="Upstream ingestion/preflight evidence changed"):
        build_batch(plan, output, "batch_0001", tmp_path / "batches")


def test_v011_dirty_git_snapshot_requires_explicit_allow_dirty(tmp_path):
    from axm_capability_atlas.public_intake import prepare_axm_public_intake
    import shutil
    import subprocess
    import pytest

    if shutil.which("git") is None:
        pytest.skip("git unavailable")

    repo, _ = _fixture_repo(tmp_path / "repo")
    modules_path = repo / "registry" / "modules.json"
    modules = load_json(modules_path)
    modules["summary"]["capabilities"] = 2
    _write_json(modules_path, modules)
    _complete_discovery_bundle(repo)

    subprocess.run(["git", "init", "-q", str(repo)], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.email", "fixture@example.invalid"], check=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.name", "Fixture"], check=True)
    subprocess.run(["git", "-C", str(repo), "add", "."], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-qm", "fixture snapshot"], check=True)

    manifest_path = repo / "tools" / "accessibility-adaptation-lab" / "manifest.json"
    manifest = load_json(manifest_path)
    manifest["notes"] = "dirty but internally consistent"
    _write_json(manifest_path, manifest)
    modules = load_json(modules_path)
    modules["modules"][0]["manifest"]["sha256"] = _sha(manifest_path)
    _write_json(modules_path, modules)
    _complete_discovery_bundle(repo)

    held = prepare_axm_public_intake(repo, tmp_path / "held", batch_size=2)
    assert held["status"] == "TEST_HOLD_REVIEW"
    assert any("repository snapshot is dirty" in item.lower() for item in held["blockers"])

    allowed = prepare_axm_public_intake(
        repo,
        tmp_path / "allowed",
        batch_size=2,
        allow_dirty_repository=True,
    )
    assert allowed["status"] == "READY_FOR_BATCH_PRODUCTION"
    assert allowed["repository_snapshot"]["git"]["dirty"] is True
    assert any("allow-dirty" in item.lower() for item in allowed["warnings"])


def test_v011_plan_semantic_hash_is_stable_across_fresh_equivalent_intakes(tmp_path):
    from axm_capability_atlas.public_intake import prepare_axm_public_intake

    repo, _ = _fixture_repo(tmp_path / "repo")
    modules_path = repo / "registry" / "modules.json"
    modules = load_json(modules_path)
    modules["summary"]["capabilities"] = 2
    _write_json(modules_path, modules)
    _complete_discovery_bundle(repo)

    first = tmp_path / "first"
    second = tmp_path / "second"
    assert prepare_axm_public_intake(repo, first, batch_size=1)["status"] == "READY_FOR_BATCH_PRODUCTION"
    assert prepare_axm_public_intake(repo, second, batch_size=1)["status"] == "READY_FOR_BATCH_PRODUCTION"

    plan_a = load_json(first / "batch_plan.json")
    plan_b = load_json(second / "batch_plan.json")
    assert plan_a["plan_semantic_hash"] == plan_b["plan_semantic_hash"]
    # Exact run evidence includes timestamps/path-bound report bytes and may differ.
    assert plan_a["plan_hash"] != plan_b["plan_hash"]



def test_v011_public_preflight_binds_normalized_inventory_and_exact_paths(tmp_path):
    from axm_capability_atlas.public_intake import prepare_axm_public_intake
    from axm_capability_atlas.public_preflight import verify_public_intake_preflight

    repo, _ = _fixture_repo(tmp_path / "repo")
    modules_path = repo / "registry" / "modules.json"
    modules = load_json(modules_path)
    modules["summary"]["capabilities"] = 2
    _write_json(modules_path, modules)
    _complete_discovery_bundle(repo)

    output = tmp_path / "prepared"
    assert prepare_axm_public_intake(repo, output, batch_size=2)["status"] == "READY_FOR_BATCH_PRODUCTION"
    preflight = load_json(output / "public_intake_preflight.json")
    assert verify_public_intake_preflight(output, preflight, repository_root=repo)["valid"] is True

    tampered = dict(preflight)
    tampered["repository_root_at_generation"] = "/silently/redirected/repository"
    result = verify_public_intake_preflight(output, tampered, repository_root=repo)
    assert result["valid"] is False
    assert any("preflight_hash mismatch" in item for item in result["issues"])

    normalized = next((output / "normalized_sources").glob("*.json"))
    value = load_json(normalized)
    value["description"] = "changed after public preflight"
    _write_json(normalized, value)
    result = verify_public_intake_preflight(output, preflight, repository_root=repo)
    assert result["valid"] is False
    assert any("normalized inventory" in item.lower() for item in result["issues"])


def test_v011_preflight_semantic_hash_is_stable_while_exact_hash_is_run_specific(tmp_path):
    from axm_capability_atlas.public_intake import prepare_axm_public_intake

    repo, _ = _fixture_repo(tmp_path / "repo")
    modules_path = repo / "registry" / "modules.json"
    modules = load_json(modules_path)
    modules["summary"]["capabilities"] = 2
    _write_json(modules_path, modules)
    _complete_discovery_bundle(repo)

    first = tmp_path / "first"
    second = tmp_path / "second"
    assert prepare_axm_public_intake(repo, first, batch_size=1)["status"] == "READY_FOR_BATCH_PRODUCTION"
    assert prepare_axm_public_intake(repo, second, batch_size=1)["status"] == "READY_FOR_BATCH_PRODUCTION"
    a = load_json(first / "public_intake_preflight.json")
    b = load_json(second / "public_intake_preflight.json")
    assert a["preflight_semantic_hash"] == b["preflight_semantic_hash"]
    assert a["preflight_hash"] != b["preflight_hash"]


def test_v011_public_in_progress_marker_blocks_external_preflight_verification(tmp_path):
    from axm_capability_atlas import PUBLIC_INTAKE_IN_PROGRESS_MARKER
    from axm_capability_atlas.public_intake import prepare_axm_public_intake
    from axm_capability_atlas.public_preflight import verify_public_intake_preflight
    from axm_capability_atlas.io import save_json

    repo, _ = _fixture_repo(tmp_path / "repo")
    modules_path = repo / "registry" / "modules.json"
    modules = load_json(modules_path)
    modules["summary"]["capabilities"] = 2
    _write_json(modules_path, modules)
    _complete_discovery_bundle(repo)

    output = tmp_path / "prepared"
    result = prepare_axm_public_intake(repo, output, batch_size=2)
    assert result["status"] == "READY_FOR_BATCH_PRODUCTION"
    assert verify_public_intake_preflight(output, repository_root=repo)["valid"] is True

    save_json(output / PUBLIC_INTAKE_IN_PROGRESS_MARKER, {
        "public_intake_state_version": "0.1.0",
        "state": "IN_PROGRESS",
    })
    held = verify_public_intake_preflight(output, repository_root=repo)
    assert held["valid"] is False
    assert any("marked IN_PROGRESS" in issue for issue in held["issues"])
    assert verify_public_intake_preflight(
        output, repository_root=repo, ignore_in_progress=True
    )["valid"] is True


def test_v011_failed_public_reprepare_invalidates_old_plan_and_leaves_marker(tmp_path, monkeypatch):
    import axm_capability_atlas.public_intake as public_intake
    from axm_capability_atlas import PUBLIC_INTAKE_IN_PROGRESS_MARKER

    repo, _ = _fixture_repo(tmp_path / "repo")
    modules_path = repo / "registry" / "modules.json"
    modules = load_json(modules_path)
    modules["summary"]["capabilities"] = 2
    _write_json(modules_path, modules)
    _complete_discovery_bundle(repo)

    output = tmp_path / "prepared"
    first = public_intake.prepare_axm_public_intake(repo, output, batch_size=2)
    assert first["status"] == "READY_FOR_BATCH_PRODUCTION"
    assert (output / "batch_plan.json").is_file()

    def fail_discovery(_repo):
        raise RuntimeError("injected public reprepare failure")

    monkeypatch.setattr(public_intake, "build_discovery_integrity_report", fail_discovery)
    with pytest.raises(RuntimeError, match="injected public reprepare failure"):
        public_intake.prepare_axm_public_intake(repo, output, batch_size=2)

    assert not (output / "batch_plan.json").exists()
    assert not (output / "public_intake_preflight.json").exists()
    assert not (output / "AXM_PUBLIC_INTAKE_SUMMARY.json").exists()
    assert (output / PUBLIC_INTAKE_IN_PROGRESS_MARKER).is_file()
