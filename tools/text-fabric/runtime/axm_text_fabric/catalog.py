from __future__ import annotations
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

def load_json(relative: str):
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))

def roles():
    return load_json("tokens/roles.json")

def scales():
    return load_json("tokens/scale_profiles.json")

def font_stacks():
    return load_json("tokens/font_stacks.json")

def recipes():
    output = {}
    for path in sorted((ROOT / "recipes").glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        output[path.stem] = data
    return output

def preset_catalog():
    return load_json("presets/preset_gallery.json")

def presets():
    return preset_catalog().get("presets", [])
