from pathlib import Path
import json

from axm_capability_atlas.ingest import ingest_path
from axm_capability_atlas.pipeline import build_from_file
from axm_capability_atlas.conformance import verify_producer_receipt
from axm_capability_atlas.validators import (
    validate_producer_receipt,
    validate_intake_gate,
)

ROOT = Path(__file__).resolve().parents[1]


def test_pipeline_writes_valid_receipt_last(tmp_path):
    source = ROOT / "fixtures" / "source" / "file_rename.json"
    out = tmp_path / "built"
    build_from_file(source, out)
    receipt = json.loads((out / "producer_receipt.json").read_text(encoding="utf-8"))
    assert validate_producer_receipt(receipt) == []
    verified = verify_producer_receipt(out)
    assert verified["valid"] is True


def test_tampered_card_invalidates_receipt(tmp_path):
    source = ROOT / "fixtures" / "source" / "file_rename.json"
    out = tmp_path / "built"
    build_from_file(source, out)
    card_path = out / "capability_card.json"
    card = json.loads(card_path.read_text(encoding="utf-8"))
    card["identity"]["human_name"] = "Tampered"
    card_path.write_text(json.dumps(card), encoding="utf-8")
    result = verify_producer_receipt(out)
    assert result["valid"] is False
    assert any("hash mismatch" in issue.lower() for issue in result["issues"])


def test_ingest_resume_reuses_only_verified_matching_outputs(tmp_path):
    source = ROOT / "fixtures" / "adapters"
    output = tmp_path / "ingest"
    first = ingest_path(source, output)
    assert first["summary"]["cards_built"] == 10
    assert first["summary"]["cards_reused"] == 0

    second = ingest_path(source, output, resume=True)
    assert second["summary"]["cards_built"] == 0
    assert second["summary"]["cards_reused"] == 10
    gate = json.loads((output / "intake_gate_report.json").read_text(encoding="utf-8"))
    assert validate_intake_gate(gate) == []
    assert gate["receipt_verification"]["verified"] == 10


def test_resume_rebuilds_tampered_output(tmp_path):
    source = ROOT / "fixtures" / "adapters"
    output = tmp_path / "ingest"
    first = ingest_path(source, output)
    assert first["summary"]["cards_built"] == 10

    card_path = next((output / "generated").glob("*/capability_card.json"))
    card = json.loads(card_path.read_text(encoding="utf-8"))
    card["identity"]["human_name"] = "tampered"
    card_path.write_text(json.dumps(card), encoding="utf-8")

    second = ingest_path(source, output, resume=True)
    assert second["summary"]["cards_built"] == 1
    assert second["summary"]["cards_reused"] == 9
    assert second["summary"]["producer_receipt_rebuild_trigger_count"] >= 1


def test_reference_fixture_intake_gate_is_honestly_held(tmp_path):
    source = ROOT / "fixtures" / "adapters"
    output = tmp_path / "ingest"
    ingest_path(source, output)
    gate = json.loads((output / "intake_gate_report.json").read_text(encoding="utf-8"))
    # Deliberately includes one unrecognized document and one rejected record.
    assert gate["status"] == "TEST_HOLD_REVIEW"
    assert gate["merge_claim"] is False
    assert gate["blockers"]
