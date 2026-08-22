#!/usr/bin/env python3
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import io
import json
import sys
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any


HERE = Path(__file__).resolve().parent
WORKSHOP = HERE.parents[1]
MODULE1 = WORKSHOP / "tools" / "human-capability-atlas" / "engine"
MODULE2 = WORKSHOP / "tools" / "human-interface-intelligence" / "engine"
MODULE3 = WORKSHOP / "tools" / "grounded-evolution-intelligence" / "engine"
INTAKE = WORKSHOP / "intakes" / "tri-20260809"
PLATFORM_BRIDGE_ID = "axm.platform.capability-interface-adapter"
PLATFORM_BRIDGE_VERSION = "1.0.0"
PLATFORM_MAPPING_VERSION = "module1-v0.11-to-module2-v0.6"

MODULE1_CAPABILITY_SCHEMA = MODULE1 / "schemas" / "shared_capability.schema.json"
MODULE1_RECOMMENDATION_SCHEMA = MODULE1 / "schemas" / "interface_recommendation.schema.json"
MODULE2_CAPABILITY_SCHEMA = MODULE2 / "shared-contract" / "schemas" / "capability-interface-contract.schema.json"
MODULE2_RECOMMENDATION_SCHEMA = MODULE2 / "shared-contract" / "schemas" / "interface-recommendation.schema.json"

STATE_MAP = {
    "known": "KNOWN",
    "inferred": "INFERRED",
    "unknown": "UNKNOWN",
    "conflicted": "CONFLICTED",
    "not_applicable": "NOT_APPLICABLE",
}

PROFILE_FIELDS: dict[str, tuple[str, ...]] = {
    "source_reference": ("source_type", "source_location", "source_hash", "last_verified_at", "confidence"),
    "identity": ("machine_name", "human_name", "category", "tags"),
    "purpose": ("plain_explanation", "why_it_matters", "example_uses"),
    "task_profile": ("supported_task_types", "typical_goals", "required_human_actions", "required_machine_actions", "collaboration_modes"),
    "input_profile": ("input_types", "required_inputs", "optional_inputs", "input_constraints"),
    "output_profile": ("output_types", "expected_outputs", "output_constraints", "preview_available"),
    "cost_profile": ("compute_cost", "time_cost", "attention_cost", "skill_cost", "setup_cost", "error_recovery_cost"),
    "risk_profile": ("risk_level", "reversibility", "privacy_sensitivity", "failure_modes", "human_confirmation_required", "safe_preview_recommended"),
    "maturity_profile": ("availability", "maturity", "proof_status", "known_limitations"),
    "learning_profile": ("minimum_skill_level", "prerequisite_capability_ids", "recommended_learning_steps", "beginner_safe_operations", "advanced_operations", "common_mistakes"),
    "interaction_profile": ("interaction_complexity", "interaction_frequency", "precision_requirement", "feedback_requirement", "preferred_input_methods", "preferred_output_methods", "accessibility_considerations"),
    "interface_requirements": ("required_interface_features", "optional_interface_features", "unsafe_interface_patterns", "beginner_layer_constraints", "advanced_layer_requirements"),
    "relationships": ("dependency_capability_ids", "related_capability_ids", "alternative_capability_ids", "commonly_combined_capability_ids"),
}


def _canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def digest_value(value: Any) -> str:
    return "sha256:" + hashlib.sha256(_canonical_bytes(value)).hexdigest()


def digest_file(path: Path, *, prefix: bool = True) -> str:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return ("sha256:" if prefix else "") + digest


def _load_validator(path: Path, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load validator: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_module1_record(record: dict[str, Any]) -> dict[str, Any]:
    from jsonschema import Draft202012Validator

    schema = json.loads(MODULE1_CAPABILITY_SCHEMA.read_text(encoding="utf-8"))
    errors = sorted(Draft202012Validator(schema).iter_errors(record), key=lambda item: list(item.absolute_path))
    return {
        "valid": not errors,
        "errors": [
            {"path": "/" + "/".join(str(part) for part in error.absolute_path), "message": error.message}
            for error in errors
        ],
    }


def validate_module2_record(record: dict[str, Any]) -> dict[str, Any]:
    validator = _load_validator(
        MODULE2 / "shared-contract" / "validators" / "validate.py",
        "axm_platform_shared_contract_validator",
    )
    return validator.validate_instance(record, "capability")


def _project_object(name: str, value: Any, dropped: dict[str, Any]) -> dict[str, Any]:
    source = value if isinstance(value, dict) else {}
    allowed = PROFILE_FIELDS[name]
    projected = {key: copy.deepcopy(source.get(key)) for key in allowed if key in source}
    extra = {key: copy.deepcopy(item) for key, item in source.items() if key not in allowed}
    if extra:
        dropped[f"/{name}"] = extra
    return projected


def _source_basis(record: dict[str, Any]) -> list[dict[str, Any]]:
    source = record.get("source_reference")
    if not isinstance(source, dict):
        return []
    allowed = PROFILE_FIELDS["source_reference"]
    return [{key: copy.deepcopy(source.get(key)) for key in allowed}]


def _annotation_for(path: str, state: str, record: dict[str, Any], knowledge: dict[str, Any]) -> dict[str, Any]:
    inferences = [item for item in knowledge.get("inferences", []) if isinstance(item, dict) and item.get("field") == path]
    conflicts = [item for item in knowledge.get("conflicts", []) if isinstance(item, dict) and item.get("field") == path]
    source = record.get("source_reference") if isinstance(record.get("source_reference"), dict) else {}
    confidence = source.get("confidence", 0.0)
    reasoning = "Module One field-state annotation preserved by the bounded AXM platform adapter."
    if state == "inferred" and inferences:
        reasoning = str(inferences[0].get("reasoning") or reasoning)
        confidence = inferences[0].get("confidence", confidence)
    elif state == "conflicted" and conflicts:
        reasoning = "Module One reported a conflict; details remain in the adaptation sidecar."
    elif state == "unknown":
        reasoning = "Module One explicitly marked this field unknown."
    try:
        confidence = min(1.0, max(0.0, float(confidence)))
    except (TypeError, ValueError):
        confidence = 0.0
    return {
        "path": path if path.startswith("/") else "/" + path,
        "state": STATE_MAP[state],
        "reasoning": reasoning,
        "source_basis": _source_basis(record),
        "confidence": confidence,
    }


def adapt_capability_record(record: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    source_validation = validate_module1_record(record)
    if not source_validation["valid"]:
        raise ValueError("Module One record is invalid: " + json.dumps(source_validation["errors"][:8], ensure_ascii=False))

    dropped: dict[str, Any] = {}
    adapted: dict[str, Any] = {
        "contract_id": "axm.capability-interface-contract",
        "contract_version": "0.1.0",
        "record_kind": "capability_record",
        "capability_id": copy.deepcopy(record["capability_id"]),
        "capability_revision": copy.deepcopy(record["capability_revision"]),
    }
    for name in PROFILE_FIELDS:
        adapted[name] = _project_object(name, record.get(name), dropped)

    knowledge = record.get("knowledge") if isinstance(record.get("knowledge"), dict) else {}
    states = knowledge.get("field_states") if isinstance(knowledge.get("field_states"), dict) else {}
    annotations = []
    for path, state in sorted(states.items()):
        if state not in STATE_MAP:
            raise ValueError(f"Unsupported Module One truth state at {path}: {state!r}")
        annotations.append(_annotation_for(str(path), str(state), record, knowledge))
    adapted["evidence_annotations"] = annotations

    admitted_top = {"contract_version", "capability_id", "capability_revision", "knowledge", *PROFILE_FIELDS.keys()}
    top_extra = {key: copy.deepcopy(value) for key, value in record.items() if key not in admitted_top}
    if top_extra:
        dropped["/"] = top_extra

    target_validation = validate_module2_record(adapted)
    if not target_validation["valid"]:
        raise ValueError("Adapted Module Two record is invalid: " + json.dumps(target_validation["errors"][:8], ensure_ascii=False))

    sidecar = {
        "schema": "axm.capability-interface-adaptation-receipt/v2",
        "mode": "BOUNDED_EXPLICIT_TRANSLATION",
        "admission_state": "PLATFORM_TEST_READY",
        "review_state": "REVIEW_REQUIRED_FOR_CANON",
        "native_paired_gate": "BLOCKED",
        "bridge_contract": {
            "id": PLATFORM_BRIDGE_ID,
            "version": PLATFORM_BRIDGE_VERSION,
            "mapping_version": PLATFORM_MAPPING_VERSION,
            "source_profile": "axm.module1-capability-record/v0.11",
            "target_profile": "axm.hii-capability-record/v0.6",
        },
        "source": {
            "module_id": "axm.module.human_capability_atlas",
            "module_version": "0.11.0",
            "declared_contract_id": "axm.capability-interface-contract",
            "declared_contract_version": "0.1.0",
            "schema_sha256": digest_file(MODULE1_CAPABILITY_SCHEMA),
            "record_sha256": digest_value(record),
        },
        "target": {
            "module_id": "axm.human-interface-intelligence",
            "module_version": "0.6.0",
            "contract_id": "axm.capability-interface-contract",
            "contract_version": "0.1.0",
            "schema_sha256": digest_file(MODULE2_CAPABILITY_SCHEMA),
            "record_sha256": digest_value(adapted),
        },
        "state_mapping": STATE_MAP,
        "retained_source_only": {"knowledge": copy.deepcopy(knowledge), "dropped_fields": dropped},
        "truth": {
            "source_was_mutated": False,
            "native_contract_identity_claimed": False,
            "platform_test_consumption_allowed": True,
            "automatic_execution": False,
            "automatic_canon": False,
            "merge_gate_passed": False,
        },
    }
    sidecar["receipt_sha256"] = digest_value(sidecar)
    return adapted, sidecar


def contract_audit() -> dict[str, Any]:
    pairs = [
        ("capability_record", MODULE1_CAPABILITY_SCHEMA, MODULE2_CAPABILITY_SCHEMA),
        ("interface_recommendation", MODULE1_RECOMMENDATION_SCHEMA, MODULE2_RECOMMENDATION_SCHEMA),
    ]
    comparisons = []
    for name, module1_path, module2_path in pairs:
        module1_hash = digest_file(module1_path)
        module2_hash = digest_file(module2_path)
        comparisons.append({
            "surface": name,
            "module1_schema": module1_path.relative_to(WORKSHOP).as_posix(),
            "module1_sha256": module1_hash,
            "module2_schema": module2_path.relative_to(WORKSHOP).as_posix(),
            "module2_sha256": module2_hash,
            "status": "EXACT" if module1_hash == module2_hash else "CONFLICTED",
        })
    return {
        "schema": "axm.capability-intelligence-contract-audit/v1",
        "declared_contract_id": "axm.capability-interface-contract",
        "declared_contract_version": "0.1.0",
        "overall": "PASS" if all(item["status"] == "EXACT" for item in comparisons) else "CONFLICTED",
        "comparisons": comparisons,
        "native_paired_gate": "BLOCKED",
        "adapter_route": "VERSIONED_PLATFORM_TRANSLATION_LOCAL_TEST",
    }


def _safe_zip_names(zf: zipfile.ZipFile) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()
    folded: dict[str, str] = {}
    for info in zf.infolist():
        name = info.filename.replace("\\", "/")
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts or (path.parts and ":" in path.parts[0]):
            errors.append(f"unsafe path: {name}")
        if name in seen:
            errors.append(f"duplicate path: {name}")
        seen.add(name)
        key = name.casefold()
        if key in folded and folded[key] != name:
            errors.append(f"case collision: {folded[key]} <> {name}")
        folded[key] = name
    return errors


def probe_module1_v011(bundle: Path) -> dict[str, Any]:
    expected_outer = "sha256:a6a361ae5abeaf0a1787b08501374260093a615ac6bdc7aa87d052b364f692a6"
    result: dict[str, Any] = {
        "schema": "axm.gei.module1-v011-rooted-bundle-probe/v1",
        "artifact": bundle.name,
        "artifact_present": bundle.is_file(),
        "expected_outer_sha256": expected_outer,
        "actual_outer_sha256": None,
        "outer_hash_matches": False,
        "archive_root": None,
        "required_layout": {},
        "nested": [],
        "blockers": [],
        "active_package_admission_safe": False,
    }
    if not bundle.is_file():
        result["blockers"].append("Module One v0.11 outer bundle is missing.")
        result["report_sha256"] = digest_value(result)
        return result
    result["actual_outer_sha256"] = digest_file(bundle)
    result["outer_hash_matches"] = result["actual_outer_sha256"] == expected_outer
    if not result["outer_hash_matches"]:
        result["blockers"].append("Module One v0.11 outer SHA-256 mismatch.")
    if not zipfile.is_zipfile(bundle):
        result["blockers"].append("Module One v0.11 outer artifact is not a ZIP.")
        result["report_sha256"] = digest_value(result)
        return result

    with zipfile.ZipFile(bundle) as outer:
        result["blockers"].extend(_safe_zip_names(outer))
        manifest_names = [name for name in outer.namelist() if name.endswith("/INTAKE_MANIFEST.json") or name == "INTAKE_MANIFEST.json"]
        if len(manifest_names) != 1:
            result["blockers"].append(f"Expected exactly one intake manifest, found {len(manifest_names)}.")
        else:
            manifest_name = manifest_names[0]
            root = manifest_name[: -len("INTAKE_MANIFEST.json")]
            result["archive_root"] = root.rstrip("/")
            manifest = json.loads(outer.read(manifest_name).decode("utf-8-sig"))
            nested_specs = [
                (manifest["module"]["path"], manifest["module"]["sha256"]),
                (manifest["handoff"]["stable_anchor"]["path"], manifest["handoff"]["stable_anchor"]["sha256"]),
                (manifest["handoff"]["status_addendum"]["path"], manifest["handoff"]["status_addendum"]["sha256"]),
            ]
            required = ["INTAKE_MANIFEST.json", "INTAKE_BUNDLE_FILE_INVENTORY_SHA256.json", "CHECKSUMS_SHA256.txt", *[item[0] for item in nested_specs]]
            names = set(outer.namelist())
            for relative in required:
                full = root + relative
                present = full in names
                result["required_layout"][relative] = present
                if not present:
                    result["blockers"].append(f"Required rooted entry missing: {relative}")
            for relative, expected in nested_specs:
                full = root + relative
                if full not in names:
                    continue
                data = outer.read(full)
                actual = "sha256:" + hashlib.sha256(data).hexdigest()
                expected_prefixed = expected if str(expected).startswith("sha256:") else "sha256:" + str(expected)
                nested = {
                    "path": relative,
                    "expected_sha256": expected_prefixed,
                    "actual_sha256": actual,
                    "hash_matches": actual == expected_prefixed,
                    "zip_readable": zipfile.is_zipfile(io.BytesIO(data)),
                    "blockers": [],
                }
                if not nested["hash_matches"]:
                    nested["blockers"].append("nested SHA-256 mismatch")
                if nested["zip_readable"]:
                    with zipfile.ZipFile(io.BytesIO(data)) as inner:
                        nested["blockers"].extend(_safe_zip_names(inner))
                else:
                    nested["blockers"].append("nested artifact is not a readable ZIP")
                if nested["blockers"]:
                    result["blockers"].extend(f"{relative}: {item}" for item in nested["blockers"])
                result["nested"].append(nested)
    result["blockers"] = sorted(set(result["blockers"]))
    result["active_package_admission_safe"] = not result["blockers"]
    result["report_sha256"] = digest_value(result)
    return result


def build_status() -> dict[str, Any]:
    package_paths = sorted((INTAKE / "source-zips").glob("*.zip"))
    contract = contract_audit()
    probe = probe_module1_v011(INTAKE / "source-zips" / "AXM_HUMAN_CAPABILITY_ATLAS_FINAL_LOCAL_INTAKE_v0_11_0.zip")
    workflow_path = HERE / "generated" / "verified-workflow" / "workflow-summary.json"
    workflow = None
    if workflow_path.is_file():
        try:
            workflow = json.loads(workflow_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            workflow = None
    pipeline_pass = isinstance(workflow, dict) and workflow.get("pipeline_status") == "PASS"
    status = {
        "schema": "axm.capability-intelligence-platform-status/v1",
        "overall": (
            "INTEGRATED_WITH_NATIVE_CONTRACT_HOLD"
            if probe["active_package_admission_safe"] and pipeline_pass
            else "WORKING_WITH_CONTRACT_HOLD"
            if probe["active_package_admission_safe"]
            else "HOLD"
        ),
        "modules": [
            {"id": "human-capability-atlas", "version": "0.11.0", "role": "capability truth and human-readable atlas", "engine": "tools/human-capability-atlas/engine", "status": "TEST"},
            {"id": "human-interface-intelligence", "version": "0.6.0", "role": "deterministic interface recommendation", "engine": "tools/human-interface-intelligence/engine", "status": "TEST"},
            {"id": "grounded-evolution-intelligence", "version": "0.7.0", "role": "evidence-led diagnosis and evolution proposals", "engine": "tools/grounded-evolution-intelligence/engine", "status": "TEST"},
        ],
        "source_packages": [
            {"path": path.relative_to(WORKSHOP).as_posix(), "sha256": digest_file(path)}
            for path in package_paths
        ],
        "module1_v011_probe": probe,
        "contract_seam": contract,
        "platform_adapter": {
            "status": "OPERATIONAL_TESTED" if pipeline_pass else "READY_FOR_PLATFORM_TEST",
            "capability": PLATFORM_BRIDGE_ID + "/" + PLATFORM_BRIDGE_VERSION,
            "mapping_version": PLATFORM_MAPPING_VERSION,
            "preserves_source_sidecar": True,
            "automatic_execution": False,
        },
        "verified_workflow": {
            "status": workflow.get("pipeline_status") if isinstance(workflow, dict) else "NOT_RUN",
            "summary": workflow_path.relative_to(WORKSHOP).as_posix(),
            "receipt_sha256": workflow.get("pipeline_receipt_sha256") if isinstance(workflow, dict) else None,
            "module1_humanization": bool(pipeline_pass),
            "module2_interface_application": bool(pipeline_pass),
            "module3_signal_metabolism": bool(pipeline_pass),
        },
        "merge_gate": {
            "status": "HOLD",
            "reason": "Native Module 1/Module 2 schema identity conflict remains unresolved.",
            "human_authority": "Mike authorized local platform integration; CANON/public promotion remains separate.",
        },
        "truth": {
            "sources_mutated": False,
            "declarations_are_runtime_proof": False,
            "adapter_clears_native_contract_conflict": False,
            "verification_is_canon": False,
        },
    }
    status["status_sha256"] = digest_value(status)
    return status


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="AXM three-module capability intelligence seam")
    sub = parser.add_subparsers(dest="command", required=True)
    adapt = sub.add_parser("adapt", help="adapt one Module One Capability Record for Module Two review")
    adapt.add_argument("input", type=Path)
    adapt.add_argument("--output", type=Path, required=True)
    adapt.add_argument("--receipt", type=Path, required=True)
    audit = sub.add_parser("audit", help="compile static platform integration status")
    audit.add_argument("--output", type=Path, default=HERE / "status.json")
    probe = sub.add_parser("probe-module1", help="probe the rooted Module One v0.11 outer bundle")
    probe.add_argument("bundle", type=Path)
    probe.add_argument("--output", type=Path)
    args = parser.parse_args()

    if args.command == "adapt":
        record = json.loads(args.input.read_text(encoding="utf-8"))
        adapted, receipt = adapt_capability_record(record)
        _write_json(args.output, adapted)
        _write_json(args.receipt, receipt)
        print(json.dumps({"status": "PASS", "review_state": receipt["review_state"], "receipt_sha256": receipt["receipt_sha256"]}, indent=2))
        return 0
    if args.command == "audit":
        status = build_status()
        _write_json(args.output, status)
        print(json.dumps({"overall": status["overall"], "contract": status["contract_seam"]["overall"], "merge_gate": status["merge_gate"]["status"], "status_sha256": status["status_sha256"]}, indent=2))
        return 0 if status["overall"] in {"WORKING_WITH_CONTRACT_HOLD", "INTEGRATED_WITH_NATIVE_CONTRACT_HOLD"} else 2
    result = probe_module1_v011(args.bundle)
    if args.output:
        _write_json(args.output, result)
    print(json.dumps({"status": "PASS" if result["active_package_admission_safe"] else "HOLD", "blockers": result["blockers"], "report_sha256": result["report_sha256"]}, indent=2))
    return 0 if result["active_package_admission_safe"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
