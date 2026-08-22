from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_DIR = ROOT / "schemas"
SCHEMAS = {
    "capability": SCHEMA_DIR / "capability-interface-contract.schema.json",
    "recommendation": SCHEMA_DIR / "interface-recommendation.schema.json",
}


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def infer_kind(instance: dict[str, Any]) -> str:
    kind = instance.get("record_kind")
    if kind == "capability_record":
        return "capability"
    if kind == "interface_recommendation":
        return "recommendation"
    raise ValueError("Could not infer schema kind from record_kind.")


def validate_instance(instance: dict[str, Any], schema_kind: str = "auto") -> dict[str, Any]:
    kind = infer_kind(instance) if schema_kind == "auto" else schema_kind
    schema_path = SCHEMAS[kind]
    schema = load_json(schema_path)
    annotation = load_json(SCHEMA_DIR / "evidence-annotation.schema.json")
    resource = Resource.from_contents(annotation)
    registry = Registry().with_resource(annotation["$id"], resource).with_resource(
        "https://axm.local/schemas/evidence-annotation.schema.json", resource
    )
    validator = Draft202012Validator(schema, registry=registry)
    errors = sorted(validator.iter_errors(instance), key=lambda error: list(error.absolute_path))
    return {
        "valid": not errors,
        "schema_kind": kind,
        "schema_path": str(schema_path.relative_to(ROOT)),
        "errors": [
            {
                "path": "/" + "/".join(str(part) for part in error.absolute_path),
                "message": error.message,
                "validator": error.validator,
            }
            for error in errors
        ],
    }


def validate_path(path: Path, schema_kind: str = "auto") -> dict[str, Any]:
    return validate_instance(load_json(path), schema_kind)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    parser.add_argument("--kind", choices=["auto", "capability", "recommendation"], default="auto")
    args = parser.parse_args()
    result = validate_path(Path(args.path), args.kind)
    print(json.dumps(result, indent=2))
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
