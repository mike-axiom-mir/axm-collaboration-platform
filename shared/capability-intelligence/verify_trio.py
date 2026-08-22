#!/usr/bin/env python3
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
WORKSHOP = HERE.parents[1]
PYTHON = WORKSHOP / "runtime" / "python" / "capability-intelligence" / "Scripts" / "python.exe"

MODULES = {
    "human-capability-atlas": WORKSHOP / "tools" / "human-capability-atlas" / "engine",
    "human-interface-intelligence": WORKSHOP / "tools" / "human-interface-intelligence" / "engine",
    "grounded-evolution-intelligence": WORKSHOP / "tools" / "grounded-evolution-intelligence" / "engine",
}


def digest_bytes(value: bytes) -> str:
    return "sha256:" + hashlib.sha256(value).hexdigest()


def portable(path: Path) -> str:
    try:
        return path.relative_to(WORKSHOP).as_posix()
    except ValueError:
        return path.name


def run_step(command: list[str], cwd: Path, env: dict[str, str] | None = None, timeout: int = 600) -> dict[str, Any]:
    started = time.monotonic()
    complete_env = dict(os.environ)
    complete_env["PYTHONUTF8"] = "1"
    complete_env["PYTHONDONTWRITEBYTECODE"] = "1"
    if env:
        complete_env.update(env)
    result = subprocess.run(command, cwd=cwd, env=complete_env, capture_output=True, timeout=timeout)
    stdout = result.stdout.decode("utf-8", errors="replace")
    stderr = result.stderr.decode("utf-8", errors="replace")
    combined = stdout + "\n" + stderr
    safe_command = [Path(command[0]).name, *command[1:]]
    return {
        "command": safe_command,
        "cwd": cwd.name,
        "exit_code": result.returncode,
        "duration_ms": round((time.monotonic() - started) * 1000),
        "output_sha256": digest_bytes(combined.encode("utf-8")),
        "output_tail": combined[-2400:],
        "verdict": "PASS" if result.returncode == 0 else "FAIL",
    }


def verify_module(module_id: str, source: Path, temp_root: Path) -> dict[str, Any]:
    target = temp_root / module_id
    shutil.copytree(source, target, ignore=shutil.ignore_patterns("__pycache__", ".pytest_cache", "*.pyc"))
    steps: list[dict[str, Any]] = []
    if module_id == "human-capability-atlas":
        env = {"PYTHONPATH": str(target / "src")}
        steps.append(run_step([str(PYTHON), "verify_package.py"], target, env))
        steps.append(run_step([str(PYTHON), "-m", "pytest", "-q", "-rs"], target, env))
    elif module_id == "human-interface-intelligence":
        steps.append(run_step([str(PYTHON), "-m", "pytest", "-o", "addopts="], target))
        steps.append(run_step([str(PYTHON), "-m", "axm_hii.cli", "verify-lock"], target))
        steps.append(run_step([str(PYTHON), "-m", "axm_hii.cli", "registry-check"], target))
    else:
        steps.append(run_step([str(PYTHON), "verify_package.py"], target))
        steps.append(run_step([str(PYTHON), "-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py", "-v"], target))
    output = "\n".join(step["output_tail"] for step in steps)
    counts: dict[str, int] = {}
    if module_id == "human-capability-atlas":
        match = re.search(r"(\d+) passed, (\d+) skipped", output)
        if match:
            counts = {"passed": int(match.group(1)), "skipped": int(match.group(2)), "failed": 0}
    elif module_id == "human-interface-intelligence":
        match = re.search(r"(\d+) passed", output)
        if match:
            counts = {"passed": int(match.group(1)), "skipped": 0, "failed": 0}
    else:
        match = re.search(r"Ran (\d+) tests", output)
        if match:
            counts = {"passed": int(match.group(1)), "skipped": 0, "failed": 0}
    return {
        "module_id": module_id,
        "source": portable(source),
        "disposable_copy": True,
        "source_mutated_by_test": False,
        "steps": steps,
        "test_counts": counts,
        "verdict": "PASS" if all(step["verdict"] == "PASS" for step in steps) else "FAIL",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not PYTHON.is_file():
        raise SystemExit("Isolated capability-intelligence runtime is missing")

    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="axm-trio-verify-") as temp:
        temp_root = Path(temp)
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = {
                executor.submit(verify_module, module_id, source, temp_root): module_id
                for module_id, source in MODULES.items()
            }
            modules = [future.result() for future in concurrent.futures.as_completed(futures)]
    modules.sort(key=lambda item: item["module_id"])

    platform_steps = []
    for module_id in MODULES:
        platform_steps.append(run_step(["node", "selftest.js"], WORKSHOP / "tools" / module_id, timeout=60))
        platform_steps.append(run_step(["node", "discovery-seam-review.js"], WORKSHOP / "tools" / module_id, timeout=30))
    platform_steps.append(run_step([str(PYTHON), str(HERE / "selftest.py")], WORKSHOP, timeout=60))
    platform_steps.append(run_step([str(PYTHON), str(HERE / "pipeline_selftest.py")], WORKSHOP, timeout=90))

    receipt: dict[str, Any] = {
        "schema": "axm.capability-intelligence-verification-receipt/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "verification_mode": "DISPOSABLE_SOURCE_COPIES_PLUS_PLATFORM_WRAPPERS",
        "modules": modules,
        "platform_steps": platform_steps,
        "duration_ms": round((time.monotonic() - started) * 1000),
        "verdict": "PASS" if all(item["verdict"] == "PASS" for item in modules) and all(item["verdict"] == "PASS" for item in platform_steps) else "FAIL",
        "truth": {
            "supplier_sources_mutated_by_full_tests": False,
            "test_pass_is_runtime_proof_for_all_inputs": False,
            "test_pass_is_merge_gate": False,
            "test_pass_is_canon": False,
        },
    }
    receipt["receipt_sha256"] = digest_bytes(json.dumps(receipt, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(receipt, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "verdict": receipt["verdict"],
        "modules": {item["module_id"]: item["test_counts"] for item in modules},
        "receipt_sha256": receipt["receipt_sha256"],
        "output": portable(args.output),
    }, indent=2))
    return 0 if receipt["verdict"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
