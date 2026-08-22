from __future__ import annotations

import copy
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import pytest
from jsonschema import Draft202012Validator

from axm_hii import anchor
from axm_hii.assurance import build_recommendation_assurance
from axm_hii.context import assess_context
from axm_hii.engine import recommend_interface
from axm_hii.receipts import build_decision_receipt
from axm_hii.registry import PatternRegistry, RegistryValidationError
from axm_hii.trace import build_score_trace
from axm_hii.canonical import loads as loads_canonical, loads_standard
from axm_hii.util import DuplicateJSONKeyError, NonFiniteJSONNumberError, loads_json
from axm_hii.version import MODULE_VERSION

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "shared-contract" / "fixtures"
SCHEMA_DIR = ROOT / "integration" / "schemas"
LEGACY_ANCHOR = ROOT / "tests" / "fixtures" / "legacy_blocked_module1_anchor_v0_1_0.zip"


def fixture(name: str = "01_file_rename.json") -> dict:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def schema(name: str) -> dict:
    return json.loads((SCHEMA_DIR / name).read_text(encoding="utf-8"))


def test_reduced_cognitive_load_is_supported_across_all_shared_fixtures() -> None:
    for path in sorted(FIXTURE_DIR.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        context = copy.deepcopy(payload["recommendation_context"])
        context["accessibility_needs"] = ["reduced_cognitive_load"]
        recommendation = recommend_interface(payload["shared_capability_record"], context, generated_at="fixed")
        assert recommendation["capability_id"] == payload["shared_capability_record"]["capability_id"]


def test_context_rejects_unbounded_budget_tokens() -> None:
    context = copy.deepcopy(fixture()["recommendation_context"])
    context["resource_budget"]["compute"] = "basically_free"
    report = assess_context(context)
    assert report["valid"] is False
    assert any(item["path"] == "/context/resource_budget/compute" for item in report["errors"])
    with pytest.raises(ValueError, match="Invalid recommendation context"):
        recommend_interface(fixture()["shared_capability_record"], context)


def test_unsupported_accessibility_need_is_retained_and_forces_review() -> None:
    payload = fixture()
    context = copy.deepcopy(payload["recommendation_context"])
    context["accessibility_needs"] = ["custom_neuro_motor_need"]
    assessment = assess_context(context)
    assert assessment["valid"] is True
    assert assessment["unsupported_accessibility_needs"] == ["custom_neuro_motor_need"]
    recommendation = recommend_interface(payload["shared_capability_record"], context, generated_at="fixed")
    assert recommendation["recommended_interface"]["recommendation_status"] == "conditional"
    assert any("Manual accessibility review" in value for value in recommendation["recommended_interface"]["why_this_interface"])


def test_explicitly_unsafe_pattern_is_hard_ineligible_even_if_it_scores_highest() -> None:
    payload = fixture()
    capability = copy.deepcopy(payload["shared_capability_record"])
    capability["interface_requirements"]["unsafe_interface_patterns"].append("guided_form")
    recommendation = recommend_interface(capability, payload["recommendation_context"], generated_at="fixed")
    assert recommendation["recommended_interface"]["interface_pattern_id"] != "guided_form"
    trace = build_score_trace(capability, payload["recommendation_context"])
    guided = next(row for row in trace["ranked_patterns"] if row["interface_pattern_id"] == "guided_form")
    assert guided["eligible"] is False
    assert any("unsafe" in reason.lower() for reason in guided["eligibility_blockers"])


def test_all_patterns_unsafe_returns_no_safe_match() -> None:
    payload = fixture()
    capability = copy.deepcopy(payload["shared_capability_record"])
    capability["interface_requirements"]["unsafe_interface_patterns"] = [
        pattern["interface_pattern_id"] for pattern in PatternRegistry()
    ]
    recommendation = recommend_interface(capability, payload["recommendation_context"], generated_at="fixed")
    selected = recommendation["recommended_interface"]
    assert selected["recommendation_status"] == "no_safe_match"
    assert selected["interface_pattern_id"] == ""


def test_offline_requirement_cannot_be_overridden_by_score() -> None:
    payload = fixture()
    data = PatternRegistry().data
    for pattern in data["patterns"]:
        pattern["offline_capable"] = False
    registry = PatternRegistry(data)
    context = copy.deepcopy(payload["recommendation_context"])
    context["offline_required"] = True
    recommendation = recommend_interface(
        payload["shared_capability_record"], context, registry=registry, generated_at="fixed"
    )
    assert recommendation["recommended_interface"]["recommendation_status"] == "no_safe_match"
    assert recommendation["recommended_interface"]["interface_pattern_id"] == ""


def test_duplicate_pattern_ids_are_rejected() -> None:
    data = PatternRegistry().data
    data["patterns"][1]["interface_pattern_id"] = data["patterns"][0]["interface_pattern_id"]
    with pytest.raises(RegistryValidationError, match="Duplicate pattern ID"):
        PatternRegistry(data)


def test_registry_snapshot_cannot_be_mutated_after_fingerprint() -> None:
    registry = PatternRegistry()
    fingerprint = registry.fingerprint
    external = registry.data
    external["patterns"][0]["interface_name"] = "mutated"
    returned = registry.get("simple_action_button")
    returned["interface_name"] = "mutated-again"
    assert registry.get("simple_action_button")["interface_name"] == "Simple action button"
    assert registry.fingerprint == fingerprint


def test_custom_registry_fingerprint_is_used_in_trace() -> None:
    data = PatternRegistry().data
    data["registry_version"] = "0.1.0-test-variant"
    registry = PatternRegistry(data)
    assert registry.fingerprint != PatternRegistry().fingerprint
    payload = fixture()
    trace = build_score_trace(
        payload["shared_capability_record"], payload["recommendation_context"], registry=registry
    )
    assert trace["registry_fingerprint"] == registry.fingerprint


def test_recommendation_holds_an_immutable_context_snapshot() -> None:
    payload = fixture()
    context = copy.deepcopy(payload["recommendation_context"])
    recommendation = recommend_interface(payload["shared_capability_record"], context, generated_at="fixed")
    original_skill = recommendation["context"]["user_skill_level"]
    context["user_skill_level"] = "specialist"
    context["device_types"].append("future_device")
    assert recommendation["context"]["user_skill_level"] == original_skill
    assert "future_device" not in recommendation["context"]["device_types"]


def test_decision_receipt_rejects_mismatched_context() -> None:
    payload = fixture()
    recommendation = recommend_interface(
        payload["shared_capability_record"], payload["recommendation_context"], generated_at="fixed"
    )
    wrong_context = copy.deepcopy(payload["recommendation_context"])
    wrong_context["user_skill_level"] = "specialist"
    with pytest.raises(ValueError, match="context snapshot"):
        build_decision_receipt(
            payload["shared_capability_record"],
            wrong_context,
            recommendation,
            module_version=MODULE_VERSION,
        )


def test_recommendation_identity_binds_capability_revision() -> None:
    payload = fixture()
    changed = copy.deepcopy(payload["shared_capability_record"])
    changed["capability_revision"] = "2.0.0-test"
    first = recommend_interface(
        payload["shared_capability_record"], payload["recommendation_context"], generated_at="fixed"
    )
    second = recommend_interface(changed, payload["recommendation_context"], generated_at="fixed")
    assert first["recommended_interface"]["interface_pattern_id"] == second["recommended_interface"]["interface_pattern_id"]
    assert first["recommendation_id"] != second["recommendation_id"]


def test_duplicate_json_keys_are_rejected() -> None:
    with pytest.raises(DuplicateJSONKeyError, match="Duplicate JSON object key"):
        loads_json('{"capability_id":"one","capability_id":"two"}')


def test_non_finite_json_numbers_are_rejected_by_all_module_parsers() -> None:
    for token in ("NaN", "Infinity", "-Infinity"):
        with pytest.raises(NonFiniteJSONNumberError, match="Non-finite JSON number"):
            loads_json('{"value":' + token + '}')
        with pytest.raises(ValueError, match="Non-finite JSON number"):
            loads_standard('{"value":' + token + '}')
        with pytest.raises(ValueError, match="Non-finite JSON number"):
            loads_canonical('{"value":' + token + '}')


def test_recommendation_assurance_validates_and_detects_input_mismatch() -> None:
    payload = fixture()
    recommendation = recommend_interface(
        payload["shared_capability_record"], payload["recommendation_context"], generated_at="fixed"
    )
    report = build_recommendation_assurance(
        payload["shared_capability_record"], payload["recommendation_context"], recommendation
    )
    assert list(Draft202012Validator(schema("recommendation-assurance.schema.json")).iter_errors(report)) == []
    assert report["overall_status"] in {"PASS", "REVIEW"}

    wrong_context = copy.deepcopy(payload["recommendation_context"])
    wrong_context["user_goal"] = "different goal"
    blocked = build_recommendation_assurance(
        payload["shared_capability_record"], wrong_context, recommendation
    )
    assert blocked["overall_status"] == "BLOCKED"
    binding = next(item for item in blocked["checks"] if item["check_id"] == "recommendation_input_binding")
    assert binding["status"] == "BLOCKED"


def test_anchor_archive_member_limit_is_enforced(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    archive_path = tmp_path / "too-many.zip"
    with ZipFile(archive_path, "w", ZIP_DEFLATED) as archive_file:
        archive_file.writestr("root/a.txt", "a")
        archive_file.writestr("root/b.txt", "b")
    monkeypatch.setattr(anchor, "MAX_MEMBER_COUNT", 1)
    with pytest.raises(ValueError, match="member-count limit"):
        anchor.read_anchor_archive(archive_path)


def test_module_specific_context_and_registry_schemas_validate_current_data() -> None:
    context_errors = list(
        Draft202012Validator(schema("recommendation-context.schema.json")).iter_errors(
            fixture()["recommendation_context"]
        )
    )
    registry_errors = list(
        Draft202012Validator(schema("interface-pattern-registry.schema.json")).iter_errors(
            PatternRegistry().data
        )
    )
    assert context_errors == []
    assert registry_errors == []


def test_active_schema_versions_match_module_version() -> None:
    gate_schema = schema("cross-module-gate-report.schema.json")
    audit_schema = schema("intake-audit.schema.json")
    receipt_schema = schema("decision-receipt.schema.json")
    assert MODULE_VERSION == "0.6.0"
    assert gate_schema["properties"]["module_version"]["const"] == MODULE_VERSION
    assert gate_schema["properties"]["report_version"]["const"] == "0.4.0"
    assert audit_schema["properties"]["module_version"]["const"] == MODULE_VERSION
    assert receipt_schema["properties"]["receipt_version"]["const"] == "0.2.0"
    assert "" not in receipt_schema


def test_legacy_anchor_fixture_is_portable_and_explicitly_non_authoritative() -> None:
    assert LEGACY_ANCHOR.is_file()
    readme = (LEGACY_ANCHOR.parent / "README.md").read_text(encoding="utf-8")
    assert "non-authoritative" in readme
    forbidden = 'Path(' + '"' + '/mnt/data/'
    for test_path in ROOT.joinpath("tests").glob("test_*.py"):
        assert forbidden not in test_path.read_text(encoding="utf-8")


def test_invalid_capability_is_rejected_before_field_indexing() -> None:
    with pytest.raises(ValueError, match="shared contract validation failed"):
        recommend_interface({"capability_id": "incomplete"}, fixture()["recommendation_context"])


def test_confirmation_and_safe_preview_are_explicit_required_controls() -> None:
    payload = fixture("04_destructive_file_deletion.json")
    recommendation = recommend_interface(
        payload["shared_capability_record"], payload["recommendation_context"], generated_at="fixed"
    )
    controls = recommendation["recommended_interface"]["required_controls"]
    flow = recommendation["recommended_interface"]["preview_and_confirmation_flow"]
    assert "explicit_confirmation" in controls
    assert "non_destructive_preview" in controls
    assert any("explicit confirmation" in step.lower() for step in flow)
    assert any("non-destructive preview" in step.lower() for step in flow)
