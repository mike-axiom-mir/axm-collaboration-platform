from pathlib import Path
from tempfile import TemporaryDirectory

from axm_text_fabric.compiler import compile_target_bundle, verify_bundle
from axm_text_fabric.engine import TextFabricEngine


def run():
    engine = TextFabricEngine()
    with TemporaryDirectory() as tmp:
        root = compile_target_bundle(
            engine,
            "readable_glitch",
            Path(tmp) / "bundle",
            ["web", "unity", "unreal", "godot"],
            "balanced",
        )
        assert (root / "source_snapshot" / "recipe.json").exists()
        assert (root / "AXM_TEXT_LOCK.json").exists()
        assert (root / "web" / "axm-text-runtime.css").exists()
        assert list((root / "unity" / "Assets" / "AXMTextFabric" / "Scripts").glob("*AXMTextPreset.cs"))
        assert list((root / "unreal" / "Source" / "AXMTextFabric" / "Public").glob("FAXM*Preset.h"))
        assert list((root / "godot" / "addons" / "axm_text_fabric").glob("apply_*.gd"))
        valid = verify_bundle(root)
        assert valid["valid"], valid
        css = root / "web" / "axm-text-compiled.css"
        css.write_text(css.read_text(encoding="utf-8") + "/* tamper */\n", encoding="utf-8")
        invalid = verify_bundle(root)
        assert not invalid["valid"]
        assert "web/axm-text-compiled.css" in invalid["modified"]
