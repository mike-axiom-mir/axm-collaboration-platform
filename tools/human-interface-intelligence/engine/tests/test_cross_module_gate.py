from __future__ import annotations

import copy
import json
from pathlib import Path

from jsonschema import Draft202012Validator

from axm_hii.gate import run_cross_module_gate
from axm_hii.handoff import canonical_sha256
from axm_hii.trace import build_score_trace

ROOT = Path(__file__).resolve().parent.parent
BATCH_PATH = ROOT / "integration" / "examples" / "shared_fixture_handoff_batch.json"
REPORT_SCHEMA = ROOT / "integration" / "schemas" / "cross-module-gate-report.schema.json"


def load_batch() -> dict:
    return json.loads(BATCH_PATH.read_text(encoding="utf-8"))


def test_all_shared_fixture_handoffs_pass_without_claiming_atlas_run() -> None:
    report = run_cross_module_gate(load_batch(), generated_at="fixed", include_trace=True)
    assert report["overall_status"] == "PASS"
    assert report["external_atlas_execution_state"] == "NOT_RUN"
    assert report["summary"] == {"total": 10, "PASS": 10, "FAIL": 0, "BLOCKED": 0, "NOT_RUN": 0}


def test_gate_report_is_deterministic_with_fixed_timestamp() -> None:
    batch = load_batch()
    first = run_cross_module_gate(batch, generated_at="fixed")
    second = run_cross_module_gate(batch, generated_at="fixed")
    assert first == second


def test_report_validates_against_module_specific_schema() -> None:
    report = run_cross_module_gate(load_batch(), generated_at="fixed")
    schema = json.loads(REPORT_SCHEMA.read_text(encoding="utf-8"))
    errors = list(Draft202012Validator(schema).iter_errors(report))
    assert errors == []


def test_strict_verified_provenance_passes() -> None:
    batch = load_batch()
    batch["records"] = [copy.deepcopy(batch["records"][0])]
    item = batch["records"][0]
    source_payload = {"capability_id": "axm.file.rename", "revision": "1.0.0"}
    item["source_payload"] = source_payload
    item["capability"]["source_reference"]["source_hash"] = canonical_sha256(source_payload)
    item["immutable_source"]["source_hash"] = canonical_sha256(source_payload)
    report = run_cross_module_gate(batch, generated_at="fixed", strict_provenance=True)
    assert report["overall_status"] == "PASS"
    assert report["records"][0]["provenance"]["status"] == "VERIFIED"


def test_tampered_source_payload_is_blocked() -> None:
    batch = load_batch()
    batch["records"] = [copy.deepcopy(batch["records"][0])]
    item = batch["records"][0]
    source_payload = {"capability_id": "axm.file.rename", "revision": "1.0.0"}
    item["capability"]["source_reference"]["source_hash"] = canonical_sha256(source_payload)
    item["immutable_source"]["source_hash"] = canonical_sha256(source_payload)
    item["source_payload"] = {"capability_id": "tampered", "revision": "1.0.0"}
    report = run_cross_module_gate(batch, generated_at="fixed", strict_provenance=True)
    assert report["overall_status"] == "BLOCKED"
    assert report["records"][0]["gate_status"] == "BLOCKED"
    assert report["records"][0]["provenance"]["status"] == "CONFLICTED"


def test_immutable_source_change_is_blocked() -> None:
    batch = load_batch()
    batch["records"] = [copy.deepcopy(batch["records"][0])]
    batch["records"][0]["capability"]["capability_revision"] = "silently-rewritten"
    report = run_cross_module_gate(batch, generated_at="fixed")
    assert report["records"][0]["gate_status"] == "BLOCKED"
    assert report["records"][0]["immutable_source"]["status"] == "CONFLICTED"


def test_invalid_capability_record_fails() -> None:
    batch = load_batch()
    batch["records"] = [copy.deepcopy(batch["records"][0])]
    del batch["records"][0]["capability"]["risk_profile"]
    report = run_cross_module_gate(batch, generated_at="fixed")
    assert report["overall_status"] == "FAIL"
    assert report["records"][0]["capability_validation"]["valid"] is False


def test_missing_expectation_is_not_run_not_fake_pass() -> None:
    batch = load_batch()
    batch["records"] = [copy.deepcopy(batch["records"][0])]
    del batch["records"][0]["expected"]
    report = run_cross_module_gate(batch, generated_at="fixed")
    assert report["overall_status"] == "NOT_RUN"
    assert report["records"][0]["gate_status"] == "NOT_RUN"


def test_score_trace_contains_all_registry_patterns_and_matches_selected() -> None:
    batch = load_batch()
    item = batch["records"][0]
    trace = build_score_trace(item["capability"], item["context"])
    report = run_cross_module_gate(batch, generated_at="fixed")
    assert len(trace["ranked_patterns"]) == 27
    selected = report["records"][0]["recommendation"]["recommended_interface"]["interface_pattern_id"]
    assert trace["ranked_patterns"][0]["interface_pattern_id"] == selected
