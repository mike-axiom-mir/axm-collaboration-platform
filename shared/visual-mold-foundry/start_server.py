#!/usr/bin/env python3
"""Local-only launcher for AXM Visual Mold Foundry v0.9.1.

Uses only Python's standard library. Binds to 127.0.0.1, never 0.0.0.0.
Launch diagnostics verify critical files, registry JSON, and the SHA-256 manifest.
"""
from __future__ import annotations

import argparse
import hashlib
import http.server
import json
import re
import sys
import threading
import urllib.error
import urllib.request
import webbrowser
from functools import partial
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent
CRITICAL_FILES = (
    "app/index.html",
    "app/js/registry.bundle.js",
    "app/js/core.js",
    "app/js/assembly.js",
    "app/js/recovery.js",
    "app/js/recovery-ui.js",
    "app/css/app.css",
    "registry/molds/index.json",
    "registry/themes/themes.json",
    "registry/organs/organs.json",
    "registry/tokens/tokens.json",
    "FILE_MANIFEST_SHA256.txt",
)
REGISTRY_JSON = (
    "registry/molds/index.json",
    "registry/themes/themes.json",
    "registry/organs/organs.json",
    "registry/presets/starter-presets.json",
    "registry/tokens/tokens.json",
    "validation/mold-schema.json",
)


class LocalHandler(http.server.SimpleHTTPRequestHandler):
    server_version = "AXMVisualMoldFoundry/0.9.1"

    def _host_allowed(self) -> bool:
        host = self.headers.get("Host", "").strip().lower()
        if not host:
            return True
        if host.startswith("["):
            hostname = host[1:].split("]", 1)[0]
        else:
            hostname = host.rsplit(":", 1)[0] if host.count(":") == 1 else host
        return hostname in {"127.0.0.1", "localhost", "::1"}

    def _reject_bad_host(self) -> bool:
        if self._host_allowed():
            return False
        self.send_error(421, "Local Host header required")
        return True

    def do_GET(self) -> None:  # noqa: N802 - stdlib handler API
        if not self._reject_bad_host():
            super().do_GET()

    def do_HEAD(self) -> None:  # noqa: N802 - stdlib handler API
        if not self._reject_bad_host():
            super().do_HEAD()

    def translate_path(self, path: str) -> str:
        candidate = Path(super().translate_path(path))
        try:
            relative = candidate.relative_to(ROOT)
            cursor = ROOT
            for part in relative.parts:
                cursor = cursor / part
                if cursor.is_symlink():
                    raise ValueError("symlink path")
            candidate.resolve(strict=False).relative_to(ROOT.resolve())
        except (ValueError, OSError):
            return str(ROOT / "_blocked_axm_request_")
        return str(candidate)

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; connect-src 'none'; font-src 'self'; object-src 'none'; "
            "base-uri 'none'; frame-ancestors 'none'; frame-src 'none'; form-action 'none'",
        )
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def list_directory(self, path):  # type: ignore[override]
        self.send_error(403, "Directory listing disabled")
        return None

    def log_message(self, fmt: str, *args) -> None:
        print(f"[AXM local] {self.address_string()} - {fmt % args}")


def probe_existing_axm(port: int) -> bool:
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}/app/index.html",
        headers={"User-Agent": "AXM-local-launcher-probe/0.9.1"},
    )
    try:
        with urllib.request.urlopen(request, timeout=1.5) as response:
            server = response.headers.get("Server", "")
            return response.status == 200 and server.startswith("AXMVisualMoldFoundry/")
    except (OSError, urllib.error.URLError, urllib.error.HTTPError):
        return False


def verify_registry_json() -> list[str]:
    errors: list[str] = []
    for rel in REGISTRY_JSON:
        path = ROOT / rel
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:  # diagnostics should report, not crash
            errors.append(f"{rel}: {exc}")
    return errors


def verify_hash_manifest() -> tuple[int, list[str]]:
    manifest = ROOT / "FILE_MANIFEST_SHA256.txt"
    if not manifest.is_file():
        return 0, ["FILE_MANIFEST_SHA256.txt is missing"]
    checked = 0
    errors: list[str] = []
    listed: set[str] = set()
    hash_pattern = re.compile(r"^[0-9a-f]{64}$")
    for line in manifest.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        try:
            expected, rel = line.split("  ", 1)
        except ValueError:
            errors.append(f"Malformed manifest line: {line[:100]}")
            continue
        pure = PurePosixPath(rel)
        if (
            not hash_pattern.fullmatch(expected)
            or not rel
            or "\\" in rel
            or pure.is_absolute()
            or any(part in {"", ".", ".."} for part in pure.parts)
        ):
            errors.append(f"Unsafe or malformed manifest entry: {rel[:100]}")
            continue
        if rel in listed:
            errors.append(f"Duplicate manifest entry: {rel}")
            continue
        listed.add(rel)
        path = ROOT.joinpath(*pure.parts)
        try:
            path.resolve(strict=False).relative_to(ROOT.resolve())
        except ValueError:
            errors.append(f"Manifest path escapes the package: {rel}")
            continue
        if path.is_symlink():
            errors.append(f"Symlink is not allowed in the package manifest: {rel}")
            continue
        if not path.is_file():
            errors.append(f"Missing manifest file: {rel}")
            continue
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        checked += 1
        if actual != expected:
            errors.append(f"Hash mismatch: {rel}")
    if not checked and not errors:
        errors.append("Manifest contains no file entries")
    actual: set[str] = set()
    for path in ROOT.rglob("*"):
        rel = path.relative_to(ROOT).as_posix()
        if path.is_symlink():
            errors.append(f"Symlink is not allowed in the package: {rel}")
            continue
        if not path.is_file():
            continue
        if rel == "FILE_MANIFEST_SHA256.txt" or "__pycache__" in path.parts or path.suffix == ".pyc":
            continue
        if (
            rel.startswith("exports/")
            or rel.startswith("foundry/approved/")
            or rel.startswith("foundry/candidate_molds/")
            or (rel.startswith("foundry/intake/") and not rel.startswith("foundry/intake/examples/"))
            or rel.startswith("lineage/change_logs/")
            or rel.startswith("lineage/rollback_snapshots/")
        ):
            continue
        actual.add(rel)
    extras = sorted(actual - listed)
    if extras:
        errors.extend(f"Unlisted package file: {rel}" for rel in extras[:12])
    return checked, errors


def diagnostic_report() -> tuple[bool, list[str]]:
    lines = [
        f"Python: {sys.version.split()[0]}",
        f"Package root: {ROOT}",
        "Network bind: 127.0.0.1 only",
        "Remote connections: blocked by browser CSP",
    ]
    missing = [rel for rel in CRITICAL_FILES if not (ROOT / rel).is_file()]
    if missing:
        lines.append("Missing critical files:")
        lines.extend(f"  - {rel}" for rel in missing)
    else:
        lines.append(f"Critical files: PASS ({len(CRITICAL_FILES)})")

    json_errors = verify_registry_json()
    if json_errors:
        lines.append("Registry JSON: FAIL")
        lines.extend(f"  - {error}" for error in json_errors)
    else:
        lines.append(f"Registry JSON: PASS ({len(REGISTRY_JSON)})")

    checked, hash_errors = verify_hash_manifest()
    if hash_errors:
        lines.append("SHA-256 manifest: FAIL")
        lines.extend(f"  - {error}" for error in hash_errors[:12])
    else:
        lines.append(f"SHA-256 manifest: PASS ({checked} files)")

    structure_ok = ROOT.is_dir() and (ROOT / "app").is_dir()
    lines.append(f"Package structure: {'PASS' if structure_ok else 'FAIL'}")
    return not missing and not json_errors and not hash_errors and structure_ok, lines


def main() -> int:
    parser = argparse.ArgumentParser(description="Run AXM Visual Mold Foundry locally.")
    parser.add_argument("--port", type=int, default=8765, help="Exact local port (default: 8765)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser automatically")
    parser.add_argument("--diagnose", action="store_true", help="Verify critical files, registries, and hashes, then exit")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")

    healthy, lines = diagnostic_report()
    if args.diagnose:
        print("AXM Visual Mold Foundry v0.9.1 — launch diagnostics")
        print("-" * 62)
        print("\n".join(lines))
        return 0 if healthy else 2
    if not healthy:
        print("ERROR: local launch diagnostics failed. No server was started.", file=sys.stderr)
        print("\n".join(lines), file=sys.stderr)
        return 2

    handler = partial(LocalHandler, directory=str(ROOT))
    url = f"http://127.0.0.1:{args.port}/app/index.html"
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    except OSError as exc:
        if probe_existing_axm(args.port):
            print(f"AXM is already running at {url}; reusing the same browser-storage origin.")
            if not args.no_browser:
                webbrowser.open(url, new=2)
            return 0
        print(
            f"ERROR: port {args.port} is already in use by another process. "
            "AXM did not switch ports because that would create a separate browser workspace.",
            file=sys.stderr,
        )
        print(f"Details: {exc}", file=sys.stderr)
        return 3

    print("=" * 68)
    print("AXM Visual Mold Foundry v0.9.1 — LOCAL ONLY")
    print(f"Open: {url}")
    if args.port != 8765:
        print("Storage note: this explicit non-default port has a separate browser workspace from port 8765.")
    print("Recovery: use Recovery + Intake before destructive repair")
    print("Diagnostics: RUN_DIAGNOSTICS.bat or python tests/run_tests.py")
    print("Stop: press Ctrl+C in this window")
    print("No account, telemetry, CDN, or remote font is used by the core.")
    print("=" * 68)

    if not args.no_browser:
        threading.Timer(0.45, lambda: webbrowser.open(url, new=2)).start()
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        print("\nStopping AXM local server.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
