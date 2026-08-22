from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
MODULE_PATH = ROOT / "migrations" / "migrate.py"
spec = importlib.util.spec_from_file_location("shared_migrate", MODULE_PATH)
assert spec and spec.loader
migrate_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migrate_module)


def test_identity_migration_is_lossless() -> None:
    record = json.loads((ROOT / "examples" / "valid" / "file_rename.capability.json").read_text())
    assert migrate_module.migrate(record, "0.1.0") == record


def test_unregistered_migration_refuses_silent_change() -> None:
    record = json.loads((ROOT / "examples" / "valid" / "file_rename.capability.json").read_text())
    with pytest.raises(ValueError, match="No explicit migration"):
        migrate_module.migrate(record, "0.2.0")
