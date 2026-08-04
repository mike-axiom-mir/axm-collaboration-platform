from pathlib import Path
from tempfile import TemporaryDirectory

from axm_text_fabric.compiler import compile_library_bundle, verify_bundle
from axm_text_fabric.engine import TextFabricEngine


def run():
    engine = TextFabricEngine()
    with TemporaryDirectory() as tmp:
        root = compile_library_bundle(
            engine,
            Path(tmp) / "library",
            ["web"],
            "low",
            target_ids=["axm_future_core", "golden_victory"],
        )
        assert (root / "library_manifest.json").exists()
        assert (root / "index.html").exists()
        assert (root / "presets" / "axm_future_core" / "web" / "index.html").exists()
        valid = verify_bundle(root)
        assert valid["valid"], valid
        nested = root / "presets" / "axm_future_core" / "bundle_manifest.json"
        nested.write_text(nested.read_text(encoding="utf-8") + "\n", encoding="utf-8")
        invalid = verify_bundle(root)
        assert not invalid["valid"]
        assert "presets/axm_future_core/bundle_manifest.json" in invalid["modified"]
