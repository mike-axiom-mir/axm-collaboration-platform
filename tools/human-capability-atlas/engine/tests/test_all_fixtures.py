from pathlib import Path
import json

from axm_capability_atlas.atlas import build_card
from axm_capability_atlas.validators import validate_source, validate_card

ROOT = Path(__file__).resolve().parents[1]


def test_all_source_fixtures_build_and_validate():
    paths = sorted((ROOT / "fixtures" / "source").glob("*.json"))
    assert len(paths) == 10
    for path in paths:
        source = json.loads(path.read_text(encoding="utf-8"))
        assert validate_source(source) == [], (path.name, validate_source(source))
        card = build_card(source, path)
        assert validate_card(card) == [], (path.name, validate_card(card))
        assert card["source_reference"]["source_hash"]
