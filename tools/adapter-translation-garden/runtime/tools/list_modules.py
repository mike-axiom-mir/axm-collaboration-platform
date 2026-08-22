from __future__ import annotations
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
items = json.loads((root / "module_index.json").read_text(encoding="utf-8"))
for item in items:
    print(f"{item['number']:03d}  {item['status']:<17}  {item['name']}")
