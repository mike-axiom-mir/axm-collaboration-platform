from __future__ import annotations

import argparse
import os
import shutil
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "schemas"
DEFAULT_DESTINATION = ROOT / "axm_challenge_arena" / "schemas"


def _schema_map(root: Path, *, required: bool = True) -> dict[str, bytes]:
    if not root.is_dir():
        if required:
            raise FileNotFoundError(f"Schema directory does not exist: {root}")
        return {}
    files = sorted(root.glob("*.json"))
    if not files and required:
        raise ValueError(f"Schema directory contains no JSON schemas: {root}")
    return {path.name: path.read_bytes() for path in files}


def compare_schema_trees(source: Path, destination: Path) -> dict[str, list[str]]:
    """Return deterministic missing, extra, and byte-mismatch lists."""

    source_map = _schema_map(source)
    destination_map = _schema_map(destination, required=False)
    source_names = set(source_map)
    destination_names = set(destination_map)
    return {
        "missing": sorted(source_names - destination_names),
        "extra": sorted(destination_names - source_names),
        "mismatched": sorted(
            name
            for name in source_names & destination_names
            if source_map[name] != destination_map[name]
        ),
    }


def _atomic_copy(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(
        prefix=f".{destination.name}.", suffix=".tmp", dir=str(destination.parent)
    )
    os.close(fd)
    temp = Path(temp_name)
    try:
        shutil.copy2(source, temp)
        os.replace(temp, destination)
    finally:
        temp.unlink(missing_ok=True)


def sync_schema_trees(source: Path, destination: Path) -> int:
    source_map = _schema_map(source)
    destination.mkdir(parents=True, exist_ok=True)
    for old in sorted(destination.glob("*.json")):
        if old.name not in source_map:
            old.unlink()
    for name in sorted(source_map):
        source_path = source / name
        destination_path = destination / name
        if destination_path.is_file() and destination_path.read_bytes() == source_map[name]:
            continue
        _atomic_copy(source_path, destination_path)
    return len(source_map)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Synchronize editable JSON schemas into the installable package, or "
            "verify that both trees are byte-identical."
        )
    )
    parser.add_argument("--check", action="store_true", help="Verify only; do not modify files.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--destination", type=Path, default=DEFAULT_DESTINATION)
    args = parser.parse_args()

    source = args.source.expanduser().resolve()
    destination = args.destination.expanduser().resolve()
    if args.check:
        differences = compare_schema_trees(source, destination)
        if any(differences.values()):
            print("Schema resource trees are not synchronized.")
            for key in ("missing", "extra", "mismatched"):
                if differences[key]:
                    print(f"{key}: {', '.join(differences[key])}")
            raise SystemExit(1)
        print(
            f"PASS: {len(_schema_map(source))} schemas are byte-identical between "
            f"{source} and {destination}."
        )
        return

    count = sync_schema_trees(source, destination)
    print(f"Synced {count} schemas into the installable package.")


if __name__ == "__main__":
    main()
