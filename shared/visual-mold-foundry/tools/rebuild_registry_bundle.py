#!/usr/bin/env python3
from __future__ import annotations
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MOLD_DIR = ROOT / 'registry' / 'molds'


def read(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def deep_merge(base, patch):
    out = copy.deepcopy(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = deep_merge(out[key], value)
        else:
            out[key] = copy.deepcopy(value)
    return out


def build_molds():
    source_files = [p for p in sorted(MOLD_DIR.glob('*.json')) if p.name != 'index.json']
    sources = {read(p)['id']: (p, read(p)) for p in source_files}
    cache = {}
    visiting = set()

    def resolve(mold_id):
        if mold_id in cache:
            return copy.deepcopy(cache[mold_id])
        if mold_id in visiting:
            raise ValueError(f'Lineage cycle detected at {mold_id}')
        if mold_id not in sources:
            raise ValueError(f'Missing mold source {mold_id}')
        visiting.add(mold_id)
        path, src = sources[mold_id]
        if src.get('schema') == 'axm.visual-mold-child/0.2':
            parent_id = src.get('parent')
            parent = resolve(parent_id)
            resolved = copy.deepcopy(parent)
            for key in ['id','name','version','category','description','lineage','provenance','preview']:
                if key in src:
                    resolved[key] = copy.deepcopy(src[key])
            resolved = deep_merge(resolved, src.get('sparse_overrides', {}))
            resolved['schema'] = 'axm.visual-mold/0.2'
            resolved['source_kind'] = 'derived'
            resolved['source_manifest'] = str(path.relative_to(ROOT)).replace('\\','/')
            resolved['inherited_from'] = parent_id
            resolved['composition_level'] = max(3, int(resolved.get('composition_level', 3)))
            resolved['lineage']['parent'] = parent_id
        else:
            resolved = copy.deepcopy(src)
            resolved['source_kind'] = 'root'
            resolved['source_manifest'] = str(path.relative_to(ROOT)).replace('\\','/')
            resolved['inherited_from'] = None
        visiting.remove(mold_id)
        cache[mold_id] = copy.deepcopy(resolved)
        return resolved

    molds = [resolve(mid) for mid in sources]
    molds.sort(key=lambda m: (0 if m['source_kind']=='root' else 1, m['category'], m['name']))
    return molds, [str(p.relative_to(ROOT)).replace('\\','/') for p in source_files]


def main():
    molds, source_files = build_molds()
    index = {
        'schema':'axm.mold-index/0.2',
        'version':'0.2.0',
        'resolution':'root manifests plus sparse child manifests resolved at build time',
        'source_files':source_files,
        'molds':molds,
    }
    (MOLD_DIR/'index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    adapters={p.stem:read(p) for p in sorted((ROOT/'registry/adapters').glob('*.json'))}
    bundle={
        'tokens':read(ROOT/'registry/tokens/tokens.json')['tokens'],
        'organs':read(ROOT/'registry/organs/organs.json')['organs'],
        'molds':molds,
        'moldSources':source_files,
        'presets':read(ROOT/'registry/presets/starter-presets.json')['presets'],
        'themes':read(ROOT/'registry/themes/themes.json')['themes'],
        'adapters':adapters,
        'schema':read(ROOT/'validation/mold-schema.json'),
        'build':{'version':'0.6.0','local_first':True,'telemetry':False,'extension_registry':'separate-local-storage'}
    }
    out=ROOT/'app/js/registry.bundle.js'
    out.write_text('window.AXM_REGISTRY = '+json.dumps(bundle,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    print(f'Wrote {MOLD_DIR/"index.json"}')
    print(f'Wrote {out}')
    print(f'Resolved {len(molds)} molds from {len(source_files)} source manifests')

if __name__=='__main__':
    main()
