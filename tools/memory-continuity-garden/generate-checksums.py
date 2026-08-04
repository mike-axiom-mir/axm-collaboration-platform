from __future__ import annotations

import hashlib
from pathlib import Path


ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / "runtime"
OUTPUT = RUNTIME / "CHECKSUMS.sha256"
rows = []
for path in sorted(RUNTIME.rglob("*")):
    if not path.is_file() or path == OUTPUT or "__pycache__" in path.parts or path.suffix == ".pyc":
        continue
    rows.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(RUNTIME).as_posix()}")
OUTPUT.write_text("\n".join(rows) + "\n", encoding="utf-8")
print(f"wrote {len(rows)} runtime checksums")
