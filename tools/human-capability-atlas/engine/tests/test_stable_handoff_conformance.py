from pathlib import Path
import json

from axm_capability_atlas.atlas import build_card
from axm_capability_atlas.conformance import (
    validate_stable_evidence_policy,
    validate_stable_handoff_card,
)
from axm_capability_atlas.validators import validate_card

ROOT = Path(__file__).resolve().parents[1]


def test_all_ten_shared_fixtures_pass_strict_stable_handoff_policy():
    paths = sorted((ROOT / "fixtures" / "source").glob("*.json"))
    assert len(paths) == 10
    for path in paths:
        source = json.loads(path.read_text(encoding="utf-8"))
        card = build_card(source, path)
        assert validate_card(card) == [], path.name
        result = validate_stable_handoff_card(card)
        assert result["valid"] is True, (path.name, result)


def test_generated_human_name_has_full_inference_evidence():
    path = ROOT / "fixtures" / "source" / "image_background_replace.json"
    source = json.loads(path.read_text(encoding="utf-8"))
    card = build_card(source, path)
    item = next(
        item
        for item in card["knowledge"]["inferences"]
        if item["field"] == "/identity/human_name"
    )
    assert item["reasoning"]
    assert item["source_basis"]
    assert 0 <= item["confidence"] <= 1
    assert item["evidence_reference"]["source_hash"] == card["source_reference"]["source_hash"]


def test_unknown_default_boolean_is_not_misrepresented_as_known_false(tmp_path):
    source_path = tmp_path / "sparse.json"
    source = {
        "capability_id": "axm.sparse.risk",
        "revision": "1",
        "machine_name": "sparse_risk",
        "description": "Sparse capability.",
        "why_it_matters": "Test sparse evidence.",
        "examples": ["Example"],
        "risk_profile": {"risk_level": "high"},
    }
    source_path.write_text(json.dumps(source), encoding="utf-8")
    card = build_card(source, source_path)
    assert card["risk_profile"]["human_confirmation_required"] is False
    assert card["knowledge"]["field_states"][
        "/risk_profile/human_confirmation_required"
    ] == "unknown"
    assert "/risk_profile/human_confirmation_required" in card["knowledge"]["unknowns"]


def test_1800_generated_human_names_remain_strictly_evidenced(tmp_path):
    # In-memory stress at the expected local registry scale.
    for index in range(1800):
        source_path = tmp_path / f"{index}.json"
        source_path.write_text(
            json.dumps({
                "capability_id": f"axm.scale.evidence.{index}",
                "revision": "1",
                "machine_name": f"scale_evidence_{index}",
                "description": "Scale evidence test.",
                "why_it_matters": "Verifies inference provenance.",
                "examples": ["Example"],
            }),
            encoding="utf-8",
        )
        source = json.loads(source_path.read_text(encoding="utf-8"))
        card = build_card(source, source_path)
        assert validate_stable_evidence_policy(card) == []
