#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / "runtime"
sys.path.insert(0, str(RUNTIME))
sys.path.insert(0, str(RUNTIME / "shared"))

from tools.module_loader import load_implementation  # noqa: E402


def index() -> list[dict[str, Any]]:
    value = json.loads((RUNTIME / "LOCAL_INTAKE_INDEX.json").read_text(encoding="utf-8-sig"))
    return list(value["modules"])


def resolve_module(value: str) -> dict[str, Any]:
    modules = index()
    try:
        number = int(value)
    except ValueError:
        number = None
    matches = [row for row in modules if row["module_id"] == value or row["module_number"] == number]
    if len(matches) != 1:
        raise ValueError(f"expected one module for {value!r}, found {len(matches)}")
    return matches[0]


def integrated_record(module: dict[str, Any]) -> dict[str, Any]:
    return {
        **module,
        "source_status": module["status"],
        "integration_status": "SHADOW_ONLY" if module["status"] == "SHADOW_ONLY" else "WORKING",
    }


def read_envelope(value: str) -> dict[str, Any]:
    if value == "-":
        body = sys.stdin.read()
    elif value.startswith("@"):
        path = Path(value[1:]).resolve()
        if not path.is_file():
            raise ValueError(f"input file does not exist: {path}")
        body = path.read_text(encoding="utf-8-sig")
    else:
        body = value
    envelope = json.loads(body)
    if not isinstance(envelope, dict):
        raise ValueError("input envelope must be a JSON object")
    args = envelope.get("args", [])
    kwargs = envelope.get("kwargs", {})
    if not isinstance(args, list) or not isinstance(kwargs, dict):
        raise ValueError("input envelope requires array args and object kwargs")
    return {"args": args, "kwargs": kwargs}


def emit(value: Any) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True, default=str))


def main() -> None:
    parser = argparse.ArgumentParser(description="Bounded local runner for the AXM Adapter Translation Garden")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--list", action="store_true")
    mode.add_argument("--describe")
    mode.add_argument("--run")
    parser.add_argument("--input", help="JSON call envelope, @file, or - for stdin")
    arguments = parser.parse_args()

    if arguments.list:
        emit({
            "schema": "axm.translation.adapter-catalog/v1",
            "working": 90,
            "shadow_only": 10,
            "default_enabled": 0,
            "modules": [integrated_record(module) for module in index()],
        })
        return

    selected = resolve_module(arguments.describe or arguments.run)
    if arguments.describe:
        emit(integrated_record(selected))
        return
    if selected["status"] == "SHADOW_ONLY":
        raise ValueError(f"module {selected['module_id']} is contract-only and cannot execute")
    if arguments.input is None:
        raise ValueError("--run requires --input")
    envelope = read_envelope(arguments.input)
    implementation = load_implementation(int(selected["module_number"]))
    runner = getattr(implementation, "run", None)
    if not callable(runner):
        raise ValueError(f"module {selected['module_id']} has no public run function")
    result = runner(*envelope["args"], **envelope["kwargs"])
    emit({
        "schema": "axm.translation.module-result/v1",
        "module_id": selected["module_id"],
        "module_number": selected["module_number"],
        "result": result,
        "source_mutated_by_cli": False,
        "network_used_by_cli": False,
    })


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Adapter Translation Garden refused: {error}", file=sys.stderr)
        raise SystemExit(1)
