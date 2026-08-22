from __future__ import annotations
import argparse
import json
import shutil
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def export(number: int, output: Path) -> Path:
    matches = list((ROOT / 'modules').glob(f'{number:03d}_*'))
    if len(matches) != 1:
        raise FileNotFoundError(f'expected one module {number:03d}')
    module = matches[0]
    manifest = json.loads((module / 'module.json').read_text(encoding='utf-8'))
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / f"AXM_SELECTIVE_{number:03d}_{manifest['slug']}"
        shutil.copytree(module, root / 'module')
        shutil.copytree(ROOT / 'shared' / 'axm_translation_core', root / 'shared' / 'axm_translation_core', ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
        shutil.copytree(ROOT / 'contracts', root / 'contracts')
        (root / 'INTAKE_README.md').write_text(
            f"# Selective intake pack: {manifest['name']}\n\nPreserve ID `{manifest['id']}`. Read `module/module.json`. Keep default disabled. This pack grants no AXM authority and requires Merge Gate review.\n",
            encoding='utf-8',
        )
        output.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zf:
            for path in sorted(root.rglob('*')):
                if path.is_file():
                    zf.write(path, path.relative_to(root.parent))
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('number', type=int)
    parser.add_argument('output', type=Path, nargs='?')
    args = parser.parse_args()
    target = args.output or ROOT / 'selective_packs' / f'AXM_MODULE_{args.number:03d}.zip'
    print(export(args.number, target))
