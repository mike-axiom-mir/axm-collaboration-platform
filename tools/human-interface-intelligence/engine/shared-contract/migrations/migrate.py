from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path
from typing import Any, Callable

CURRENT_VERSION = "0.1.0"
Migration = Callable[[dict[str, Any]], dict[str, Any]]
MIGRATIONS: dict[tuple[str, str], Migration] = {}


def register(source: str, target: str):
    def decorator(function: Migration) -> Migration:
        MIGRATIONS[(source, target)] = function
        return function
    return decorator


@register("0.1.0", "0.1.0")
def identity(record: dict[str, Any]) -> dict[str, Any]:
    return deepcopy(record)


def migrate(record: dict[str, Any], target_version: str) -> dict[str, Any]:
    source_version = record.get("contract_version")
    if not source_version:
        raise ValueError("Record lacks contract_version; migration cannot be inferred safely.")
    migration = MIGRATIONS.get((source_version, target_version))
    if migration is None:
        raise ValueError(
            f"No explicit migration registered for {source_version} -> {target_version}. "
            "Refusing silent field invention or deletion."
        )
    migrated = migration(record)
    migrated["contract_version"] = target_version
    return migrated


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--target", required=True)
    args = parser.parse_args()
    record = json.loads(Path(args.input).read_text(encoding="utf-8"))
    migrated = migrate(record, args.target)
    Path(args.output).write_text(json.dumps(migrated, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
