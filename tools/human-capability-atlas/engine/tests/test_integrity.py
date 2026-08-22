from pathlib import Path
import json

from axm_capability_atlas.atlas import build_card
from axm_capability_atlas.constants import UNKNOWN_TEXT

ROOT = Path(__file__).resolve().parents[1]


def load(name):
    path = ROOT / "fixtures" / "source" / f"{name}.json"
    return json.loads(path.read_text(encoding="utf-8")), path


def test_unknown_is_not_invented():
    source, path = load("incomplete_documentation")
    card = build_card(source, path)
    assert card["purpose"]["plain_explanation"] == UNKNOWN_TEXT
    assert card["purpose"]["why_it_matters"] == UNKNOWN_TEXT
    assert "/purpose/plain_explanation" in card["knowledge"]["unknowns"]


def test_conflict_is_preserved():
    source, path = load("conflicted_declaration")
    card = build_card(source, path)
    assert card["knowledge"]["field_states"]["/output_profile/preview_available"] == "conflicted"
    assert len(card["knowledge"]["conflicts"]) == 1


def test_human_name_inference_is_marked():
    source, path = load("incomplete_documentation")
    card = build_card(source, path)
    assert card["identity"]["human_name"] == "Partial Unknown Capability"
    assert card["knowledge"]["field_states"]["/identity/human_name"] == "inferred"
