from __future__ import annotations

from pathlib import Path
import json
import os
import shutil

import pytest

import axm_capability_atlas.ingest as ingest_module
from axm_capability_atlas.batching import (
    build_batch_plan,
    finalize_batch_run,
    verify_production_run_manifest,
)
from axm_capability_atlas.ingest import ingest_path
from axm_capability_atlas.io import load_json
from axm_capability_atlas.source_seal import build_source_seal, verify_source_seal
from axm_capability_atlas.validators import (
    validate_batch_plan,
    validate_production_run_manifest,
    validate_source_seal,
)

ROOT = Path(__file__).resolve().parents[1]


def _copy_source_fixtures(target: Path, limit: int | None = None) -> Path:
    target.mkdir(parents=True, exist_ok=True)
    paths = sorted((ROOT / "fixtures" / "source").glob("*.json"))
    if limit is not None:
        paths = paths[:limit]
    for path in paths:
        shutil.copy2(path, target / path.name)
    return target


def test_empty_source_cannot_be_sealed_or_planned(tmp_path):
    source = tmp_path / "empty"
    source.mkdir()
    with pytest.raises(ValueError, match="No supported capability source files"):
        build_source_seal(source)

    normalized = tmp_path / "normalized"
    normalized.mkdir()
    with pytest.raises(ValueError, match="No normalized capability records"):
        build_batch_plan(normalized)


def test_output_directory_may_not_pollute_source_tree(tmp_path):
    source = _copy_source_fixtures(tmp_path / "source", limit=1)
    with pytest.raises(ValueError, match="Output directory may not be"):
        ingest_path(source, source / "intake")


@pytest.mark.skipif(not hasattr(os, "symlink"), reason="symlinks unavailable")
def test_symlinked_capability_source_is_rejected(tmp_path):
    real = _copy_source_fixtures(tmp_path / "real", limit=1)
    source = tmp_path / "source"
    source.mkdir()
    target = next(real.glob("*.json"))
    link = source / "linked.json"
    try:
        link.symlink_to(target)
    except OSError:
        pytest.skip("symlink creation is unavailable in this environment")
    with pytest.raises(ValueError, match="symbolic link"):
        build_source_seal(source)


def test_internal_json_loader_rejects_duplicate_keys(tmp_path):
    path = tmp_path / "ambiguous.json"
    path.write_text('{"status":"PASS","status":"FAIL"}', encoding="utf-8")
    with pytest.raises(ValueError, match="Duplicate JSON object key"):
        load_json(path)


def test_card_build_failure_blocks_intake_even_if_source_normalizes(tmp_path, monkeypatch):
    source = _copy_source_fixtures(tmp_path / "source", limit=2)
    seal = build_source_seal(source)
    output = tmp_path / "out"

    real_builder = ingest_module.build_from_file
    calls = {"count": 0}

    def flaky_builder(source_path, output_dir):
        calls["count"] += 1
        if calls["count"] == 1:
            raise RuntimeError("injected card build failure")
        return real_builder(source_path, output_dir)

    monkeypatch.setattr(ingest_module, "build_from_file", flaky_builder)
    report = ingest_module.ingest_path(source, output, source_seal=seal)

    assert report["summary"]["records_accepted"] == 2
    assert report["summary"]["card_build_failure_count"] == 1
    gate = load_json(output / "intake_gate_report.json")
    assert gate["status"] == "TEST_HOLD_REVIEW"
    assert any("completion gap" in item.lower() for item in gate["blockers"])
    assert any("build(s) failed" in item.lower() for item in gate["blockers"])
    assert any("receipt coverage gap" in item.lower() for item in gate["blockers"])


def test_reusing_output_with_removed_source_record_surfaces_stale_artifact(tmp_path):
    source_all = _copy_source_fixtures(tmp_path / "all")
    out = tmp_path / "intake"
    seal_all = build_source_seal(source_all)
    first = ingest_path(source_all, out, build_cards=False, source_seal=seal_all)
    assert first["summary"]["records_accepted"] == 10

    source_nine = _copy_source_fixtures(tmp_path / "nine", limit=9)
    seal_nine = build_source_seal(source_nine)
    second = ingest_path(source_nine, out, build_cards=False, source_seal=seal_nine)
    assert second["summary"]["records_accepted"] == 9
    assert second["summary"]["stale_normalized_file_count"] == 1

    gate = load_json(out / "intake_gate_report.json")
    assert gate["status"] == "TEST_HOLD_REVIEW"
    assert any("stale normalized" in item.lower() for item in gate["blockers"])

    with pytest.raises(ValueError, match="Stale or untracked normalized"):
        build_batch_plan(out)


def test_source_seal_schema_rejects_empty_files_array(tmp_path):
    source = _copy_source_fixtures(tmp_path / "source", limit=1)
    seal = build_source_seal(source)
    seal["files"] = []
    seal["summary"]["file_count"] = 0
    errors = validate_source_seal(seal)
    assert errors


def test_source_seal_duplicate_relative_path_is_invalid(tmp_path):
    source = _copy_source_fixtures(tmp_path / "source", limit=1)
    seal = build_source_seal(source)
    seal["files"].append(dict(seal["files"][0]))
    # Even if someone recomputes a shape-valid document elsewhere, semantic
    # verification rejects duplicated path identity.
    result = verify_source_seal(source, seal)
    assert result["valid"] is False
    assert any("duplicate relative paths" in item.lower() for item in result["issues"])


def test_production_manifest_verifier_requires_sealed_ready_upstream():
    manifest = {
        "production_run_manifest_version": "0.1.0",
        "plan_hash": "1" * 64,
        "source_seal_hash": "2" * 64,
        "upstream_ingestion": {"preflight_status": "UNSEALED_SCOPE"},
        "planned_record_count": 1,
        "verified_record_keys": ["record-a"],
        "missing_record_keys": [],
        "extra_record_keys": [],
        "batch_validation": [{
            "batch_id": "batch_0001",
            "valid": True,
            "batch_receipt_hash": "3" * 64,
            "batch_hash": "4" * 64,
        }],
        "module_id": "axm.module.human_capability_atlas",
        "module_version": "0.8.0",
        "shared_contract_version": "0.1.0",
        "generated_at": "2026-08-08T00:00:00+00:00",
        "status": "COMPLETE_VERIFIED",
        "merge_claim": False,
        "issues": [],
        "summary": {
            "planned_records": 1,
            "verified_records": 1,
            "missing_records": 0,
            "extra_records": 0,
            "batch_count": 1,
            "verified_batch_count": 1,
        },
    }
    from axm_capability_atlas.canonical_json import canonical_sha256
    manifest["manifest_hash"] = canonical_sha256(manifest)
    result = verify_production_run_manifest(manifest)
    assert result["valid"] is False
    assert any("status is inconsistent" in issue.lower() for issue in result["issues"])


def test_production_manifest_schema_requires_nonempty_seal_hash():
    data = {
        "production_run_manifest_version": "0.1.0",
        "plan_hash": "1" * 64,
        "source_seal_hash": "",
        "upstream_ingestion": {},
        "planned_record_count": 1,
        "verified_record_keys": ["a"],
        "missing_record_keys": [],
        "extra_record_keys": [],
        "batch_validation": [{}],
        "module_id": "axm.module.human_capability_atlas",
        "module_version": "0.8.0",
        "shared_contract_version": "0.1.0",
        "generated_at": "x",
        "status": "TEST_HOLD_REVIEW",
        "merge_claim": False,
        "issues": ["unsealed"],
        "summary": {},
        "manifest_hash": "2" * 64,
    }
    assert validate_production_run_manifest(data)


def test_output_identity_is_portable_when_registry_tree_moves(tmp_path):
    source_a = _copy_source_fixtures(tmp_path / "copy_a", limit=2)
    out = tmp_path / "intake"
    seal_a = build_source_seal(source_a)
    first = ingest_path(source_a, out, source_seal=seal_a)
    names_first = sorted(
        path.name for path in (out / "normalized_sources").glob("*.json")
    )
    assert len(names_first) == 2

    source_b = _copy_source_fixtures(tmp_path / "copy_b", limit=2)
    seal_b = build_source_seal(source_b)
    second = ingest_path(source_b, out, source_seal=seal_b, resume=True)
    names_second = sorted(
        path.name for path in (out / "normalized_sources").glob("*.json")
    )

    assert names_second == names_first
    assert second["summary"]["stale_normalized_file_count"] == 0
    assert second["summary"]["cards_reused"] == 2
    assert second["summary"]["cards_built"] == 0


@pytest.mark.skipif(os.name == "nt", reason="POSIX permission semantics")
def test_atomic_artifact_mode_inherits_parent_privacy_boundary(tmp_path):
    from axm_capability_atlas.io import save_json

    shared = tmp_path / "shared"
    shared.mkdir()
    os.chmod(shared, 0o750)
    out = shared / "record.json"
    save_json(out, {"ok": True})
    assert (out.stat().st_mode & 0o777) == 0o640

    private = tmp_path / "private"
    private.mkdir()
    os.chmod(private, 0o700)
    private_out = private / "record.json"
    save_json(private_out, {"ok": True})
    assert (private_out.stat().st_mode & 0o777) == 0o600
