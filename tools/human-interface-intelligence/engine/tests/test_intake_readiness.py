from __future__ import annotations

import copy
import json
from pathlib import Path

from jsonschema import Draft202012Validator

from axm_hii.audit import audit_handoff
from axm_hii.context import assess_context
from axm_hii.dependency_lock import verify_dependency_lock
from axm_hii.engine import recommend_interface
from axm_hii.gate import MODULE_VERSION, run_cross_module_gate
from axm_hii.health import build_evolution_observations, build_health_report
from axm_hii.receipts import build_decision_receipt, compare_receipts

ROOT = Path(__file__).resolve().parent.parent
BATCH_PATH = ROOT / "integration" / "examples" / "shared_fixture_handoff_batch.json"
ANCHOR_PATH = ROOT / "tests" / "fixtures" / "legacy_blocked_module1_anchor_v0_1_0.zip"


def load_batch() -> dict:
    return json.loads(BATCH_PATH.read_text(encoding="utf-8"))


def first_item() -> dict:
    return load_batch()["records"][0]


def validate(schema_name: str, instance: dict) -> list:
    schema = json.loads((ROOT / "integration" / "schemas" / schema_name).read_text(encoding="utf-8"))
    return list(Draft202012Validator(schema).iter_errors(instance))


def test_context_assessment_accepts_shared_fixture_context() -> None:
    assert assess_context(first_item()["context"])["valid"] is True


def test_context_assessment_rejects_missing_and_unknown_fields() -> None:
    context = copy.deepcopy(first_item()["context"])
    del context["collaboration_mode"]
    context["invented_knob"] = True
    result = assess_context(context)
    assert result["valid"] is False
    assert "collaboration_mode" in result["missing_fields"]
    assert result["unknown_fields"] == ["invented_knob"]


def test_gate_fails_context_preflight_without_silent_defaults() -> None:
    batch = load_batch()
    del batch["records"][0]["context"]["collaboration_mode"]
    report = run_cross_module_gate(batch, generated_at="fixed")
    record = report["records"][0]
    assert record["gate_status"] == "FAIL"
    assert record["recommendation"] is None
    assert "no defaults or silent rewrites" in record["reasons"][0]


def test_decision_receipt_is_stable_across_runtime_timestamp() -> None:
    item = first_item()
    a = recommend_interface(item["capability"], item["context"], generated_at="A")
    b = recommend_interface(item["capability"], item["context"], generated_at="B")
    ra = build_decision_receipt(item["capability"], item["context"], a, module_version=MODULE_VERSION)
    rb = build_decision_receipt(item["capability"], item["context"], b, module_version=MODULE_VERSION)
    assert compare_receipts(ra, rb)["match"] is True
    assert ra["receipt_id"] == rb["receipt_id"]
    assert validate("decision-receipt.schema.json", ra) == []


def test_decision_receipt_changes_when_context_changes() -> None:
    item = first_item()
    changed_context = copy.deepcopy(item["context"])
    changed_context["user_skill_level"] = "specialist"
    a = recommend_interface(item["capability"], item["context"], generated_at="fixed")
    b = recommend_interface(item["capability"], changed_context, generated_at="fixed")
    ra = build_decision_receipt(item["capability"], item["context"], a, module_version=MODULE_VERSION)
    rb = build_decision_receipt(item["capability"], changed_context, b, module_version=MODULE_VERSION)
    comparison = compare_receipts(ra, rb)
    assert comparison["match"] is False
    assert any(item["field"] == "context_hash" for item in comparison["differences"])


def test_dependency_lock_passes_current_package() -> None:
    report = verify_dependency_lock()
    assert report["overall_status"] == "PASS"
    assert all(item["status"] == "PASS" for item in report["files"])


def test_dependency_lock_detects_mutation(tmp_path: Path) -> None:
    lock = json.loads((ROOT / "integration" / "dependency_lock.json").read_text(encoding="utf-8"))
    for entry in lock["files"]:
        source = ROOT / entry["path"]
        target = tmp_path / entry["path"]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(source.read_bytes())
    target = tmp_path / lock["files"][0]["path"]
    target.write_bytes(target.read_bytes() + b"\n")
    report = verify_dependency_lock(ROOT / "integration" / "dependency_lock.json", package_root=tmp_path)
    assert report["overall_status"] == "BLOCKED"
    assert any(item["status"] == "CONFLICTED" for item in report["files"])


def test_health_and_evolution_outputs_cover_fixture_batch() -> None:
    gate = run_cross_module_gate(load_batch(), generated_at="fixed")
    health = build_health_report(gate)
    observations = build_evolution_observations(gate)
    assert health["intake_readiness"]["all_gate_consistency_checks_passed"] is True
    assert health["intake_readiness"]["direct_recommendation_count"] == 4
    assert health["intake_readiness"]["conditional_recommendation_count"] == 4
    assert health["intake_readiness"]["blocked_recommendation_count"] == 2
    assert health["total_records"] == 10
    assert observations["governance"]["advisory_only"] is True
    assert observations["governance"]["automatic_code_change"] is False
    kinds = {item["kind"] for item in observations["observations"]}
    assert "evidence_gap" in kinds
    assert "evidence_conflict" in kinds
    assert validate("intake-health-report.schema.json", health) == []
    assert validate("evolution-observation-batch.schema.json", observations) == []


def test_full_intake_audit_generates_receipt_per_fixture_record() -> None:
    audit = audit_handoff(load_batch(), generated_at="fixed")
    assert audit["cross_module_gate"]["overall_status"] == "PASS"
    assert len(audit["decision_receipts"]) == 10
    assert audit["health_report"]["intake_readiness"]["all_gate_consistency_checks_passed"] is True
    assert audit["health_report"]["intake_readiness"]["all_records_directly_recommendable"] is False
    assert all(item["assessment"]["valid"] for item in audit["context_assessments"])
    assert validate("intake-audit.schema.json", audit) == []


def test_current_module_one_anchor_still_blocks_before_record_consumption() -> None:
    if not ANCHOR_PATH.exists():
        return
    audit = audit_handoff(load_batch(), anchor_path=ANCHOR_PATH, generated_at="fixed", strict_provenance=True)
    assert audit["cross_module_gate"] is None
    assert audit["paired_boundary"]["overall_status"] == "BLOCKED"
    assert audit["decision_receipts"] == []
    assert audit["evolution_observations"]["governance"]["automatic_canon"] is False
    assert audit["evolution_observations"]["observations"][0]["kind"] == "boundary_block"
