#!/usr/bin/env python3
from __future__ import annotations

import argparse
import dataclasses
import enum
import importlib.util
import json
import sys
from collections.abc import Mapping
from pathlib import Path
from typing import Any


sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
MODULES = ROOT / "shared" / "verification-proof" / "source-catalog-v1" / "modules"
CALLABLE_WORDS = ("callable", "predicate", "executor", "implementation_step")


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise ValueError(f"expected object in {path.name}")
    return value


def catalog() -> list[dict[str, Any]]:
    rows = []
    for folder in sorted(path for path in MODULES.iterdir() if path.is_dir()):
        interface = load_json(folder / "INTERFACE.json")
        status = load_json(folder / "STATUS.json")
        contract = load_json(folder / "module.contract.json")
        side_effects = str(interface.get("side_effects", "")).strip()
        input_contract = str(interface.get("input_contract", "")).strip()
        requires_callable = any(word in input_contract.lower() for word in CALLABLE_WORDS)
        memory_only = side_effects.lower().startswith("none")
        rows.append({
            "module_id": folder.name,
            "seed": int(status["source_seed"]),
            "name": status.get("source_seed_name", folder.name),
            "purpose": contract.get("purpose", ""),
            "interface": interface,
            "api_executable": memory_only and not requires_callable,
            "hold_reason": None if memory_only and not requires_callable else (
                "CALLER_PATH_WRITE_REQUIRES_SEPARATE_AUTHORITY" if not memory_only
                else "CALLABLE_INPUT_REQUIRES_IN_PROCESS_ADAPTER"
            ),
        })
    return sorted(rows, key=lambda row: row["seed"])


def resolve(module_id: str) -> dict[str, Any]:
    matches = [row for row in catalog() if row["module_id"] == module_id]
    if len(matches) != 1:
        raise ValueError(f"expected one organ for {module_id!r}, found {len(matches)}")
    return matches[0]


def read_envelope(value: str) -> dict[str, Any]:
    body = sys.stdin.read() if value == "-" else value
    envelope = json.loads(body or "{}")
    if not isinstance(envelope, dict):
        raise ValueError("call envelope must be a JSON object")
    return envelope


def call_parts(value: Any, label: str) -> tuple[list[Any], dict[str, Any]]:
    block = value if isinstance(value, dict) else {}
    args = block.get("args", [])
    kwargs = block.get("kwargs", {})
    if not isinstance(args, list) or not isinstance(kwargs, dict):
        raise ValueError(f"{label} requires array args and object kwargs")
    return args, kwargs


def jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if dataclasses.is_dataclass(value):
        return jsonable(dataclasses.asdict(value))
    if isinstance(value, enum.Enum):
        return jsonable(value.value)
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, Mapping):
        return {str(key): jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [jsonable(item) for item in value]
    if hasattr(value, "to_dict") and callable(value.to_dict):
        return jsonable(value.to_dict())
    raise TypeError(f"result type {type(value).__name__} is not JSON transportable")


def execute(selected: dict[str, Any], envelope: dict[str, Any]) -> dict[str, Any]:
    if not selected["api_executable"]:
        raise ValueError(selected["hold_reason"] or "organ is not API executable")
    interface = selected["interface"]
    folder = MODULES / selected["module_id"]
    source = (folder / interface["entrypoint"]).resolve()
    if folder.resolve() not in source.parents or not source.is_file():
        raise ValueError("organ entrypoint escaped its curated module folder")
    spec = importlib.util.spec_from_file_location("axm_runtime_" + str(selected["seed"]), source)
    if spec is None or spec.loader is None:
        raise ValueError("organ could not be loaded")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    symbol = getattr(module, interface["primary_symbol"], None)
    if symbol is None:
        raise ValueError("declared primary symbol is missing")

    call_args, call_kwargs = call_parts(envelope.get("call", envelope), "call")
    if interface.get("symbol_kind") == "function":
        operation = symbol
    else:
        construct_args, construct_kwargs = call_parts(envelope.get("construct", {}), "construct")
        instance = symbol(*construct_args, **construct_kwargs)
        operation = getattr(instance, interface["operation"], None)
    if not callable(operation):
        raise ValueError("declared operation is not callable")
    result = operation(*call_args, **call_kwargs)
    return {
        "schema": "axm.verification-proof-module-result/v1",
        "module_id": selected["module_id"],
        "seed": selected["seed"],
        "operation": interface["operation"],
        "result": jsonable(result),
        "status": "TEST_HOLD",
        "authority": "NONE",
        "canon": False,
        "source_mutated": False,
        "network_used": False,
    }


def emit(value: Any) -> None:
    print(json.dumps(jsonable(value), ensure_ascii=False, indent=2, sort_keys=True))


def main() -> None:
    parser = argparse.ArgumentParser(description="Run curated AXM Verification & Proof organs")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--list", action="store_true")
    mode.add_argument("--describe")
    mode.add_argument("--run")
    parser.add_argument("--input", help="inline JSON call envelope or - for stdin")
    arguments = parser.parse_args()
    if arguments.list:
        rows = catalog()
        emit({
            "schema": "axm.verification-proof-runtime-catalog/v1",
            "module_count": len(rows),
            "api_executable_count": sum(1 for row in rows if row["api_executable"]),
            "modules": rows,
        })
        return
    selected = resolve(arguments.describe or arguments.run)
    if arguments.describe:
        emit(selected)
        return
    if arguments.input is None:
        raise ValueError("--run requires --input")
    emit(execute(selected, read_envelope(arguments.input)))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({
            "schema": "axm.verification-proof-refusal/v1",
            "ok": False,
            "error": str(error),
            "error_type": type(error).__name__,
        }), file=sys.stderr)
        raise SystemExit(1)
