from pathlib import Path
from tempfile import TemporaryDirectory
import shutil
import xml.etree.ElementTree as ET

from axm_text_fabric import static_assets
from axm_text_fabric.engine import TextFabricEngine
from axm_text_fabric.static_assets import (
    find_svg_renderer,
    png_dimensions,
    render_svg_to_png,
    write_portable_bundle,
    write_svg,
)


def run():
    engine = TextFabricEngine()
    plan = engine.resolve_preset(
        "readable_glitch_alert",
        {"platform": "web", "quality_tier": "balanced", "text": "SYSTEM READY"},
    )
    with TemporaryDirectory() as tmp:
        root = Path(tmp)
        svg = write_svg(plan, root / "system_ready.svg", 1000, 300)
        parsed = ET.fromstring(svg.read_text(encoding="utf-8"))
        assert parsed.tag.endswith("svg")
        text = svg.read_text(encoding="utf-8")
        assert "SYSTEM READY" in text
        assert "axmFill" in text
        assert "axmScanlines" in text
        portable = write_portable_bundle(root / "bundle", plan, "readable_glitch")
        assert (portable / "asset_manifest.json").exists()
        assert list(portable.glob("*.svg"))
        renderer = find_svg_renderer()
        if renderer:
            result = render_svg_to_png(svg, root / "system_ready.png", width=1000, renderer=renderer)
            assert Path(result["png"]).exists()
            assert png_dimensions(result["png"]) == (1000, 300)

    original_which = static_assets.shutil.which
    original_run = static_assets.subprocess.run
    try:
        static_assets.shutil.which = lambda name: "convert.exe" if name == "convert" else None
        static_assets.subprocess.run = lambda *args, **kwargs: type(
            "Result", (), {"returncode": 1, "stdout": "", "stderr": "Invalid Parameter"}
        )()
        assert find_svg_renderer() is None
    finally:
        static_assets.shutil.which = original_which
        static_assets.subprocess.run = original_run
