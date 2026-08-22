from __future__ import annotations

from pathlib import Path
import hashlib
import json

from axm_capability_atlas.adapters import adapt_file, detect_file
from axm_capability_atlas.ingest import ingest_path
from axm_capability_atlas.validators import validate_card, validate_source, validate_ingestion_report

ROOT = Path(__file__).resolve().parents[1]
FIX = ROOT / "fixtures" / "adapters"


def test_detects_supported_manifest_shapes():
    expected = {
        "generic_single.json": "generic_single",
        "array_registry.json": "list_collection",
        "id_map_registry.json": "id_keyed_map",
        "nested_manifest.json": "nested_or_enveloped_registry",
        "modules_manifest.json": "nested_or_enveloped_registry",
        "capabilities.jsonl": "jsonl_records",
    }
    for name, format_id in expected.items():
        detection = detect_file(FIX / name)
        assert detection.format_id == format_id
        assert detection.candidate_count >= 1


def test_id_keyed_map_uses_container_key_with_explicit_inference():
    _, records = adapt_file(FIX / "id_map_registry.json")
    alpha = records[0].normalized
    assert alpha is not None
    assert alpha["capability_id"] == "axm.example.map.alpha"
    inference = alpha["adapter_trace"]["inferences"][0]
    assert inference["rule"] == "container_key_as_capability_id"
    assert inference["field"] == "/capability_id"


def test_jsonl_preserves_line_provenance():
    _, records = adapt_file(FIX / "capabilities.jsonl")
    assert len(records) == 2
    assert records[0].normalized is not None
    assert records[0].normalized["source_reference"]["source_line"] == 1
    assert records[1].normalized["source_reference"]["source_line"] == 2


def test_list_record_without_stable_id_is_rejected():
    _, records = adapt_file(FIX / "list_missing_id.json")
    assert len(records) == 1
    assert records[0].status == "rejected"
    assert "stable capability identifier" in records[0].errors[0]


def test_unknown_document_is_not_forced_into_a_capability():
    detection = detect_file(FIX / "unknown_document.json")
    assert detection.format_id == "unknown"
    _, records = adapt_file(FIX / "unknown_document.json")
    assert records == []


def test_all_accepted_adapter_outputs_validate():
    for path in FIX.iterdir():
        detection, records = adapt_file(path)
        if detection.format_id == "unknown":
            continue
        for record in records:
            if record.status == "accepted":
                assert record.normalized is not None
                assert validate_source(record.normalized) == []


def test_ingestion_builds_cards_and_preserves_original_hash(tmp_path):
    report = ingest_path(FIX, tmp_path / "ingested")
    assert report["summary"]["files_seen"] == 8
    assert report["summary"]["records_accepted"] == 10
    assert report["summary"]["records_rejected"] == 1
    assert report["summary"]["cards_built"] == 10
    assert report["summary"]["files_unrecognized"] == 1
    assert validate_ingestion_report(report) == []

    source = FIX / "generic_single.json"
    expected_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    card_files = list((tmp_path / "ingested" / "generated").glob("*/capability_card.json"))
    cards = [json.loads(path.read_text(encoding="utf-8")) for path in card_files]
    card = next(item for item in cards if item["capability_id"] == "axm.example.generic-rename")
    assert card["source_reference"]["source_hash"] == expected_hash
    assert card["source_reference"]["source_location"] == str(source)
    assert card["source_reference"]["adapter_id"] == "generic-manifest-v1"
    assert validate_card(card) == []


def test_duplicate_ids_are_reported_without_overwrite(tmp_path):
    source_dir = tmp_path / "sources"
    source_dir.mkdir()
    for index in (1, 2):
        (source_dir / f"source-{index}.json").write_text(json.dumps({
            "id": "axm.duplicate.same-id",
            "name": f"duplicate_{index}",
            "description": f"Duplicate source {index}",
            "input_types": ["text"],
            "output_types": ["text"],
        }), encoding="utf-8")

    report = ingest_path(source_dir, tmp_path / "out")
    assert report["summary"]["records_accepted"] == 2
    assert report["summary"]["duplicate_capability_id_count"] == 1
    duplicates = report["duplicates"]["axm.duplicate.same-id"]
    assert len(duplicates) == 2
    normalized = list((tmp_path / "out" / "normalized_sources").glob("*.json"))
    assert len(normalized) == 2
