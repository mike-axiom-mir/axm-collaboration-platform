#!/usr/bin/env python3
"""Create a target-specific adapter plan from an AXM skin or mold JSON packet.

This does not execute Blender, Godot, ComfyUI, or MaterialX. It produces a
human-readable plan and therefore remains LOCAL VALIDATION REQUIRED.
"""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = {"blender", "godot", "comfyui", "materialx"}

def load_json(path: Path):
    if path.stat().st_size > 2_000_000:
        raise ValueError("Input exceeds 2 MB safety limit")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object")
    return data

def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("target", choices=sorted(TARGETS))
    p.add_argument("input", type=Path)
    p.add_argument("--output", type=Path)
    args = p.parse_args()
    mapping = load_json(ROOT / "registry" / "adapters" / f"{args.target}.json")
    source = load_json(args.input)
    controls = source.get("semantic_controls") or source.get("instance", {}).get("controls") or {}
    plan = {
        "schema": "axm.adapter-plan/0.1",
        "target": mapping["target"],
        "status": "LOCAL VALIDATION REQUIRED",
        "visual_parity_claim": False,
        "source_file": args.input.name,
        "semantic_controls": controls,
        "mapped_concepts": {k: mapping["maps"].get(k, {"target": "No mapping yet"}) for k in controls},
        "next_action": f"Open and validate this plan inside {mapping['target']}; record deviations before approval."
    }
    text = json.dumps(plan, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.write_text(text, encoding="utf-8")
        print(args.output)
    else:
        print(text, end="")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
