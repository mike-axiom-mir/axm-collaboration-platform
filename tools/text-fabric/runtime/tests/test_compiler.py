from pathlib import Path
from tempfile import TemporaryDirectory
import json
from axm_text_fabric.engine import TextFabricEngine
from axm_text_fabric.compiler import compile_preset_bundle


def run():
    engine = TextFabricEngine()
    with TemporaryDirectory() as tmp:
        root = compile_preset_bundle(engine, 'axm_future_core', Path(tmp) / 'bundle', ['web','unity'], 'low')
        assert (root / 'bundle_manifest.json').exists()
        assert (root / 'web' / 'axm-text-compiled.css').exists()
        assert (root / 'unity' / 'material_parameters.json').exists()
        assert list((root / 'portable').glob('*.svg'))
        assert (root / 'portable' / 'asset_manifest.json').exists()
        assert (root / 'layout_audit.json').exists()
        assert (root / 'pseudolocale_samples.json').exists()
        manifest = json.loads((root / 'bundle_manifest.json').read_text(encoding='utf-8'))
        assert manifest['quality_tier'] == 'low'
        assert manifest['files']
