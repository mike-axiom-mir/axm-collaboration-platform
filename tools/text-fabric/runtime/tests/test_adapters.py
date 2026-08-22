from axm_text_fabric.engine import TextFabricEngine


def run():
    engine = TextFabricEngine()
    web = engine.resolve({
        "text":"Glass", "role":"h1", "recipe":"luxury_glass", "platform":"web",
        "background":"dynamic", "quality_tier":"balanced",
        "preset_tuning":{"glow":.5, "plate":.5, "sheen":.5, "glitch":0}
    })
    variables = web["adapter"]["variables"]
    assert variables["--axm-plate-color"].endswith("0.2600)")
    assert "rgba(" in variables["--axm-text-shadow"]
    assert variables["--axm-quality-tier"] == "balanced"
    unity = engine.resolve({"text":"FX", "role":"display", "recipe":"neon_metal", "platform":"unity", "quality_tier":"low"})
    assert unity["adapter"]["quality_tier"] == "low"
    assert unity["adapter"]["render_budget"]["quality_tier"] == "low"
