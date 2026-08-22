from __future__ import annotations

import importlib.util
import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODULE_PATH = ROOT / "validators" / "compatibility.py"
spec = importlib.util.spec_from_file_location("shared_compatibility", MODULE_PATH)
assert spec and spec.loader
compatibility = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compatibility)


def test_schema_is_compatible_with_itself() -> None:
    schema = json.loads((ROOT / "schemas" / "capability-interface-contract.schema.json").read_text())
    assert compatibility.compare_schema(schema, schema) == []


def test_new_required_field_is_breaking() -> None:
    old = json.loads((ROOT / "schemas" / "capability-interface-contract.schema.json").read_text())
    new = deepcopy(old)
    new["properties"]["new_field"] = {"type": "string"}
    new["required"].append("new_field")
    issues = compatibility.compare_schema(old, new)
    assert any(issue["kind"] == "new_required_field" for issue in issues)
