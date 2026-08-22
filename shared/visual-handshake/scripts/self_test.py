#!/usr/bin/env python3
from __future__ import annotations
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app" / "visual_handshake.py"
TEST = ROOT / "tests" / "test_visual_handshake.py"

def run(command):
    print("+", " ".join(map(str, command)))
    return subprocess.run(command, cwd=ROOT, check=True, env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})

def main():
    run([sys.executable, "-m", "unittest", "-v", str(TEST)])
    with tempfile.TemporaryDirectory(prefix="axm-vh-selftest-") as data:
        run([sys.executable, str(APP), "--data-root", data, "status"])
    print(json.dumps({"ok":True,"message":"AXM Visual Handshake self-test passed"}))
    return 0
if __name__ == "__main__":
    raise SystemExit(main())
