from __future__ import annotations

from pathlib import Path
import json

import pytest

from axm_capability_atlas.batching import (
    BATCH_IN_PROGRESS_MARKER,
    build_batch,
    build_batch_plan,
    finalize_batch_run,
    verify_batch_receipt,
    verify_production_run_manifest,
    verify_production_run_chain,
)
from axm_capability_atlas.canonical_json import canonical_sha256
from axm_capability_atlas.conformance import (
    BUILD_IN_PROGRESS_MARKER,
    verify_producer_receipt,
)
from axm_capability_atlas.implementation_identity import implementation_fingerprint
from axm_capability_atlas.ingest import ingest_path
from axm_capability_atlas.pipeline import build_from_file
from axm_capability_atlas.source_seal import build_source_seal

ROOT = Path(__file__).resolve().parents[1]


def _normalized_fixture_intake(tmp_path: Path) -> Path:
    source = tmp_path / "source"
    source.mkdir()
    for path in sorted((ROOT / "fixtures" / "source").glob("*.json"))[:2]:
        (source / path.name).write_bytes(path.read_bytes())
    seal = build_source_seal(source)
    intake = tmp_path / "intake"
    report = ingest_path(source, intake, build_cards=False, source_seal=seal)
    assert report["summary"]["records_accepted"] == 2
    return intake


def test_v011_producer_receipt_binds_all_generated_artifacts(tmp_path):
    source = ROOT / "fixtures" / "source" / "file_rename.json"
    out = tmp_path / "built"
    build_from_file(source, out)
    assert verify_producer_receipt(out)["valid"] is True

    quick = out / "quick_view.md"
    quick.write_text(quick.read_text(encoding="utf-8") + "\nTAMPERED\n", encoding="utf-8")
    result = verify_producer_receipt(out)
    assert result["valid"] is False
    assert any("artifact inventory" in issue.lower() for issue in result["issues"])


def test_v011_producer_receipt_schema_is_enforced_even_after_rehash(tmp_path):
    source = ROOT / "fixtures" / "source" / "file_rename.json"
    out = tmp_path / "built"
    build_from_file(source, out)
    path = out / "producer_receipt.json"
    receipt = json.loads(path.read_text(encoding="utf-8"))
    receipt["unexpected_truth_override"] = True
    receipt.pop("producer_receipt_hash")
    receipt["producer_receipt_hash"] = canonical_sha256(receipt)
    path.write_text(json.dumps(receipt), encoding="utf-8")

    result = verify_producer_receipt(out)
    assert result["valid"] is False
    assert any("schema" in issue.lower() for issue in result["issues"])


def test_v011_failed_rebuild_cannot_leave_old_producer_receipt_claiming_complete(tmp_path, monkeypatch):
    import axm_capability_atlas.pipeline as pipeline

    source = ROOT / "fixtures" / "source" / "file_rename.json"
    out = tmp_path / "built"
    build_from_file(source, out)
    assert (out / "producer_receipt.json").is_file()

    real_save = pipeline.save_json

    def fail_after_marker(path, data):
        path = Path(path)
        if path.name == "capability_card.json":
            raise RuntimeError("injected rebuild failure")
        return real_save(path, data)

    monkeypatch.setattr(pipeline, "save_json", fail_after_marker)
    with pytest.raises(RuntimeError, match="injected rebuild failure"):
        pipeline.build_from_file(source, out)

    assert not (out / "producer_receipt.json").exists()
    assert (out / BUILD_IN_PROGRESS_MARKER).is_file()
    result = verify_producer_receipt(out)
    assert result["valid"] is False
    assert any("incomplete" in issue.lower() for issue in result["issues"])


def test_v011_failed_batch_receipt_generation_invalidates_old_batch_completion(tmp_path, monkeypatch):
    import axm_capability_atlas.batching as batching

    intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=2)
    output = tmp_path / "batches"
    build_batch(plan, intake, "batch_0001", output)
    assert (output / "batch_0001" / "batch_receipt.json").is_file()

    monkeypatch.setattr(batching, "validate_batch_receipt", lambda value: ["injected schema failure"])
    with pytest.raises(ValueError, match="injected schema failure"):
        batching.build_batch(plan, intake, "batch_0001", output)

    assert not (output / "batch_0001" / "batch_receipt.json").exists()
    assert (output / "batch_0001" / BATCH_IN_PROGRESS_MARKER).is_file()
    result = verify_batch_receipt(plan, intake, "batch_0001", output)
    assert result["valid"] is False
    assert any("incomplete" in issue.lower() for issue in result["issues"])


def test_v011_plan_receipts_and_manifest_bind_exact_runtime_implementation(tmp_path):
    intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=1)
    expected = implementation_fingerprint()
    assert plan["implementation_fingerprint"] == expected

    output = tmp_path / "batches"
    for batch in plan["batches"]:
        receipt = build_batch(plan, intake, batch["batch_id"], output)
        assert receipt["producer"]["implementation_fingerprint"] == expected
        for result in receipt["results"]:
            if result["status"] in {"BUILT", "REUSED"}:
                assert len(result["producer_receipt_hash"]) == 64
                assert len(result["artifact_set_hash"]) == 64

    manifest = finalize_batch_run(plan, intake, output)
    assert manifest["implementation_fingerprint"] == expected
    assert verify_production_run_manifest(manifest)["valid"] is True


def test_v011_batch_verification_detects_auxiliary_artifact_tampering(tmp_path):
    intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=2)
    output = tmp_path / "batches"
    build_batch(plan, intake, "batch_0001", output)
    practical = next((output / "batch_0001" / "records").glob("*/practical_view.md"))
    practical.write_text("tampered", encoding="utf-8")
    result = verify_batch_receipt(plan, intake, "batch_0001", output)
    assert result["valid"] is False
    assert any("producer receipt" in issue.lower() for issue in result["issues"])


def test_v011_production_manifest_schema_is_enforced_after_internal_rehash(tmp_path):
    intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=2)
    output = tmp_path / "batches"
    build_batch(plan, intake, "batch_0001", output)
    manifest = finalize_batch_run(plan, intake, output)
    assert verify_production_run_manifest(manifest)["valid"] is True

    manifest["automatic_merge_authority"] = True
    manifest.pop("manifest_hash")
    manifest["manifest_hash"] = canonical_sha256(manifest)
    result = verify_production_run_manifest(manifest)
    assert result["valid"] is False
    assert any("schema" in issue.lower() for issue in result["issues"])



def test_v011_full_production_chain_reverification_passes(tmp_path):
    intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=1)
    output = tmp_path / "batches"
    for batch in plan["batches"]:
        build_batch(plan, intake, batch["batch_id"], output)
    manifest = finalize_batch_run(plan, intake, output)

    internal = verify_production_run_manifest(manifest)
    chain = verify_production_run_chain(manifest, plan, intake, output)
    assert internal["valid"] is True
    assert chain["valid"] is True, chain
    assert chain["verified_batch_count"] == len(plan["batches"])
    assert chain["verified_record_count"] == plan["record_count"]


def test_v011_full_chain_detects_post_finalization_artifact_tamper(tmp_path):
    intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=2)
    output = tmp_path / "batches"
    build_batch(plan, intake, "batch_0001", output)
    manifest = finalize_batch_run(plan, intake, output)
    assert verify_production_run_manifest(manifest)["valid"] is True
    assert verify_production_run_chain(manifest, plan, intake, output)["valid"] is True

    # The frozen manifest remains internally self-consistent, but the underlying
    # production artifacts no longer match its evidence chain.
    deep = next((output / "batch_0001" / "records").glob("*/deep_view.md"))
    deep.write_text(deep.read_text(encoding="utf-8") + "\nPOST FINALIZATION TAMPER\n", encoding="utf-8")

    assert verify_production_run_manifest(manifest)["valid"] is True
    chain = verify_production_run_chain(manifest, plan, intake, output)
    assert chain["valid"] is False
    assert any("producer receipt" in issue.lower() for issue in chain["issues"])


def test_v011_full_chain_detects_manifest_plan_substitution(tmp_path):
    intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=2)
    output = tmp_path / "batches"
    build_batch(plan, intake, "batch_0001", output)
    manifest = finalize_batch_run(plan, intake, output)

    altered = dict(plan)
    altered["plan_hash"] = "0" * 64
    result = verify_production_run_chain(manifest, altered, intake, output)
    assert result["valid"] is False
    assert any("plan_hash" in issue for issue in result["issues"])


def test_v011_failed_reingest_invalidates_old_completion_and_leaves_marker(tmp_path, monkeypatch):
    import axm_capability_atlas.ingest as ingest_module
    from axm_capability_atlas import INGEST_IN_PROGRESS_MARKER

    source = tmp_path / "source"
    source.mkdir()
    fixture = ROOT / "fixtures" / "source" / "file_rename.json"
    (source / fixture.name).write_bytes(fixture.read_bytes())
    seal = build_source_seal(source)
    output = tmp_path / "intake"
    first = ingest_module.ingest_path(source, output, build_cards=False, source_seal=seal)
    assert first["summary"]["records_accepted"] == 1
    assert (output / "ingestion_report.json").is_file()

    def fail_discovery(*args, **kwargs):
        raise RuntimeError("injected reingest failure")

    monkeypatch.setattr(ingest_module, "discover_source_files", fail_discovery)
    with pytest.raises(RuntimeError, match="injected reingest failure"):
        ingest_module.ingest_path(source, output, build_cards=False, source_seal=seal)

    assert not (output / "ingestion_report.json").exists()
    assert not (output / "intake_gate_report.json").exists()
    assert not (output / "normalized_inventory.json").exists()
    assert (output / INGEST_IN_PROGRESS_MARKER).is_file()


def test_v011_transactional_production_finalize_invalidates_old_manifest_on_failure(tmp_path, monkeypatch):
    import axm_capability_atlas.batching as batching

    intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=1)
    output = tmp_path / "batches"
    for batch in plan["batches"]:
        build_batch(plan, intake, batch["batch_id"], output)

    target = tmp_path / "production_run_manifest.json"
    manifest = batching.finalize_batch_run_to_file(plan, intake, output, target)
    assert manifest["status"] == "COMPLETE_VERIFIED"
    assert batching.verify_production_run_file(target)["valid"] is True
    marker = batching.production_finalize_marker_path(target)
    assert not marker.exists()

    def fail_finalize(*args, **kwargs):
        raise RuntimeError("injected production finalization failure")

    monkeypatch.setattr(batching, "finalize_batch_run", fail_finalize)
    with pytest.raises(RuntimeError, match="injected production finalization failure"):
        batching.finalize_batch_run_to_file(plan, intake, output, target)

    assert not target.exists()
    assert marker.is_file()
    held = batching.verify_production_run_file(target)
    assert held["valid"] is False
    assert any("IN_PROGRESS" in issue for issue in held["issues"])


def test_v011_production_file_verifier_rejects_marker_even_with_valid_manifest(tmp_path):
    import axm_capability_atlas.batching as batching
    from axm_capability_atlas.io import save_json

    intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=2)
    output = tmp_path / "batches"
    build_batch(plan, intake, "batch_0001", output)
    target = tmp_path / "production_run_manifest.json"
    batching.finalize_batch_run_to_file(plan, intake, output, target)
    assert batching.verify_production_run_file(target)["valid"] is True

    save_json(batching.production_finalize_marker_path(target), {
        "production_finalize_state_version": "0.1.0",
        "state": "IN_PROGRESS",
    })
    result = batching.verify_production_run_file(target)
    assert result["valid"] is False
    assert result["finalize_marker_present"] is True


def test_v011_rehashed_but_semantically_wrong_view_is_rejected(tmp_path):
    from axm_capability_atlas.io import load_json, save_json
    import hashlib

    source = ROOT / "fixtures" / "source" / "file_rename.json"
    out = tmp_path / "built"
    build_from_file(source, out)

    quick = out / "quick_view.md"
    quick.write_text("# Convincing but unsupported replacement view\n", encoding="utf-8")

    # Recalculate every ordinary byte-binding field as though an artifact and
    # receipt were maliciously/coarsely rewritten together. Deterministic
    # regeneration must still reject the semantically wrong view.
    receipt_path = out / "producer_receipt.json"
    receipt = load_json(receipt_path)
    for item in receipt["output"]["artifact_inventory"]:
        path = out / item["relative_path"]
        item["bytes"] = path.stat().st_size
        item["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    receipt["output"]["artifact_set_hash"] = canonical_sha256(
        receipt["output"]["artifact_inventory"]
    )
    receipt.pop("producer_receipt_hash")
    receipt["producer_receipt_hash"] = canonical_sha256(receipt)
    save_json(receipt_path, receipt)

    result = verify_producer_receipt(out)
    assert result["valid"] is False
    assert any("deterministic regeneration" in issue for issue in result["issues"])


def test_v011_batch_plan_verify_cli_can_check_source_alignment(tmp_path):
    import os
    import subprocess
    import sys

    intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=2)
    plan_path = tmp_path / "batch_plan.json"
    plan_path.write_text(json.dumps(plan), encoding="utf-8")
    env = dict(os.environ)
    env["PYTHONPATH"] = str(ROOT / "src")
    result = subprocess.run(
        [
            sys.executable, "-m", "axm_capability_atlas.cli",
            "batch-plan-verify", str(plan_path), str(intake),
        ],
        env=env, text=True, capture_output=True,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    payload = json.loads(result.stdout)
    assert payload["valid"] is True
    assert payload["source_alignment"]["valid"] is True
