#!/usr/bin/env python3
from __future__ import annotations
import json, sys
from pathlib import Path
from jsonschema import Draft202012Validator

BASE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE / "scripts"))
from rebuild_state import rebuild

MAPPING = {
    "module_passports": "module_passport.schema.json",
    "capabilities": "capability_record.schema.json",
    "dependencies": "dependency_edge.schema.json",
    "evidence": "evidence_record.schema.json",
    "needs": "improvement_need.schema.json",
    "directions": "evolution_direction.schema.json",
}

schema_results = []
for p in sorted((BASE / "schemas").glob("*.json")):
    try:
        Draft202012Validator.check_schema(json.loads(p.read_text(encoding="utf-8")))
        schema_results.append({"schema": p.name, "valid": True, "error": None})
    except Exception as exc:
        schema_results.append({"schema": p.name, "valid": False, "error": str(exc)})

record_results = []
entities = {}
for folder, schema_name in MAPPING.items():
    schema = json.loads((BASE / "schemas" / schema_name).read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    for p in sorted((BASE / "registry" / folder).glob("*.json")):
        try:
            obj = json.loads(p.read_text(encoding="utf-8"))
            validator.validate(obj)
            entity_id = next(v for k, v in obj.items() if k.endswith("_id"))
            entities[entity_id] = obj
            record_results.append({"record": str(p.relative_to(BASE)), "schema": schema_name, "valid": True, "error": None})
        except Exception as exc:
            record_results.append({"record": str(p.relative_to(BASE)), "schema": schema_name, "valid": False, "error": str(exc)})

event_schema = json.loads((BASE / "schemas" / "event_envelope.schema.json").read_text(encoding="utf-8"))
event_validator = Draft202012Validator(event_schema)
event_valid = True
event_error = None
try:
    for line in (BASE / "event_log" / "phase1_events.jsonl").read_text(encoding="utf-8").splitlines():
        if line.strip():
            event_validator.validate(json.loads(line))
    state1 = rebuild(BASE / "event_log" / "phase1_events.jsonl")
    state2 = rebuild(BASE / "event_log" / "phase1_events.jsonl")
    deterministic = state1["state_hash"] == state2["state_hash"]
except Exception as exc:
    event_valid = False
    event_error = str(exc)
    deterministic = False
    state1 = {"state_hash": "sha256:" + "0" * 64, "event_count": 0, "entities": {}}

modules = {k for k in entities if k.startswith("axm:module:")}
caps = {k for k in entities if k.startswith("axm:capability:")}
evidence = {k for k in entities if k.startswith("axm:evidence:")}
needs = {k for k in entities if k.startswith("axm:need:")}
directions = {k for k in entities if k.startswith("axm:direction:")}

errors = []
for eid, obj in entities.items():
    for ref in obj.get("evidence_references", obj.get("evidence", [])):
        if ref not in evidence:
            errors.append(f"{eid}: missing evidence {ref}")
    if eid.startswith("axm:module:"):
        for ref in obj.get("dependencies", []) + obj.get("dependents", []):
            if ref not in modules:
                errors.append(f"{eid}: missing module reference {ref}")
        for ref in obj.get("declared_capabilities", []) + obj.get("proven_capabilities", []):
            if ref not in caps:
                errors.append(f"{eid}: missing capability reference {ref}")
        for ref in obj.get("open_needs", []) + obj.get("current_blockers", []):
            if ref not in needs:
                errors.append(f"{eid}: missing need reference {ref}")
    if eid.startswith("axm:capability:"):
        for ref in obj["provider_modules"] + obj["consumer_modules"]:
            if ref not in modules:
                errors.append(f"{eid}: missing provider/consumer {ref}")
        for ref in obj["improvement_needs"]:
            if ref not in needs:
                errors.append(f"{eid}: missing need {ref}")
    if eid.startswith("axm:edge:"):
        if obj["source_node"] not in modules or obj["target_node"] not in modules:
            errors.append(f"{eid}: edge endpoint missing")
    if eid.startswith("axm:need:"):
        for ref in obj["assigned_direction_ids"]:
            if ref not in directions:
                errors.append(f"{eid}: missing direction {ref}")
    if eid.startswith("axm:direction:"):
        for ref in obj["target_scope"]:
            if ref not in needs:
                errors.append(f"{eid}: missing target need {ref}")
        for ref in obj["affected_modules"]:
            if ref not in modules:
                errors.append(f"{eid}: missing affected module {ref}")

snapshot = json.loads((BASE / "intake" / "GITHUB_SNAPSHOT.json").read_text(encoding="utf-8"))
snapshot_valid = (
    snapshot["commit"] == "c2dbeb69c39e4bc38363edb58adc7d671378da22"
    and snapshot["repository"] == "mike-axiom-mir/axm-collaboration-platform"
    and snapshot["execution_boundary"]["repository_tests_executed_here"] is False
)

counts = {
    "modules": len(modules),
    "capabilities": len(caps),
    "evidence": len(evidence),
    "dependencies": len([k for k in entities if k.startswith("axm:edge:")]),
    "needs": len(needs),
    "directions": len(directions),
    "events": state1.get("event_count", 0),
}
minimums_pass = (
    counts["modules"] >= 16 and counts["capabilities"] >= 15 and
    counts["dependencies"] >= 17 and counts["needs"] >= 9 and
    counts["directions"] >= 6
)

acceptance = (
    all(x["valid"] for x in schema_results)
    and all(x["valid"] for x in record_results)
    and event_valid and deterministic and not errors
    and snapshot_valid and minimums_pass
)

report = {
    "contract_version": "0.1.0",
    "package_version": "0.2.0",
    "generated_at": "2026-08-05T00:20:00Z",
    "snapshot": {
        "repository": snapshot["repository"],
        "commit": snapshot["commit"],
        "commit_time": snapshot["commit_time"],
        "tests_executed_here": False,
    },
    "schema_results": schema_results,
    "record_results": record_results,
    "event_chain_valid": event_valid,
    "event_error": event_error,
    "rebuild_deterministic": deterministic,
    "rebuild_hash": state1["state_hash"],
    "reference_integrity_valid": not errors,
    "reference_errors": errors,
    "snapshot_boundary_valid": snapshot_valid,
    "minimum_census_passed": minimums_pass,
    "counts": counts,
    "acceptance_passed": acceptance,
    "limitations": [
        "Source inspection was connector-backed and pinned to one public commit; no repository checkout was obtained.",
        "Repository tests were not executed or reproduced in this environment.",
        "Capability records preserve declarations but intentionally leave proof_status UNKNOWN.",
        "The census is representative, not the full 210-module registry.",
        "Generated evolution directions are pending steward selection and do not apply changes.",
    ],
}
(BASE / "generated" / "phase1_validation_report.json").write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
(BASE / "generated" / "reconstructed_state.json").write_text(json.dumps(state1, indent=2, sort_keys=True) + "\n", encoding="utf-8")
print(json.dumps({
    "status": "PASS" if acceptance else "FAIL",
    "counts": counts,
    "event_chain_valid": event_valid,
    "rebuild_deterministic": deterministic,
    "reference_integrity_valid": not errors,
    "snapshot_boundary_valid": snapshot_valid,
    "state_hash": state1["state_hash"],
}, indent=2))
raise SystemExit(0 if acceptance else 1)
