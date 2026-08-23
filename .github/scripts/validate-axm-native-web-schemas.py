#!/usr/bin/env python3
"""Independent JSON Schema validation for the experimental AXM native browser.

This CI-only verifier deliberately does not import the package's JavaScript
schema helper. It uses python-jsonschema's Draft 2020-12 implementation to
countercheck the committed schemas and representative JSON artifacts.
"""

from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError, ValidationError
from referencing import Registry, Resource
from referencing.exceptions import NoSuchResource

DRAFT = "https://json-schema.org/draft/2020-12/schema"
EXPECTED_VERSION = "4.26.0"
MIN_VALIDATED_ARTIFACTS = 7
REQUIRED_ARTIFACT_SCHEMAS = {
    "axm.web.document-tree/v1",
    "axm.web.page-model/v1",
    "axm.web.structure-index/v1",
    "axm.web.structure-layout/v1",
    "axm.web.display-list/v1",
    "axm.web.modification-ledger/v1",
    "axm.web.local-browser-session/v1",
}


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_schemas(root: Path) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]], Registry]:
    schema_dir = root / "schemas"
    by_id: dict[str, dict[str, Any]] = {}
    by_name: dict[str, dict[str, Any]] = {}

    for path in sorted(schema_dir.glob("*.schema.json")):
        schema = read_json(path)
        if schema.get("$schema") != DRAFT:
            raise RuntimeError(f"{path.name}: draft mismatch")
        schema_id = schema.get("$id")
        if not isinstance(schema_id, str) or not schema_id:
            raise RuntimeError(f"{path.name}: missing $id")
        if schema_id in by_id:
            raise RuntimeError(f"duplicate schema $id: {schema_id}")
        try:
            Draft202012Validator.check_schema(schema)
        except SchemaError as exc:
            raise RuntimeError(f"{path.name}: invalid Draft 2020-12 schema: {exc.message}") from exc
        by_id[schema_id] = schema
        by_name[path.name] = schema

    def retrieve(uri: str) -> Resource:
        # AXM schema $ids are capability identifiers rather than hierarchical
        # HTTPS locations, while local $refs intentionally use sibling file
        # names. Resolve only the final path component against this sealed
        # schema directory; never fetch a remote schema.
        name = urlparse(uri).path.rsplit("/", 1)[-1]
        schema = by_name.get(name)
        if schema is None:
            raise NoSuchResource(ref=uri)
        return Resource.from_contents(schema)

    registry = Registry(retrieve=retrieve)
    for schema_id, schema in by_id.items():
        registry = registry.with_resource(schema_id, Resource.from_contents(schema))

    return by_id, by_name, registry


def validate_instance(instance: Any, schema: dict[str, Any], registry: Registry, label: str) -> None:
    validator = Draft202012Validator(schema, registry=registry)
    errors = sorted(validator.iter_errors(instance), key=lambda error: list(error.absolute_path))
    if not errors:
        return
    first = errors[0]
    path = "$"
    for part in first.absolute_path:
        path += f"[{part}]" if isinstance(part, int) else f".{part}"
    raise RuntimeError(f"{label}: schema validation failed at {path}: {first.message}")


def representative_artifacts(root: Path, by_id: dict[str, dict[str, Any]]) -> list[tuple[Path, dict[str, Any]]]:
    found: list[tuple[Path, dict[str, Any]]] = []
    for directory in (root / "golden", root / "manifests"):
        if not directory.exists():
            continue
        for path in sorted(directory.glob("*.json")):
            value = read_json(path)
            if not isinstance(value, dict):
                continue
            schema_id = value.get("schema")
            if isinstance(schema_id, str) and schema_id in by_id:
                found.append((path, value))
    return found


def assert_references_are_local(by_name: dict[str, dict[str, Any]]) -> int:
    checked = 0

    def walk(value: Any, source: str) -> None:
        nonlocal checked
        if isinstance(value, dict):
            ref = value.get("$ref")
            if isinstance(ref, str) and not ref.startswith("#"):
                checked += 1
                parsed = urlparse(ref)
                if parsed.scheme or parsed.netloc:
                    raise RuntimeError(f"{source}: external schema reference is not allowed: {ref}")
                target = parsed.path.rsplit("/", 1)[-1]
                if target not in by_name:
                    raise RuntimeError(f"{source}: missing referenced schema: {target}")
            for child in value.values():
                walk(child, source)
        elif isinstance(value, list):
            for child in value:
                walk(child, source)

    for name, schema in by_name.items():
        walk(schema, name)
    return checked


def expect_rejected(instance: dict[str, Any], schema: dict[str, Any], registry: Registry, label: str) -> None:
    validator = Draft202012Validator(schema, registry=registry)
    try:
        validator.validate(instance)
    except ValidationError:
        return
    raise RuntimeError(f"selftest did not reject {label}")


def run_selftests(session: dict[str, Any], schema: dict[str, Any], registry: Registry) -> int:
    cases = 0

    extra = copy.deepcopy(session)
    extra["undeclaredAuthority"] = True
    expect_rejected(extra, schema, registry, "additional top-level property")
    cases += 1

    wrong_identity = copy.deepcopy(session)
    wrong_identity["schema"] = "axm.web.local-browser-session/v999"
    expect_rejected(wrong_identity, schema, registry, "wrong schema identity")
    cases += 1

    bad_digest = copy.deepcopy(session)
    bad_digest["sessionDigest"] = "0" * 63
    expect_rejected(bad_digest, schema, registry, "short session digest")
    cases += 1

    if session.get("bundle", {}).get("pages"):
        nested = copy.deepcopy(session)
        nested["bundle"]["pages"][0]["sourceDigest"] = "not-a-digest"
        expect_rejected(nested, schema, registry, "invalid nested source digest")
        cases += 1

    return cases


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", nargs="?", default=".", help="native browser project root")
    parser.add_argument("--selftest", action="store_true", help="run deliberate schema-tamper rejection tests")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    by_id, by_name, registry = load_schemas(root)
    reference_count = assert_references_are_local(by_name)

    artifacts = representative_artifacts(root, by_id)
    if len(artifacts) < MIN_VALIDATED_ARTIFACTS:
        raise RuntimeError(
            f"only {len(artifacts)} committed artifacts map to known schemas; expected at least {MIN_VALIDATED_ARTIFACTS}"
        )

    covered: set[str] = set()
    session_artifact: dict[str, Any] | None = None
    for path, value in artifacts:
        schema_id = value["schema"]
        validate_instance(value, by_id[schema_id], registry, str(path.relative_to(root)))
        covered.add(schema_id)
        if schema_id == "axm.web.local-browser-session/v1":
            session_artifact = value

    missing = sorted(REQUIRED_ARTIFACT_SCHEMAS - covered)
    if missing:
        raise RuntimeError("representative schema coverage missing: " + ", ".join(missing))

    selftests = 0
    if args.selftest:
        if session_artifact is None:
            raise RuntimeError("selftest requires a committed local browser session artifact")
        selftests = run_selftests(
            session_artifact,
            by_id["axm.web.local-browser-session/v1"],
            registry,
        )

    try:
        from importlib.metadata import version

        installed = version("jsonschema")
    except Exception:
        installed = "unknown"
    if installed != EXPECTED_VERSION:
        raise RuntimeError(f"independent validator version drift: expected {EXPECTED_VERSION}, got {installed}")

    print(
        "independent Draft 2020-12 validation PASS — "
        f"jsonschema {installed}; {len(by_id)} schemas; {reference_count} external-file refs; "
        f"{len(artifacts)} committed artifacts; {len(covered)} schema roots; {selftests} tamper selftests"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"independent JSON Schema validation FAIL — {exc}", file=sys.stderr)
        raise SystemExit(1)
