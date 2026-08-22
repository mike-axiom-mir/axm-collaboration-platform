from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
VALIDATOR_PATH = ROOT / "validators" / "validate.py"
spec = importlib.util.spec_from_file_location("shared_validate", VALIDATOR_PATH)
assert spec and spec.loader
validate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validate)


@pytest.mark.parametrize("fixture_path", sorted((ROOT / "fixtures").glob("*.json")), ids=lambda p: p.stem)
def test_all_fixture_capability_records_validate(fixture_path: Path) -> None:
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    result = validate.validate_instance(fixture["shared_capability_record"], "capability")
    assert result["valid"], result["errors"]


@pytest.mark.parametrize("example_path", sorted((ROOT / "examples" / "malformed").glob("*.json")), ids=lambda p: p.stem)
def test_malformed_examples_fail(example_path: Path) -> None:
    result = validate.validate_path(example_path, "auto")
    assert not result["valid"]
    assert result["errors"]


def test_valid_example_passes() -> None:
    result = validate.validate_path(ROOT / "examples" / "valid" / "file_rename.capability.json", "capability")
    assert result["valid"], result["errors"]


def test_module_capability_declaration_passes() -> None:
    result = validate.validate_path(ROOT.parent / "module_capability_declaration.json", "capability")
    assert result["valid"], result["errors"]
