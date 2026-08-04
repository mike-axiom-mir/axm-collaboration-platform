from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def run():
    required = [
        ROOT / 'docs' / 'SHADER_MATERIAL_PACK.md',
        ROOT / 'adapters' / 'unity' / 'AXMTextFxProfile.cs',
        ROOT / 'adapters' / 'unity' / 'AXMTextFxApplier.cs',
        ROOT / 'adapters' / 'unity' / 'AXM_TMP_SHADER_NOTES.md',
        ROOT / 'adapters' / 'unreal' / 'AXMTextMaterialStyle.h',
        ROOT / 'adapters' / 'unreal' / 'AXM_UMG_MATERIAL_NOTES.md',
        ROOT / 'adapters' / 'godot' / 'axm_text_fx.gdshader',
        ROOT / 'adapters' / 'godot' / 'AXMTextFxResource.gd',
    ]
    missing = [str(p.relative_to(ROOT)) for p in required if not p.exists()]
    assert not missing, missing
