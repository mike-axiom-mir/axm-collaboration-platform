from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

from axm_hii.engine import recommend_interface

ROOT = Path(__file__).resolve().parent.parent
VALIDATOR_PATH = ROOT / "validators" / "validate.py"
spec = importlib.util.spec_from_file_location("shared_validate_recommendation", VALIDATOR_PATH)
assert spec and spec.loader
validate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validate)


@pytest.mark.parametrize("fixture_path", sorted((ROOT / "fixtures").glob("*.json")), ids=lambda p: p.stem)
def test_generated_recommendations_validate(fixture_path: Path) -> None:
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    recommendation = recommend_interface(
        fixture["shared_capability_record"], fixture["recommendation_context"], generated_at="2026-08-03T03:56:47Z"
    )
    result = validate.validate_instance(recommendation, "recommendation")
    assert result["valid"], result["errors"]
