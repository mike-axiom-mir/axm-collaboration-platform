from pathlib import Path
import json
import shutil

from axm_capability_atlas.source_seal import build_source_seal, verify_source_seal
from axm_capability_atlas.batching import (
    build_batch_plan, verify_batch_plan, build_batch, verify_batch_receipt,
    finalize_batch_run, portable_record_key, portable_normalized_sha256,
    verify_plan_source_alignment, verify_production_run_manifest,
)
from axm_capability_atlas.ingest import ingest_path
from axm_capability_atlas.io import load_json
from axm_capability_atlas.validators import (
    validate_source_seal, validate_batch_plan, validate_batch_receipt,
    validate_production_run_manifest,
)

ROOT = Path(__file__).resolve().parents[1]


def _normalized_fixture_intake(tmp_path, *, sealed=True):
    source = ROOT / "fixtures" / "source"
    out = tmp_path / "intake"
    seal = build_source_seal(source) if sealed else None
    ingest_path(source, out, build_cards=False, source_seal=seal)
    return source, out



def test_batch_plan_carries_clean_sealed_upstream_anchor(tmp_path):
    source, intake = _normalized_fixture_intake(tmp_path, sealed=True)
    seal = build_source_seal(source)
    plan = build_batch_plan(intake, batch_size=10)
    assert plan["upstream_ingestion"]["preflight_status"] == "READY"
    assert plan["upstream_ingestion"]["source_seal_hash"] == seal["seal_hash"]


def test_unsealed_ingestion_can_build_but_cannot_finalize_complete(tmp_path):
    _, intake = _normalized_fixture_intake(tmp_path, sealed=False)
    plan = build_batch_plan(intake, batch_size=10)
    assert plan["upstream_ingestion"]["preflight_status"] == "UNSEALED_SCOPE"
    output = tmp_path / "work"
    build_batch(plan, intake, "batch_0001", output)
    final = finalize_batch_run(plan, intake, output)
    assert final["status"] == "TEST_HOLD_REVIEW"
    assert any("UNSEALED_SCOPE" in issue for issue in final["issues"])

def test_source_seal_is_path_relative_and_detects_mutation(tmp_path):
    source = tmp_path / "src"
    source.mkdir()
    (source / "a.json").write_text('{"a":1}', encoding="utf-8")
    nested = source / "nested"; nested.mkdir()
    (nested / "b.jsonl").write_text('{"b":2}\n', encoding="utf-8")
    seal = build_source_seal(source)
    assert validate_source_seal(seal) == []
    assert [item["relative_path"] for item in seal["files"]] == ["a.json", "nested/b.jsonl"]
    assert verify_source_seal(source, seal)["valid"] is True
    (source / "a.json").write_text('{"a":3}', encoding="utf-8")
    result = verify_source_seal(source, seal)
    assert result["valid"] is False
    assert result["summary"]["changed_count"] == 1


def test_source_seal_detects_added_and_missing_files(tmp_path):
    source = tmp_path / "src"; source.mkdir()
    (source / "a.json").write_text('{}', encoding="utf-8")
    seal = build_source_seal(source)
    (source / "a.json").unlink()
    (source / "b.json").write_text('{}', encoding="utf-8")
    result = verify_source_seal(source, seal)
    assert result["summary"]["missing_count"] == 1
    assert result["summary"]["added_count"] == 1


def test_batch_plan_is_deterministic_and_complete(tmp_path):
    _, intake = _normalized_fixture_intake(tmp_path)
    a = build_batch_plan(intake, batch_size=3)
    b = build_batch_plan(intake, batch_size=3)
    assert validate_batch_plan(a) == []
    assert a["plan_hash"] == b["plan_hash"]
    assert a["summary"]["record_count"] == 10
    assert a["summary"]["batch_count"] == 4
    assert verify_batch_plan(a)["valid"] is True
    keys = [r["record_key"] for batch in a["batches"] for r in batch["records"]]
    assert len(keys) == len(set(keys)) == 10


def test_portable_record_key_ignores_source_location_move(tmp_path):
    record = {
        "capability_id": "axm.example",
        "revision": "1",
        "source_reference": {"source_hash": "a"*64, "source_pointer": "/x", "source_location": "/old/a.json"},
    }
    moved = json.loads(json.dumps(record))
    moved["source_reference"]["source_location"] = "/new/a.json"
    assert portable_record_key(record) == portable_record_key(moved)



def test_portable_normalized_hash_ignores_relocation_and_verification_time():
    record = {
        "capability_id": "axm.portable",
        "revision": "1",
        "machine_name": "portable",
        "description": "Portable record.",
        "source_reference": {
            "source_hash": "a"*64,
            "source_pointer": "/x",
            "source_location": "/old/source.json",
            "last_verified_at": "2026-01-01T00:00:00Z",
        },
    }
    moved = json.loads(json.dumps(record))
    moved["source_reference"]["source_location"] = "/new/source.json"
    moved["source_reference"]["last_verified_at"] = "2026-08-08T00:00:00Z"
    assert portable_normalized_sha256(record) == portable_normalized_sha256(moved)
    moved["description"] = "Changed technical meaning."
    assert portable_normalized_sha256(record) != portable_normalized_sha256(moved)

def test_batch_build_resume_verify_and_finalize(tmp_path):
    _, intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=4)
    output = tmp_path / "work"
    for batch in plan["batches"]:
        receipt = build_batch(plan, intake, batch["batch_id"], output)
        assert validate_batch_receipt(receipt) == []
        assert receipt["status"] == "PASS"
        check = verify_batch_receipt(plan, intake, batch["batch_id"], output)
        assert check["valid"] is True
    final = finalize_batch_run(plan, intake, output)
    assert validate_production_run_manifest(final) == []
    assert final["status"] == "COMPLETE_VERIFIED"
    assert final["merge_claim"] is False
    assert final["summary"]["verified_records"] == 10

    # A second run must reuse all outputs rather than regenerate them.
    first = plan["batches"][0]
    receipt = build_batch(plan, intake, first["batch_id"], output, resume=True)
    assert receipt["summary"]["built"] == 0
    assert receipt["summary"]["reused"] == first["record_count"]



def test_completed_batch_directory_can_be_relocated_before_verification(tmp_path):
    _, intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=10)
    output = tmp_path / "work"
    build_batch(plan, intake, "batch_0001", output)
    moved = tmp_path / "moved_work"
    shutil.copytree(output, moved)
    check = verify_batch_receipt(plan, intake, "batch_0001", moved)
    assert check["valid"] is True

def test_incomplete_batch_run_refuses_finalization(tmp_path):
    _, intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=5)
    output = tmp_path / "work"
    build_batch(plan, intake, "batch_0001", output)
    final = finalize_batch_run(plan, intake, output)
    assert final["status"] == "TEST_HOLD_REVIEW"
    assert final["summary"]["missing_records"] == 5


def test_tampered_batch_output_is_detected(tmp_path):
    _, intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=10)
    output = tmp_path / "work"
    build_batch(plan, intake, "batch_0001", output)
    card = next((output / "batch_0001" / "records").glob("*/capability_card.json"))
    data = json.loads(card.read_text(encoding="utf-8"))
    data["identity"]["human_name"] = "tampered"
    card.write_text(json.dumps(data), encoding="utf-8")
    check = verify_batch_receipt(plan, intake, "batch_0001", output)
    assert check["valid"] is False
    assert any("producer receipt invalid" in issue.lower() for issue in check["issues"])



def test_ingest_can_enforce_source_seal(tmp_path):
    source = tmp_path / "source"
    shutil.copytree(ROOT / "fixtures" / "source", source)
    seal = build_source_seal(source)
    out = tmp_path / "intake"
    report = ingest_path(source, out, build_cards=False, source_seal=seal)
    assert report["source_seal_verification"]["pre"]["valid"] is True
    assert report["source_seal_verification"]["post"]["valid"] is True
    assert report["summary"]["source_seal_failures"] == 0


def test_batch_plan_detects_added_record_after_planning(tmp_path):
    _, intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=5)
    normalized = intake / "normalized_sources"
    existing = json.loads(next(normalized.glob("*.json")).read_text(encoding="utf-8"))
    extra = json.loads(json.dumps(existing))
    extra["capability_id"] = "axm.added.after.plan"
    extra["source_reference"]["source_pointer"] = "/added"
    (normalized / "added.json").write_text(json.dumps(extra), encoding="utf-8")
    alignment = verify_plan_source_alignment(plan, intake)
    assert alignment["valid"] is False
    assert len(alignment["added_record_keys"]) == 1


def test_batch_receipt_summary_tamper_is_detected(tmp_path):
    _, intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=10)
    output = tmp_path / "work"
    build_batch(plan, intake, "batch_0001", output)
    receipt_path = output / "batch_0001" / "batch_receipt.json"
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    receipt["summary"]["completed"] = 999
    receipt_path.write_text(json.dumps(receipt), encoding="utf-8")
    check = verify_batch_receipt(plan, intake, "batch_0001", output)
    assert check["valid"] is False
    assert any("batch_receipt_hash mismatch" in issue for issue in check["issues"])


def test_batch_receipt_cannot_escape_batch_root(tmp_path):
    _, intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=10)
    output = tmp_path / "work"
    build_batch(plan, intake, "batch_0001", output)
    receipt_path = output / "batch_0001" / "batch_receipt.json"
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    receipt["results"][0]["output_directory"] = "../../outside"
    # Rehash to simulate a deliberately edited, internally rehashed batch receipt.
    from axm_capability_atlas.canonical_json import canonical_sha256
    receipt.pop("batch_receipt_hash", None)
    receipt["batch_receipt_hash"] = canonical_sha256(receipt)
    receipt_path.write_text(json.dumps(receipt), encoding="utf-8")
    check = verify_batch_receipt(plan, intake, "batch_0001", output)
    assert check["valid"] is False
    assert any("escapes the batch root" in issue for issue in check["issues"])


def test_production_manifest_is_tamper_evident(tmp_path):
    _, intake = _normalized_fixture_intake(tmp_path)
    plan = build_batch_plan(intake, batch_size=10)
    output = tmp_path / "work"
    build_batch(plan, intake, "batch_0001", output)
    manifest = finalize_batch_run(plan, intake, output)
    assert verify_production_run_manifest(manifest)["valid"] is True
    tampered = json.loads(json.dumps(manifest))
    tampered["status"] = "TEST_HOLD_REVIEW"
    check = verify_production_run_manifest(tampered)
    assert check["valid"] is False
    assert "manifest_hash mismatch" in check["issues"]

def test_1800_records_partition_without_gap_or_overlap(tmp_path):
    normalized = tmp_path / "normalized_sources"; normalized.mkdir()
    raw = tmp_path / "raw.json"; raw.write_text('{}', encoding="utf-8")
    import hashlib
    source_hash = hashlib.sha256(raw.read_bytes()).hexdigest()
    for index in range(1800):
        record = {
            "capability_id": f"axm.batch.scale.{index:04d}",
            "revision": "1",
            "machine_name": f"batch_scale_{index}",
            "description": "Batch scale fixture.",
            "why_it_matters": "Tests deterministic partitioning.",
            "examples": ["Example"],
            "source_reference": {
                "source_type": "manifest",
                "source_location": str(raw),
                "source_hash": source_hash,
                "source_pointer": f"/{index}",
                "confidence": 1.0,
            },
        }
        (normalized / f"{index:04d}.json").write_text(json.dumps(record), encoding="utf-8")
    plan = build_batch_plan(tmp_path, batch_size=100)
    assert plan["summary"]["record_count"] == 1800
    assert plan["summary"]["batch_count"] == 18
    assert all(batch["record_count"] == 100 for batch in plan["batches"])
    keys = [r["record_key"] for batch in plan["batches"] for r in batch["records"]]
    assert len(keys) == len(set(keys)) == 1800
    assert verify_batch_plan(plan)["valid"] is True
