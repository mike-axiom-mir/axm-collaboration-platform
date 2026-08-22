from axm_text_fabric.engine import TextFabricEngine

def run():
    e = TextFabricEngine()
    plan = e.resolve({"text":"Low contrast sample","role":"body","platform":"web","foreground_color":"#777777","background_color":"#777777","accessibility":"strict"})
    assert plan["resolved"]["contrast"]["passes"] is False
    assert any(w["code"] == "LOW_CONTRAST" for w in plan["warnings"])
    assert plan["resolved"]["effects"]["plate"]["enabled"] is True
