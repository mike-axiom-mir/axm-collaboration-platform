from pathlib import Path
from tempfile import TemporaryDirectory
import json

from axm_text_fabric.engine import TextFabricEngine
from axm_text_fabric.static_assets import build_visual_qa_matrix


def run():
    engine = TextFabricEngine()
    with TemporaryDirectory() as tmp:
        root = build_visual_qa_matrix(
            engine,
            ["readable_glitch", "molten_gold"],
            Path(tmp) / "qa",
            ["low", "high"],
            800,
            240,
            False,
        )
        manifest = json.loads((root / "qa_manifest.json").read_text(encoding="utf-8"))
        assert manifest["asset_count"] == 4
        assert manifest["target_count"] == 2
        assert not manifest["png_rendered"]
        assert len(list((root / "assets").glob("*.svg"))) == 4
        assert (root / "index.html").exists()
