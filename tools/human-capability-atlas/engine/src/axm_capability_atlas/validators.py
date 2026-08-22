from __future__ import annotations

from pathlib import Path
from jsonschema import Draft202012Validator
from .io import load_json

from .constants import CONTRACT_VERSION


PACKAGE_SCHEMA_DIR = Path(__file__).resolve().parent / "schemas"
SOURCE_SCHEMA_DIR = Path(__file__).resolve().parents[2] / "schemas"


def _schema(name: str) -> dict:
    for directory in (PACKAGE_SCHEMA_DIR, SOURCE_SCHEMA_DIR):
        path = directory / name
        if path.exists():
            return load_json(path)
    raise FileNotFoundError(f"Schema not found: {name}")


def validate(data: dict, schema_name: str) -> list[str]:
    validator = Draft202012Validator(_schema(schema_name))
    errors = sorted(validator.iter_errors(data), key=lambda e: list(e.absolute_path))
    return [
        f"/{'/'.join(map(str, error.absolute_path))}: {error.message}"
        for error in errors
    ]


def validate_source(data: dict) -> list[str]:
    return validate(data, "source_capability.schema.json")


def validate_card(data: dict) -> list[str]:
    return validate(data, "shared_capability.schema.json")


def validate_course(data: dict) -> list[str]:
    return validate(data, "course_plan.schema.json")


def validate_ingestion_report(data: dict) -> list[str]:
    return validate(data, "ingestion_report.schema.json")


def validate_identity_report(data: dict) -> list[str]:
    return validate(data, "identity_report.schema.json")


def validate_capability_graph(data: dict) -> list[str]:
    return validate(data, "capability_graph.schema.json")


def validate_quality_report(data: dict) -> list[str]:
    return validate(data, "quality_report.schema.json")


def validate_search_index(data: dict) -> list[str]:
    return validate(data, "search_index.schema.json")


def validate_learning_path(data: dict) -> list[str]:
    return validate(data, "learning_path.schema.json")


def validate_registry_snapshot(data: dict) -> list[str]:
    return validate(data, "registry_snapshot.schema.json")


def validate_registry_diff(data: dict) -> list[str]:
    return validate(data, "registry_diff.schema.json")


def validate_producer_receipt(data: dict) -> list[str]:
    return validate(data, "producer_receipt.schema.json")


def validate_intake_gate(data: dict) -> list[str]:
    return validate(data, "intake_gate.schema.json")


def validate_enrichment_catalog(data: dict) -> list[str]:
    return validate(data, "enrichment_catalog.schema.json")


def validate_enrichment_report(data: dict) -> list[str]:
    return validate(data, "enrichment_report.schema.json")


def validate_discovery_integrity_report(data: dict) -> list[str]:
    return validate(data, "discovery_integrity_report.schema.json")


def validate_repository_snapshot(data: dict) -> list[str]:
    return validate(data, "repository_snapshot.schema.json")


def validate_public_intake_preflight(data: dict) -> list[str]:
    return validate(data, "public_intake_preflight.schema.json")


def validate_normalized_inventory(data: dict) -> list[str]:
    return validate(data, "normalized_inventory.schema.json")




def validate_source_seal(data: dict) -> list[str]:
    return validate(data, "source_seal.schema.json")


def validate_batch_plan(data: dict) -> list[str]:
    return validate(data, "batch_plan.schema.json")


def validate_batch_receipt(data: dict) -> list[str]:
    return validate(data, "batch_receipt.schema.json")


def validate_production_run_manifest(data: dict) -> list[str]:
    return validate(data, "production_run_manifest.schema.json")

def compatible_contract(
    version: str,
    supported: str = CONTRACT_VERSION,
) -> tuple[bool, str]:
    """The stable handoff anchor currently authorizes exactly 0.1.0.

    Forward compatibility is never inferred from a matching major version.
    """
    if not isinstance(version, str) or not re_semver(version):
        return False, "Malformed semantic version"
    if not isinstance(supported, str) or not re_semver(supported):
        return False, "Malformed supported semantic version"
    if version != supported:
        return (
            False,
            f"Unvalidated shared-contract version: {version}; exactly {supported} is supported",
        )
    return True, f"Exact supported shared-contract version: {supported}"


def re_semver(value: str) -> bool:
    parts = value.split(".")
    return len(parts) == 3 and all(part.isdigit() for part in parts)
