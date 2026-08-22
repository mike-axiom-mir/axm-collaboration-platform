#!/usr/bin/env python3
"""Regenerate the release file index and SHA-256 manifest deterministically."""
from __future__ import annotations

import hashlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "FILE_INDEX.txt"
CHECKSUMS = ROOT / "CHECKSUMS_SHA256.txt"


def release_files() -> list[Path]:
    return sorted(
        path
        for path in ROOT.rglob("*")
        if path.is_file()
        and "__pycache__" not in path.parts
        and not path.name.endswith((".pyc", ".pyo"))
    )


def sha256(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def main() -> None:
    payload = [path for path in release_files() if path not in {INDEX, CHECKSUMS}]
    index_lines = [
        "AXM Aetherglass Visual Engine v7.1.0 — File Index",
        f"Payload files: {len(payload)}",
        "",
        *(f"{path.relative_to(ROOT).as_posix()}\t{path.stat().st_size} bytes" for path in payload),
        "",
    ]
    INDEX.write_text("\n".join(index_lines), encoding="utf-8")

    checksummed = [path for path in release_files() if path != CHECKSUMS]
    checksum_lines = [
        "AXM Aetherglass Visual Engine v7.1.0 — SHA-256",
        f"Checksummed files: {len(checksummed)}",
        "",
        *(f"{sha256(path)}  {path.relative_to(ROOT).as_posix()}" for path in checksummed),
        "",
    ]
    CHECKSUMS.write_text("\n".join(checksum_lines), encoding="utf-8")
    print(f"Indexed {len(payload)} payload files; checksummed {len(checksummed)} files.")


if __name__ == "__main__":
    main()
