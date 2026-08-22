#!/usr/bin/env python3
from __future__ import annotations
import runpy
from pathlib import Path

bridge = Path(__file__).resolve().parents[3] / "scripts" / "skill_bridge.py"
if not bridge.is_file():
    # Installed skills keep their own copy under scripts/skill_bridge.py.
    bridge = Path(__file__).resolve().with_name("skill_bridge.py")
runpy.run_path(str(bridge), run_name="__main__")
