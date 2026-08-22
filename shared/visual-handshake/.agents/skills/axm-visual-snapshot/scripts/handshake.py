#!/usr/bin/env python3
from __future__ import annotations
import runpy
from pathlib import Path

shared = Path(__file__).resolve().parents[2] / "axm-visual-handshake" / "scripts" / "handshake.py"
if not shared.is_file():
    raise SystemExit("The axm-visual-handshake compatibility skill is required beside this module.")
runpy.run_path(str(shared), run_name="__main__")
