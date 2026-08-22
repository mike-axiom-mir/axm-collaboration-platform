from __future__ import annotations

import json
from pathlib import Path

import pytest

from axm_hii.engine import recommend_interface
from axm_hii.registry import PatternRegistry

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "shared-contract" / "fixtures"


@pytest.mark.parametrize("fixture_path", sorted(FIXTURE_DIR.glob("*.json")), ids=lambda p: p.stem)
def test_cross_module_fixture_expectations(fixture_path: Path) -> None:
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    recommendation = recommend_interface(
        fixture["shared_capability_record"],
        fixture["recommendation_context"],
        generated_at="2026-08-03T03:56:47Z",
    )
    expected = fixture["expected"]
    selected = recommendation["recommended_interface"]
    assert selected["interface_pattern_id"] == expected["interface_pattern_id"]
    assert selected["recommendation_status"] == expected["recommendation_status"]
    for operation in expected["beginner_allowed_contains"]:
        assert operation in recommendation["beginner_layer"]["allowed_operations"]
    for operation in expected["beginner_restricted_contains"]:
        assert operation in recommendation["beginner_layer"]["restricted_operations"]
    for unknown in expected["expected_unknowns"]:
        assert unknown in recommendation["evidence"]["unknowns"]
    reason_text = " ".join(selected["why_this_interface"])
    for fragment in expected["reason_fragments"]:
        assert fragment in reason_text


def test_recommendation_is_deterministic_with_fixed_timestamp() -> None:
    fixture = json.loads((FIXTURE_DIR / "02_image_background_replacement.json").read_text())
    first = recommend_interface(
        fixture["shared_capability_record"], fixture["recommendation_context"], generated_at="fixed"
    )
    second = recommend_interface(
        fixture["shared_capability_record"], fixture["recommendation_context"], generated_at="fixed"
    )
    assert first == second


def test_conflict_blocks_interface_controls() -> None:
    fixture = json.loads((FIXTURE_DIR / "10_conflicted_declaration.json").read_text())
    result = recommend_interface(fixture["shared_capability_record"], fixture["recommendation_context"])
    assert result["recommended_interface"]["recommendation_status"] == "no_safe_match"
    assert result["recommended_interface"]["interface_pattern_id"] == ""
    assert result["beginner_layer"]["enabled"] is False


def test_registry_contains_required_pattern_families() -> None:
    registry = PatternRegistry()
    ids = {pattern["interface_pattern_id"] for pattern in registry}
    assert len(ids) == 27
    required = {
        "simple_action_button", "guided_form", "wizard", "searchable_library",
        "command_palette", "conversational_interface", "structured_prompt_builder",
        "drag_drop_workspace", "node_graph_editor", "canvas", "timeline",
        "layer_editor", "property_inspector", "table_spreadsheet", "dashboard",
        "live_preview_controls", "before_after_comparison", "template_selector",
        "file_browser", "map_spatial_interface", "controller_game_style",
        "voice_interaction", "automation_recipe_builder", "code_editor",
        "hybrid_visual_code", "approval_confirmation", "monitoring_status",
    }
    assert required == ids


def test_accessibility_need_changes_deterministic_ranking() -> None:
    fixture = json.loads((FIXTURE_DIR / "01_file_rename.json").read_text())
    context = dict(fixture["recommendation_context"])
    context["accessibility_needs"] = ["screen_reader"]
    from axm_hii.scoring import rank_patterns

    ranked = rank_patterns(fixture["shared_capability_record"], context)
    scores = {item.pattern["interface_pattern_id"]: item.score for item in ranked}
    assert scores["guided_form"] > scores["canvas"]
    guided = next(item for item in ranked if item.pattern["interface_pattern_id"] == "guided_form")
    assert any("screen-reader" in reason for reason in guided.reasons)


def test_available_tools_change_interface_selection() -> None:
    fixture = json.loads((FIXTURE_DIR / "02_image_background_replacement.json").read_text())
    context = dict(fixture["recommendation_context"])
    context["available_tools"] = []
    recommendation = recommend_interface(
        fixture["shared_capability_record"], context, generated_at="fixed"
    )
    assert recommendation["recommended_interface"]["interface_pattern_id"] != "live_preview_controls"


def test_every_registry_pattern_has_explainability_fields() -> None:
    registry = PatternRegistry()
    required = {
        "handles_well", "handles_badly", "minimum_user_skill", "attention_cost",
        "interaction_cost", "error_likelihood", "accessibility_strengths",
        "accessibility_weaknesses", "preview_capability", "reversibility_support",
        "best_input_types", "best_output_types", "beginner_suitable",
        "advanced_capability_types_requiring_another_interface", "selection_reasons",
        "rejection_reasons", "compute_overhead", "required_tool_any",
    }
    for pattern in registry:
        assert required <= set(pattern), pattern["interface_pattern_id"]
        assert pattern["selection_reasons"]
        assert pattern["rejection_reasons"]
