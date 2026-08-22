#!/usr/bin/env python3
"""Build a deterministic pure-Python wheel using only the standard library.

The release environment intentionally has no ``build`` or ``wheel`` dependency.
This builder packages the runtime, static observer files, and bundled schemas;
creates standards-compatible dist-info metadata; writes a complete RECORD; and
uses fixed ZIP metadata so identical source trees produce identical wheel bytes.
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import io
import re
import zipfile
from pathlib import Path

_FIXED_ZIP_TIME = (1980, 1, 1, 0, 0, 0)
_DIST_NAME = "axm_challenge_arena"
_PROJECT_NAME = "axm-challenge-arena"


def _version(root: Path) -> str:
    text = (root / "axm_challenge_arena" / "version.py").read_text(encoding="utf-8")
    match = re.search(r'^__version__\s*=\s*["\']([^"\']+)["\']', text, re.MULTILINE)
    if not match:
        raise ValueError("Could not read package version")
    return match.group(1)


def _record_hash(payload: bytes) -> str:
    encoded = base64.urlsafe_b64encode(hashlib.sha256(payload).digest()).rstrip(b"=")
    return "sha256=" + encoded.decode("ascii")


def _info(name: str) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, _FIXED_ZIP_TIME)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.create_system = 3
    info.external_attr = (0o100644 & 0xFFFF) << 16
    return info


def _package_files(root: Path) -> list[tuple[str, bytes]]:
    package = root / "axm_challenge_arena"
    files: list[tuple[str, bytes]] = []
    for path in sorted(package.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Package contains symbolic link: {path.relative_to(root)}")
        if not path.is_file():
            continue
        relative = path.relative_to(root)
        if "__pycache__" in relative.parts or path.suffix in {".pyc", ".pyo"}:
            continue
        files.append((relative.as_posix(), path.read_bytes()))
    return files


def build_wheel(root: Path, outdir: Path) -> dict[str, object]:
    root = root.expanduser().resolve()
    outdir = outdir.expanduser().resolve()
    version = _version(root)
    filename = f"{_DIST_NAME}-{version}-py3-none-any.whl"
    destination = outdir / filename
    outdir.mkdir(parents=True, exist_ok=True)
    dist_info = f"{_DIST_NAME}-{version}.dist-info"

    metadata = (
        "Metadata-Version: 2.1\n"
        f"Name: {_PROJECT_NAME}\n"
        f"Version: {version}\n"
        "Summary: Local-first deterministic multi-AI challenge, evidence, blind-review, voting, lineage, and merge-map module for AXM.\n"
        "Author: Mike / Axiom-Mir\n"
        "License: CC0-1.0\n"
        "Requires-Python: >=3.10\n"
        "Description-Content-Type: text/markdown\n"
        "\n"
        "AXM Challenge Arena is a local-first artifact-neutral challenge and evidence module.\n"
    ).encode("utf-8")
    wheel = (
        "Wheel-Version: 1.0\n"
        "Generator: axm-standard-library-wheel-builder/0.6\n"
        "Root-Is-Purelib: true\n"
        "Tag: py3-none-any\n"
    ).encode("utf-8")
    entry_points = (
        "[console_scripts]\n"
        "axm-challenge-arena = axm_challenge_arena.cli:main\n"
        "axm-challenge-observer = axm_challenge_arena.server:main\n"
    ).encode("utf-8")
    top_level = b"axm_challenge_arena\n"

    entries = _package_files(root)
    entries.extend(
        [
            (f"{dist_info}/METADATA", metadata),
            (f"{dist_info}/WHEEL", wheel),
            (f"{dist_info}/entry_points.txt", entry_points),
            (f"{dist_info}/top_level.txt", top_level),
        ]
    )
    entries.sort(key=lambda item: item[0])

    record_rows: list[list[str]] = []
    for name, payload in entries:
        record_rows.append([name, _record_hash(payload), str(len(payload))])
    record_path = f"{dist_info}/RECORD"
    record_rows.append([record_path, "", ""])
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerows(record_rows)
    record = buffer.getvalue().encode("utf-8")
    entries.append((record_path, record))
    entries.sort(key=lambda item: item[0])

    temp = destination.with_name(f".{destination.name}.tmp")
    temp.unlink(missing_ok=True)
    with zipfile.ZipFile(temp, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, payload in entries:
            archive.writestr(_info(name), payload)
    with zipfile.ZipFile(temp, "r") as archive:
        corrupt = archive.testzip()
        if corrupt is not None:
            raise OSError(f"Wheel compressed-data verification failed at {corrupt}")
    temp.replace(destination)

    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    return {
        "schema_version": "axm.challenge-arena-wheel-report/0.4",
        "wheel": str(destination),
        "version": version,
        "bytes": destination.stat().st_size,
        "sha256": digest,
        "entries": len(entries),
        "package_files": len(_package_files(root)),
        "schema_files": sum(
            1 for name, _ in entries if name.startswith("axm_challenge_arena/schemas/") and name.endswith(".json")
        ),
        "fixed_zip_timestamps": True,
        "external_build_dependencies": [],
    }


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=root)
    parser.add_argument("--outdir", type=Path, default=root / "dist")
    args = parser.parse_args()
    import json

    print(json.dumps(build_wheel(args.root, args.outdir), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
