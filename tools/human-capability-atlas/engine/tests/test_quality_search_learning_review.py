from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import json

from axm_capability_atlas.atlas import build_card
from axm_capability_atlas.ecosystem_learning import build_learning_path
from axm_capability_atlas.quality import audit_card, build_quality_report
from axm_capability_atlas.review_ledger import append_event, verify_ledger
from axm_capability_atlas.search import build_search_index, related_capabilities, search_index
from axm_capability_atlas.validators import validate_learning_path, validate_quality_report, validate_search_index

ROOT = Path(__file__).resolve().parents[1]


def card(name: str) -> dict:
    path = ROOT / "fixtures" / "source" / f"{name}.json"
    return build_card(json.loads(path.read_text(encoding="utf-8")), path)


def test_quality_report_does_not_count_unknown_card_as_usable():
    complete = card("image_background_replace")
    unknown = card("incomplete_documentation")
    report = build_quality_report([complete, unknown])
    by_id = {item["capability_id"]: item for item in report["capabilities"]}
    assert by_id[complete["capability_id"]]["status"] in {"usable", "conditional"}
    assert by_id[unknown["capability_id"]]["status"] == "blocked"
    assert report["summary"]["usable_capability_coverage_percent"] <= 50.0
    assert validate_quality_report(report) == []


def test_high_risk_without_confirmation_is_blocked_even_with_good_average():
    risky = card("destructive_delete")
    risky["risk_profile"]["human_confirmation_required"] = False
    audit = audit_card(risky)
    assert audit["status"] == "blocked"
    assert any("High-risk" in item for item in audit["blockers"])


def test_search_is_deterministic_and_explains_matches():
    cards = [card("file_rename"), card("image_background_replace"), card("data_analysis")]
    quality = build_quality_report(cards)
    index = build_search_index(cards, quality)
    result = search_index(index, "image background", limit=5)
    assert result["results"][0]["capability_id"] == "axm.image.background.replace"
    assert result["results"][0]["reasons"]
    filtered = search_index(index, "image", filters={"risk_level": "low"})
    assert all(item["risk_level"] == "low" for item in filtered["results"])
    assert validate_search_index(index) == []


def test_related_capabilities_uses_explicit_and_shared_features():
    first = card("file_rename")
    second = card("image_background_replace")
    third = card("data_analysis")
    first["relationships"]["related_capability_ids"] = [second["capability_id"]]
    index = build_search_index([first, second, third])
    result = related_capabilities(index, first["capability_id"])
    assert result["results"][0]["capability_id"] == second["capability_id"]
    assert any("explicit" in reason for reason in result["results"][0]["reasons"])


def test_learning_path_orders_dependencies_before_target():
    base = card("file_rename")
    middle = card("data_analysis")
    target = card("software_build")
    middle["relationships"]["dependency_capability_ids"] = [base["capability_id"]]
    target["learning_profile"]["prerequisite_capability_ids"] = [middle["capability_id"]]
    plan = build_learning_path([target, middle, base], target["capability_id"])
    assert [step["capability_id"] for step in plan["steps"]] == [base["capability_id"], middle["capability_id"], target["capability_id"]]
    assert plan["status"] == "ready"
    assert validate_learning_path(plan) == []


def test_learning_path_reports_missing_and_cycles():
    a = card("file_rename")
    b = card("data_analysis")
    a["relationships"]["dependency_capability_ids"] = [b["capability_id"], "axm.missing"]
    b["relationships"]["dependency_capability_ids"] = [a["capability_id"]]
    plan = build_learning_path([a, b], a["capability_id"])
    assert plan["status"] == "blocked_by_cycle"
    assert plan["cycles"]
    assert plan["missing_dependencies"]


def test_review_ledger_is_append_only_and_tamper_evident(tmp_path):
    ledger = tmp_path / "reviews.jsonl"
    first = append_event(
        ledger,
        capability_id="axm.file.rename",
        event_type="correction_proposed",
        actor="Mike",
        reason="Clarify the extension warning.",
        field="/learning_profile/common_mistakes",
        proposed_value=["Do not remove the extension accidentally."],
    )
    second = append_event(
        ledger,
        capability_id="axm.file.rename",
        event_type="dissent",
        actor="Axiom/Mir",
        reason="Keep the original wording available for comparison.",
    )
    verified = verify_ledger(ledger)
    assert verified["valid"] is True
    assert verified["event_count"] == 2
    assert second["previous_hash"] == first["event_hash"]

    lines = ledger.read_text(encoding="utf-8").splitlines()
    tampered = json.loads(lines[0])
    tampered["reason"] = "silently changed"
    lines[0] = json.dumps(tampered)
    ledger.write_text("\n".join(lines) + "\n", encoding="utf-8")
    broken = verify_ledger(ledger)
    assert broken["valid"] is False
    assert broken["errors"]
