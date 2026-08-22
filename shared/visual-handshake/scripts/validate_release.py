#!/usr/bin/env python3
from __future__ import annotations
import ast
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IGNORE_EXTRA_PREFIXES = ("exchange/", "runtime/")
IGNORE_EXACT = {"config/install.json"}
EXPECTED_VERSION = "0.3.0"
SKILL_NAMES = (
    "axm-visual-handshake",
    "axm-visual-intake",
    "axm-visual-publish",
    "axm-visual-snapshot",
    "axm-visual-runtime",
)


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    failures: list[str] = []
    checks = 0
    manifest = ROOT / "CHECKSUMS_SHA256.txt"
    expected: dict[str, str] = {}
    if not manifest.is_file():
        failures.append("CHECKSUMS_SHA256.txt missing")
    else:
        for line in manifest.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            if "  " not in line:
                failures.append(f"malformed checksum line: {line[:80]}")
                continue
            digest, rel = line.split("  ", 1)
            if rel in expected:
                failures.append(f"duplicate checksum path: {rel}")
            if re.fullmatch(r"[0-9a-f]{64}", digest) is None:
                failures.append(f"invalid checksum digest: {rel}")
            expected[rel] = digest
    for rel, digest in expected.items():
        checks += 1
        path = ROOT / rel
        if not path.is_file():
            failures.append(f"missing: {rel}")
        elif sha(path) != digest:
            failures.append(f"checksum mismatch: {rel}")
    for path in ROOT.rglob("*"):
        if path.is_symlink():
            failures.append(f"symlink forbidden in release: {path.relative_to(ROOT).as_posix()}")
        if path.is_dir() and path.name == "__pycache__":
            failures.append(f"cache directory present: {path.relative_to(ROOT).as_posix()}")
        if path.is_file() and path.suffix == ".pyc":
            failures.append(f"bytecode present: {path.relative_to(ROOT).as_posix()}")
        if path.is_file() and path.name != "CHECKSUMS_SHA256.txt":
            rel = path.relative_to(ROOT).as_posix()
            if rel not in expected and rel not in IGNORE_EXACT and not rel.startswith(IGNORE_EXTRA_PREFIXES):
                failures.append(f"unmanifested release file: {rel}")
    for path in ROOT.rglob("*.py"):
        checks += 1
        try:
            ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except SyntaxError as exc:
            failures.append(f"Python syntax: {path.relative_to(ROOT)}: {exc}")
    json_files = [
        "STATUS.json", "INTAKE_PACKET.json", "config/defaults.json",
        "integration/button_contract.json", "integration/cli_contract.json",
        "axm-module/module.contract.json",
    ]
    parsed = {}
    for rel in json_files:
        checks += 1
        try:
            parsed[rel] = json.loads((ROOT / rel).read_text(encoding="utf-8-sig"))
        except Exception as exc:
            failures.append(f"JSON invalid: {rel}: {exc}")
    for rel in ("STATUS.json", "INTAKE_PACKET.json", "axm-module/module.contract.json"):
        if parsed.get(rel, {}).get("version") != EXPECTED_VERSION:
            failures.append(f"version mismatch: {rel}")
    intake = parsed.get("INTAKE_PACKET.json", {})
    if intake.get("decision_default") != "HOLD" or intake.get("enabled") is not False or intake.get("canon") is not False:
        failures.append("intake default is not disabled HOLD/non-canon")
    source = (ROOT / "app" / "visual_handshake.py").read_text(encoding="utf-8")
    if 'host = "127.0.0.1"' not in source or 'host = "0.0.0.0"' in source:
        failures.append("loopback-only bind invariant failed")
    if 'payload.get("service") == "axm-visual-handshake"' not in source:
        failures.append("exact service identity check missing")
    if 'atomic_json(session_file, session, private=True)' not in source:
        failures.append("private session write missing")
    ui = (ROOT / "app" / "static" / "app.js").read_text(encoding="utf-8")
    if 'frame.src = url' not in ui or 'frame.sandbox = ""' not in ui:
        failures.append("sandboxed direct HTML frame invariant failed")
    if 'document.hidden' not in ui or 'state.refreshBusy' not in ui:
        failures.append("polling restraint invariant failed")
    installer = (ROOT / "scripts" / "install_windows.ps1").read_text(encoding="utf-8")
    for token in ("program.staging-", "validate_release.py", "self_test.py", "program.rollback-"):
        if token not in installer:
            failures.append(f"staged installer invariant missing: {token}")
    skill_root = ROOT / ".agents" / "skills"
    for name in SKILL_NAMES:
        checks += 1
        folder = skill_root / name
        skill_path = folder / "SKILL.md"
        agent_path = folder / "agents" / "openai.yaml"
        wrapper_path = folder / "scripts" / "handshake.py"
        icon_path = folder / "assets" / "visual-handshake.svg"
        if not skill_path.is_file():
            failures.append(f"skill missing: {name}")
            continue
        skill = skill_path.read_text(encoding="utf-8")
        if not skill.startswith("---\n") or f"name: {name}" not in skill or "description:" not in skill:
            failures.append(f"SKILL.md metadata invariant failed: {name}")
        if not agent_path.is_file() or f"${name}" not in agent_path.read_text(encoding="utf-8"):
            failures.append(f"skill UI metadata missing or stale: {name}")
        if not wrapper_path.is_file():
            failures.append(f"skill command wrapper missing: {name}")
        if not icon_path.is_file():
            failures.append(f"skill icon missing: {name}")
    installer_skill_names = (ROOT / "scripts" / "install_windows.ps1").read_text(encoding="utf-8")
    for name in SKILL_NAMES:
        if f'"{name}"' not in installer_skill_names:
            failures.append(f"installer omits skill: {name}")
    cli_routes = parsed.get("integration/cli_contract.json", {}).get("skill_routes", {})
    if set(cli_routes.values()) != set(SKILL_NAMES):
        failures.append("CLI skill routing contract does not match the installed suite")
    required = [
        "README.md", "START_HERE.html", "ACTION_REPORT.md", "CHANGELOG.md", "FINAL_VALIDATION.txt",
        "INTAKE_PACKET.json", "RESTORE_PREVIOUS_WINDOWS.bat", "docs/EXACT_TARGET_CHECKLIST.md",
        "docs/MODULAR_SKILLS.md",
    ]
    for rel in required:
        checks += 1
        if not (ROOT / rel).is_file():
            failures.append(f"required release file missing: {rel}")
    if failures:
        print(json.dumps({"ok": False, "checks": checks, "failures": failures}, indent=2))
        return 1
    print(json.dumps({
        "ok": True,
        "checks": checks,
        "checksums": len(expected),
        "python_files": len(list(ROOT.rglob("*.py"))),
        "version": EXPECTED_VERSION,
        "status": "WORKING_CANDIDATE_NOT_CANON_NOT_INTEGRATED",
    }, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
