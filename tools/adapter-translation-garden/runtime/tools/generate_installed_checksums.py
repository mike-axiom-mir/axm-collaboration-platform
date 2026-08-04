#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import os
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "CHECKSUMS.sha256"


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def included(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    return (
        path != OUTPUT
        and "__pycache__" not in relative.parts
        and path.suffix != ".pyc"
        and path.is_file()
        and not path.is_symlink()
    )


def main() -> None:
    rows = [f"{digest(path)}  {path.relative_to(ROOT).as_posix()}" for path in sorted(ROOT.rglob("*")) if included(path)]
    body = "\n".join(rows) + "\n"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="\n", dir=ROOT, delete=False) as stream:
        stream.write(body)
        temporary = Path(stream.name)
    os.replace(temporary, OUTPUT)
    print(f"installed runtime checksums: {len(rows)} files")


if __name__ == "__main__":
    main()
