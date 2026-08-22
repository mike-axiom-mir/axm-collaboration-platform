from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import json

import pytest
from jsonschema import Draft202012Validator

from axm_capability_atlas.batching import build_batch, build_batch_plan
from axm_capability_atlas.ingest import ingest_path
from axm_capability_atlas.io import load_json
from axm_capability_atlas.normalized_inventory import (
    build_normalized_inventory,
    verify_normalized_inventory,
)
from axm_capability_atlas.source_seal import build_source_seal


ROOT = Path(__file__).resolve().parents[1]


def _intake(tmp_path: Path) -> Path:
    source = tmp_path / "source"
    source.mkdir()
    for path in sorted((ROOT / "fixtures" / "source").glob("*.json"))[:2]:
        (source / path.name).write_bytes(path.read_bytes())
    seal = build_source_seal(source)
    intake = tmp_path / "intake"
    report = ingest_path(source, intake, build_cards=False, source_seal=seal)
    assert report["summary"]["records_accepted"] == 2
    return intake


def test_v011_all_bundled_schemas_are_valid_and_mirrored():
    root_schemas = ROOT / "schemas"
    package_schemas = ROOT / "src" / "axm_capability_atlas" / "schemas"
    root_names = sorted(path.name for path in root_schemas.glob("*.json"))
    package_names = sorted(path.name for path in package_schemas.glob("*.json"))
    assert root_names == package_names
    assert "normalized_inventory.schema.json" in root_names

    for name in root_names:
        root_bytes = (root_schemas / name).read_bytes()
        package_bytes = (package_schemas / name).read_bytes()
        assert root_bytes == package_bytes, name
        schema = json.loads(root_bytes.decode("utf-8"))
        Draft202012Validator.check_schema(schema)


def test_v011_normalized_inventory_has_exact_and_semantic_hashes(tmp_path):
    intake = _intake(tmp_path)
    original = load_json(intake / "normalized_inventory.json")
    verified = verify_normalized_inventory(intake, original)
    assert verified["valid"] is True
    assert len(original["inventory_hash"]) == 64
    assert len(original["inventory_semantic_hash"]) == 64

    # A verification timestamp/path-independent refresh changes exact file bytes
    # but not the normalized technical semantics.
    normalized_path = next((intake / "normalized_sources").glob("*.json"))
    record = load_json(normalized_path)
    record["source_reference"]["last_verified_at"] = "2099-01-01T00:00:00+00:00"
    normalized_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    refreshed = build_normalized_inventory(intake)
    assert refreshed["inventory_hash"] != original["inventory_hash"]
    assert refreshed["inventory_semantic_hash"] == original["inventory_semantic_hash"]

    record["description"] = "A materially changed normalized meaning."
    normalized_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    changed = build_normalized_inventory(intake)
    assert changed["inventory_semantic_hash"] != original["inventory_semantic_hash"]


def test_v011_tampered_normalized_inventory_blocks_production_before_batch(tmp_path):
    intake = _intake(tmp_path)
    path = next((intake / "normalized_sources").glob("*.json"))
    value = load_json(path)
    value["description"] = "tampered after ingestion before planning"
    path.write_text(json.dumps(value), encoding="utf-8")

    plan = build_batch_plan(intake, batch_size=2)
    assert plan["upstream_ingestion"]["preflight_status"] == "TEST_HOLD_REVIEW"
    assert plan["upstream_ingestion"]["normalized_inventory_valid"] is False
    with pytest.raises(ValueError, match="TEST_HOLD_REVIEW"):
        build_batch(plan, intake, "batch_0001", tmp_path / "batches")
