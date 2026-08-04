#!/usr/bin/env python3
from __future__ import annotations
import hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'FILE_MANIFEST_SHA256.txt'
exclude={out.resolve()}
lines=['# AXM Visual Mold Foundry v0.9.1 SHA-256 manifest','# Format: SHA256 two-spaces relative/path']
for p in sorted(ROOT.rglob('*')):
    rel=p.relative_to(ROOT).as_posix()
    if p.is_symlink(): raise SystemExit(f'Refusing to manifest symlink: {rel}')
    if not p.is_file() or p.resolve() in exclude or '__pycache__' in p.parts or p.suffix=='.pyc': continue
    if (
        rel.startswith('exports/')
        or rel.startswith('foundry/approved/')
        or rel.startswith('foundry/candidate_molds/')
        or (rel.startswith('foundry/intake/') and not rel.startswith('foundry/intake/examples/'))
        or rel.startswith('lineage/change_logs/')
        or rel.startswith('lineage/rollback_snapshots/')
    ): continue
    digest=hashlib.sha256(p.read_bytes()).hexdigest();lines.append(f'{digest}  {rel}')
out.write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(f'Wrote {len(lines)-2} hashes')
