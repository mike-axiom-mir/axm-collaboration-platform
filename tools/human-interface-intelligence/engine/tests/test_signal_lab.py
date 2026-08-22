from __future__ import annotations

import copy
import json
from pathlib import Path

from jsonschema import Draft202012Validator

from axm_hii.audit import audit_handoff
from axm_hii.coverage import build_pattern_coverage
from axm_hii.drift import classify_decision_drift
from axm_hii.engine import recommend_interface
from axm_hii.gate import MODULE_VERSION, run_cross_module_gate
from axm_hii.receipts import build_decision_receipt
from axm_hii.robustness import probe_recommendation_stability
from axm_hii.signal_lab import run_signal_lab
from axm_hii.signals import build_quarantine_signal_packet

ROOT = Path(__file__).resolve().parent.parent
BATCH_PATH = ROOT / "integration" / "examples" / "shared_fixture_handoff_batch.json"
ANCHOR_PATH = ROOT / "tests" / "fixtures" / "legacy_blocked_module1_anchor_v0_1_0.zip"


def load_batch() -> dict:
    return json.loads(BATCH_PATH.read_text(encoding="utf-8"))


def validate(schema_name: str, instance: dict) -> list:
    schema = json.loads((ROOT / "integration" / "schemas" / schema_name).read_text(encoding="utf-8"))
    return list(Draft202012Validator(schema).iter_errors(instance))


def test_robustness_is_deterministic_and_shadow_only() -> None:
    item = load_batch()["records"][0]
    a = probe_recommendation_stability(item["capability"], item["context"])
    b = probe_recommendation_stability(item["capability"], item["context"])
    assert a == b
    assert a["authority"] == "shadow_advisory_only"
    assert a["probe_count"] <= 8
    assert all(probe["synthetic_context"] is True for probe in a["probes"])
    assert validate("robustness-report.schema.json", a) == []


def test_robustness_does_not_rewrite_authoritative_recommendation() -> None:
    item = load_batch()["records"][1]
    capability_before = copy.deepcopy(item["capability"])
    context_before = copy.deepcopy(item["context"])
    base = recommend_interface(item["capability"], item["context"], generated_at="fixed")
    shadow = probe_recommendation_stability(item["capability"], item["context"])
    after = recommend_interface(item["capability"], item["context"], generated_at="fixed")
    assert base == after
    assert item["capability"] == capability_before
    assert item["context"] == context_before
    assert shadow["base_outcome"]["pattern_id"] == base["recommended_interface"]["interface_pattern_id"]


def test_pattern_coverage_counts_registry_without_removing_unused_patterns() -> None:
    gate = run_cross_module_gate(load_batch(), generated_at="fixed", include_trace=True)
    report = build_pattern_coverage(gate)
    assert report["registry_pattern_count"] == 27
    assert len(report["patterns_never_selected_in_batch"]) > 0
    assert "must not be removed" in report["interpretation_limits"][1]
    assert validate("pattern-coverage-report.schema.json", report) == []


def test_quarantine_packet_retains_blocked_context_as_signal_without_authority() -> None:
    batch = load_batch()
    del batch["records"][0]["context"]["collaboration_mode"]
    audit = audit_handoff(batch, generated_at="fixed")
    packet = build_quarantine_signal_packet(audit)
    assert packet["governance"]["execution_authority"] is False
    assert packet["governance"]["failed_records_are_not_promoted_to_facts"] is True
    assert any(item["kind"] == "context_preflight_failure" for item in packet["signals"])
    assert validate("quarantine-signal-packet.schema.json", packet) == []


def test_current_anchor_block_becomes_signal_but_does_not_create_recommendations() -> None:
    if not ANCHOR_PATH.exists():
        return
    report = run_signal_lab(load_batch(), anchor_path=str(ANCHOR_PATH), generated_at="fixed", strict_provenance=True)
    assert report["authoritative_audit"]["cross_module_gate"] is None
    assert report["authoritative_audit"]["paired_boundary"]["overall_status"] == "BLOCKED"
    assert report["robustness_reports"] == []
    assert report["pattern_coverage"] is None
    assert report["governance"]["shadow_outputs_cannot_enable_execution"] is True
    assert any(item["kind"] == "paired_boundary_block" for item in report["quarantine_signal_packet"]["signals"])
    assert validate("signal-lab-report.schema.json", report) == []


def test_signal_lab_on_fixture_batch_keeps_authoritative_gate_and_adds_shadow_reports() -> None:
    report = run_signal_lab(load_batch(), generated_at="fixed")
    assert report["mode"] == "shadow_advisory_only"
    assert report["authoritative_audit"]["cross_module_gate"]["overall_status"] == "PASS"
    assert len(report["robustness_reports"]) == 10
    assert report["pattern_coverage"]["registry_pattern_count"] == 27
    assert report["governance"]["authoritative_selection_engine_unchanged"] is True
    assert validate("signal-lab-report.schema.json", report) == []


def test_decision_drift_identifies_context_change() -> None:
    item = load_batch()["records"][0]
    before_rec = recommend_interface(item["capability"], item["context"], generated_at="fixed")
    before = build_decision_receipt(item["capability"], item["context"], before_rec, module_version=MODULE_VERSION)
    changed_context = copy.deepcopy(item["context"])
    changed_context["user_skill_level"] = "specialist"
    after_rec = recommend_interface(item["capability"], changed_context, generated_at="fixed")
    after = build_decision_receipt(item["capability"], changed_context, after_rec, module_version=MODULE_VERSION)
    drift = classify_decision_drift(before, after)
    assert drift["exact_match"] is False
    assert "recommendation_context_changed" in drift["candidate_change_causes"]
    assert validate("decision-drift-report.schema.json", drift) == []


def test_decision_drift_exact_match_has_no_candidate_cause() -> None:
    item = load_batch()["records"][0]
    rec = recommend_interface(item["capability"], item["context"], generated_at="fixed")
    receipt = build_decision_receipt(item["capability"], item["context"], rec, module_version=MODULE_VERSION)
    drift = classify_decision_drift(receipt, copy.deepcopy(receipt))
    assert drift["exact_match"] is True
    assert drift["decision_changed"] is False
    assert drift["candidate_change_causes"] == []


def test_shadow_signal_packet_marks_counterfactuals_non_authoritative() -> None:
    report = run_signal_lab(load_batch(), generated_at="fixed")
    packet = report["shadow_signal_packet"]
    assert packet["governance"]["execution_authority"] is False
    assert packet["governance"]["synthetic_counterfactuals_are_not_observed_facts"] is True
    assert any(item["kind"] == "synthetic_recommendation_sensitivity" for item in packet["signals"])
    assert any(item["kind"] == "bounded_stability_summary" for item in packet["signals"])


def test_signal_ledger_preview_is_hash_chained_and_not_claimed_persisted() -> None:
    from axm_hii.ledger import verify_ledger_chain
    report = run_signal_lab(load_batch(), generated_at="fixed")
    ledger = report["signal_ledger_preview"]
    assert ledger["persistence_state"] == "NOT_WRITTEN_TO_LOCAL_LEDGER"
    assert ledger["verification"]["status"] == "PASS"
    assert len(ledger["entries"]) == 2
    assert ledger["entries"][1]["previous_entry_hash"] == ledger["entries"][0]["entry_hash"]
    assert verify_ledger_chain(ledger["entries"])["status"] == "PASS"
    assert validate("signal-ledger-preview.schema.json", ledger) == []


def test_signal_ledger_detects_tampering() -> None:
    from axm_hii.ledger import verify_ledger_chain
    report = run_signal_lab(load_batch(), generated_at="fixed")
    entries = copy.deepcopy(report["signal_ledger_preview"]["entries"])
    entries[0]["signal_count"] = 999
    assert verify_ledger_chain(entries)["status"] == "CONFLICTED"
    entries = copy.deepcopy(report["signal_ledger_preview"]["entries"])
    entries[0]["signal_packet_hash"] = "sha256:tampered"
    assert verify_ledger_chain(entries)["status"] == "CONFLICTED"
