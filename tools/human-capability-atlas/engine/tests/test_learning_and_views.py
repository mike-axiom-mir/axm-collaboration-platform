from pathlib import Path
import json

from axm_capability_atlas.atlas import build_card
from axm_capability_atlas.learning import course_plan
from axm_capability_atlas.validators import validate_course
from axm_capability_atlas.views import quick_view, practical_view, deep_view

ROOT = Path(__file__).resolve().parents[1]


def card(name):
    p = ROOT / "fixtures" / "source" / f"{name}.json"
    return build_card(json.loads(p.read_text(encoding="utf-8")), p)


def test_course_validates():
    plan = course_plan(card("file_rename"))
    assert validate_course(plan) == []
    assert any(step["kind"] == "guided_use" for step in plan["steps"])


def test_unknown_course_adds_verification_step():
    plan = course_plan(card("incomplete_documentation"))
    assert any(step["kind"] == "verification" for step in plan["steps"])


def test_views_include_source_and_risk_information():
    c = card("destructive_delete")
    assert "high" in practical_view(c)
    assert c["capability_id"] in deep_view(c)
    assert c["identity"]["human_name"] in quick_view(c)
