from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def load(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def compare_schema(old: dict[str, Any], new: dict[str, Any], path: str = "") -> list[dict[str, str]]:
    """Report likely breaking changes. Conservative by design."""
    issues: list[dict[str, str]] = []
    old_type, new_type = old.get("type"), new.get("type")
    if old_type and new_type and old_type != new_type:
        issues.append({"path": path or "/", "kind": "type_changed", "detail": f"{old_type} -> {new_type}"})

    old_required = set(old.get("required", []))
    new_required = set(new.get("required", []))
    for field in sorted(new_required - old_required):
        issues.append({"path": f"{path}/{field}", "kind": "new_required_field", "detail": "New required field breaks older records."})

    old_enum = set(old.get("enum", []))
    new_enum = set(new.get("enum", []))
    for removed in sorted(old_enum - new_enum):
        issues.append({"path": path or "/", "kind": "enum_value_removed", "detail": removed})

    old_props = old.get("properties", {})
    new_props = new.get("properties", {})
    for field in sorted(set(old_props) - set(new_props)):
        issues.append({"path": f"{path}/{field}", "kind": "property_removed", "detail": "Existing property removed."})
    for field in sorted(set(old_props) & set(new_props)):
        issues.extend(compare_schema(old_props[field], new_props[field], f"{path}/{field}"))
    return issues


def compatibility_report(old_path: Path, new_path: Path) -> dict[str, Any]:
    issues = compare_schema(load(old_path), load(new_path))
    return {
        "compatible": not issues,
        "old_schema": str(old_path),
        "new_schema": str(new_path),
        "breaking_changes": issues,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("old_schema")
    parser.add_argument("new_schema")
    args = parser.parse_args()
    report = compatibility_report(Path(args.old_schema), Path(args.new_schema))
    print(json.dumps(report, indent=2))
    return 0 if report["compatible"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
