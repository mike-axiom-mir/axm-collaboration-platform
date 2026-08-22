from __future__ import annotations

from pathlib import Path
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parent
inventory_path = ROOT / "FILE_INVENTORY_SHA256.json"
status_path = ROOT / "stable_handoff_status_v0_11_0.json"

errors = []
checks = 0

def check(ok: bool, message: str):
    global checks
    checks += 1
    if not ok:
        errors.append(message)

try:
    inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
except Exception as exc:
    print(f"FAIL — cannot read file inventory: {exc}")
    raise SystemExit(1)

for item in inventory.get("files", []):
    path = ROOT / item["path"]
    check(path.is_file(), f"Missing file: {item['path']}")
    if path.is_file():
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        check(actual == item["sha256"], f"SHA-256 mismatch: {item['path']}")
        check(path.stat().st_size == item["bytes"], f"Byte-length mismatch: {item['path']}")

try:
    status = json.loads(status_path.read_text(encoding="utf-8"))
    schema_hashes = status["shared_schema_sha256"]
    for name, expected in schema_hashes.items():
        path = ROOT / "schemas" / name
        check(path.is_file(), f"Missing shared schema: {name}")
        if path.is_file():
            actual = hashlib.sha256(path.read_bytes()).hexdigest()
            check(actual == expected, f"Shared schema hash mismatch: {name}")
except Exception as exc:
    errors.append(f"Stable handoff status verification failed: {exc}")

check((ROOT / "src" / "axm_capability_atlas" / "__init__.py").is_file(), "Package __init__.py missing")
check((ROOT / "local_intake_manifest.json").is_file(), "local_intake_manifest.json missing")
check((ROOT / "ACTION_REPORT.txt").is_file(), "ACTION_REPORT.txt missing")
check((ROOT / "TEST_REPORT.txt").is_file(), "TEST_REPORT.txt missing")

if errors:
    print(f"FAIL — {len(errors)} error(s) across {checks} checks")
    for error in errors:
        print(f"- {error}")
    raise SystemExit(1)

print(f"PASS — {checks} package-integrity checks")
print("This verifies package bytes and declared schema hashes; it does not replace the runtime test suite.")
