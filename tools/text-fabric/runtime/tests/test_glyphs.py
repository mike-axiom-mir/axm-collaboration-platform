from axm_text_fabric.engine import TextFabricEngine
from axm_text_fabric.glyphs import audit_text


def run():
    audit = audit_text("AXM مرحبا 世界")
    assert "Latin" in audit["significant_scripts"]
    assert "Arabic" in audit["significant_scripts"]
    assert "Han" in audit["significant_scripts"]
    assert audit["direction"] == "mixed"
    assert audit["fallback_requirements"]

    dangerous = audit_text("safe\u202Etext\uFFFD")
    codes = {w["code"] for w in dangerous["warnings"]}
    assert "BIDI_CONTROL" in codes
    assert "REPLACEMENT_CHARACTER" in codes
    assert dangerous["risk"] == "high"

    engine = TextFabricEngine()
    plan = engine.resolve({
        "text": "AXM مرحبا",
        "role": "display",
        "recipe": "readable_glitch",
        "platform": "web",
        "background": "dynamic",
    })
    assert plan["resolved"]["glyph_audit"]["direction"] == "mixed"
    assert plan["resolved"]["effects"]["glitch"]["jitter_px"] == 0
    assert plan["adapter"]["fallback_requirements"]
