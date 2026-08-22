from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
import zipfile
from pathlib import Path
from typing import Iterable


_FIXED_ZIP_TIME = (1980, 1, 1, 0, 0, 0)
_EXCLUDED_DIRECTORY_NAMES = {
    ".git",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".tox",
    ".venv",
    "__pycache__",
    "build",
    "htmlcov",
    "venv",
}
_EXCLUDED_FILE_NAMES = {
    ".arena-workspace.lock",
    ".DS_Store",
    "CHECKSUMS.sha256",
}
_EXCLUDED_SUFFIXES = {".pyc", ".pyo"}


def _sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _source_version(root: Path) -> str:
    text = (root / "axm_challenge_arena" / "version.py").read_text(encoding="utf-8")
    match = re.search(r'^__version__\s*=\s*["\']([^"\']+)["\']', text, re.MULTILINE)
    if not match:
        raise ValueError("Could not read __version__ from axm_challenge_arena/version.py")
    return match.group(1)


def _is_excluded(relative: Path) -> bool:
    if any(part in _EXCLUDED_DIRECTORY_NAMES or part.endswith(".egg-info") for part in relative.parts):
        return True
    if relative.name in _EXCLUDED_FILE_NAMES or relative.suffix in _EXCLUDED_SUFFIXES:
        return True
    if relative.name == ".coverage" or relative.name.startswith(".coverage."):
        return True
    return False


def _included_directories(root: Path) -> list[Path]:
    directories: list[Path] = []
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root)
        if _is_excluded(relative):
            continue
        if path.is_symlink():
            raise ValueError(f"Release source contains a symbolic link: {relative.as_posix()}")
        if path.is_dir():
            directories.append(path)
    return directories


def _included_files(root: Path, *, include_checksums: bool) -> list[Path]:
    files: list[Path] = []
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root)
        if _is_excluded(relative):
            if include_checksums and relative.as_posix() == "CHECKSUMS.sha256":
                files.append(path)
            continue
        if path.is_symlink():
            raise ValueError(f"Release source contains a symbolic link: {relative.as_posix()}")
        if path.is_file():
            files.append(path)
    return files


def write_internal_checksums(root: Path) -> dict[str, str]:
    """Write hashes for every included source file except the checksum file itself."""

    hashes = {
        path.relative_to(root).as_posix(): _sha256_file(path)
        for path in _included_files(root, include_checksums=False)
    }
    content = "".join(f"{digest}  {relative}\n" for relative, digest in sorted(hashes.items()))
    destination = root / "CHECKSUMS.sha256"
    fd, temp_name = tempfile.mkstemp(prefix=".checksums-", suffix=".tmp", dir=str(root))
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(content.encode("utf-8"))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, destination)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
    return hashes


def _zip_info(name: str, *, directory: bool) -> zipfile.ZipInfo:
    normalized = name.rstrip("/") + "/" if directory else name
    info = zipfile.ZipInfo(normalized, _FIXED_ZIP_TIME)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.create_system = 3
    if directory:
        info.external_attr = ((0o40755 & 0xFFFF) << 16) | 0x10
    else:
        info.external_attr = (0o100644 & 0xFFFF) << 16
    return info


def build_release(root: Path, destination: Path) -> dict[str, object]:
    """Create a sorted, fixed-metadata source archive and SHA-256 sidecar."""

    root = root.expanduser().resolve()
    destination = destination.expanduser().resolve()
    if not (root / "pyproject.toml").is_file():
        raise ValueError(f"Release root does not look like the Arena source tree: {root}")
    if destination == root or root in destination.parents:
        raise ValueError("Release destination must be outside the source tree.")

    source_hashes = write_internal_checksums(root)
    source_version = _source_version(root)
    directories = _included_directories(root)
    files = _included_files(root, include_checksums=True)
    prefix = root.name
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(
        prefix=f".{destination.name}.", suffix=".tmp", dir=str(destination.parent)
    )
    os.close(fd)
    temp = Path(temp_name)
    try:
        archive_items: list[tuple[str, bool, Path | None]] = [
            (prefix, True, None)
        ]
        archive_items.extend(
            (
                f"{prefix}/{directory.relative_to(root).as_posix()}",
                True,
                directory,
            )
            for directory in directories
        )
        archive_items.extend(
            (
                f"{prefix}/{path.relative_to(root).as_posix()}",
                False,
                path,
            )
            for path in files
        )
        archive_items.sort(key=lambda item: item[0].rstrip("/") + ("/" if item[1] else ""))

        with zipfile.ZipFile(
            temp,
            "w",
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=9,
            strict_timestamps=True,
        ) as archive:
            for archive_name, is_directory, source_path in archive_items:
                payload = b"" if is_directory else source_path.read_bytes()  # type: ignore[union-attr]
                archive.writestr(
                    _zip_info(archive_name, directory=is_directory),
                    payload,
                )
        os.replace(temp, destination)
    finally:
        temp.unlink(missing_ok=True)

    with zipfile.ZipFile(destination, "r") as archive:
        corrupt = archive.testzip()
        if corrupt is not None:
            raise OSError(f"Release archive failed compressed-data verification at {corrupt}")
        archive_names = archive.namelist()
        if archive_names != sorted(archive_names):
            raise OSError("Release archive members are not lexically sorted.")
        archive_entries = len(archive_names)

    digest = _sha256_file(destination)
    sidecar = destination.with_name(destination.name + ".sha256")
    sidecar.write_text(f"{digest}  {destination.name}\n", encoding="utf-8", newline="\n")
    return {
        "schema_version": "axm.challenge-arena-release-report/0.4",
        "arena_version": source_version,
        "source_root": str(root),
        "archive": str(destination),
        "archive_bytes": destination.stat().st_size,
        "archive_sha256": digest,
        "archive_entries": archive_entries,
        "included_file_count": len(files),
        "included_directory_count": len(directories) + 1,
        "internal_checksum_entry_count": len(source_hashes),
        "checksum_sidecar": str(sidecar),
        "fixed_zip_timestamps": True,
        "members_lexically_sorted": True,
        "symbolic_links_allowed": False,
    }


def main() -> None:
    default_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="Build a deterministic AXM Challenge Arena source release ZIP."
    )
    parser.add_argument("--root", type=Path, default=default_root)
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Destination ZIP; defaults to a versioned filename beside the source folder.",
    )
    args = parser.parse_args()
    root = args.root.expanduser().resolve()
    destination = args.out
    if destination is None:
        version_slug = _source_version(root).replace(".", "_").replace("-", "_")
        destination = root.parent / f"AXM_CHALLENGE_ARENA_v{version_slug}.zip"
    print(json.dumps(build_release(root, destination), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
