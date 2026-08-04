from axm_text_fabric.catalog import presets, recipes, roles
from axm_text_fabric.engine import TextFabricEngine


def run():
    items = presets()
    assert len(items) >= 24
    ids = [p["id"] for p in items]
    assert len(ids) == len(set(ids))
    known_recipes = recipes()
    known_roles = roles()
    for preset in items:
        assert preset["recipe"] in known_recipes, preset["id"]
        assert preset["role"] in known_roles, preset["id"]
        assert preset["category"]
        assert 0 <= preset["glitch"] <= 1.5
    engine = TextFabricEngine()
    plan = engine.resolve_preset("axm_future_core")
    assert plan["preset_id"] == "axm_future_core"
    assert plan["resolved"]["recipe"] == "readable_glitch"
    assert plan["resolved"]["preset_tuning"]["glitch"] > 0
    gold = engine.resolve_preset("golden_victory", {"platform":"unity"})
    assert gold["adapter"]["kind"] == "unity_textmeshpro"
