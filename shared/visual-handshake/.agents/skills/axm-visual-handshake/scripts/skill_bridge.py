#!/usr/bin/env python3
from __future__ import annotations
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
SKILL_ROOT = HERE.parents[1]

def locate() -> tuple[Path, Path | None]:
    env = os.environ.get("AXM_VISUAL_HANDSHAKE_HOME")
    if env:
        root = Path(env).expanduser().resolve()
        return root, Path(os.environ["AXM_VISUAL_HANDSHAKE_DATA"]).expanduser().resolve() if os.environ.get("AXM_VISUAL_HANDSHAKE_DATA") else None
    config = SKILL_ROOT / "references" / "install_location.json"
    if config.is_file():
        data = json.loads(config.read_text(encoding="utf-8-sig"))
        return Path(data["program_root"]).resolve(), Path(data["data_root"]).resolve()
    for parent in HERE.parents:
        candidate = parent / "app" / "visual_handshake.py"
        if candidate.is_file():
            return parent, None
    stable = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "AXM" / "VisualHandshake" / "program"
    if (stable / "app" / "visual_handshake.py").is_file():
        return stable, stable.parent / "data"
    raise SystemExit(json.dumps({"ok":False,"error":"AXM Visual Handshake program was not found. Run INSTALL_WINDOWS.bat or keep the skill inside the portable package."}))

root, data_root = locate()
app = root / "app" / "visual_handshake.py"
command = [sys.executable, str(app)]
if data_root:
    command += ["--data-root", str(data_root)]
command += sys.argv[1:]
raise SystemExit(subprocess.call(command))
