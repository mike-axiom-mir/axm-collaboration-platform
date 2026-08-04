from pathlib import Path
from tempfile import TemporaryDirectory

from axm_text_fabric.engine import TextFabricEngine
from axm_text_fabric.layout import build_layout_qa_matrix, pseudo_localize


def run():
    source = "Hello {name}, score %s <b>ready</b>"
    accented = pseudo_localize(source, "accented")
    expanded = pseudo_localize(source, "expanded")
    rtl = pseudo_localize(source, "rtl")
    assert "{name}" in accented and "%s" in accented and "<b>" in accented
    assert len(expanded) > len(source)
    assert rtl != source

    engine = TextFabricEngine()
    plan = engine.resolve({
        "text": "MISSION COMPLETE CONTINUE TO THE NEXT OBJECTIVE",
        "role": "game_hud",
        "platform": "game_tv",
        "container_width_px": 260,
        "max_lines": 1,
        "layout_policy": "warn",
    })
    audit = plan["resolved"]["layout_audit"]
    assert audit["status"] in {"warning", "critical"}
    assert audit["scenarios"]["expanded"]["overflow_risk"] is True
    assert any(w["code"] in {"LAYOUT_OVERFLOW_RISK", "PSEUDOLOCALIZATION_OVERFLOW"} for w in plan["warnings"])

    failed = False
    try:
        engine.resolve({
            "text": "MISSION COMPLETE CONTINUE TO THE NEXT OBJECTIVE",
            "role": "game_hud",
            "platform": "game_tv",
            "container_width_px": 220,
            "max_lines": 1,
            "layout_policy": "strict",
        })
    except ValueError:
        failed = True
    assert failed

    with TemporaryDirectory() as tmp:
        root = build_layout_qa_matrix(engine, ["axm_future_core"], Path(tmp) / "qa", [320], ["original", "expanded"], False)
        assert (root / "layout_qa_manifest.json").exists()
        assert (root / "index.html").exists()
