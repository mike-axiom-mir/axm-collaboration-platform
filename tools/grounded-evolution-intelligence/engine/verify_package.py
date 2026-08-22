#!/usr/bin/env python3
from __future__ import annotations
import hashlib, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parent
MANIFEST=ROOT/'generated/MANIFEST.sha256'

def sha256(path:Path)->str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()

def main()->int:
    if not MANIFEST.exists():
        print('FAIL: generated/MANIFEST.sha256 missing');return 2
    expected={}
    for raw in MANIFEST.read_text(encoding='utf-8').splitlines():
        if not raw.strip():continue
        digest,rel=raw.split('  ',1);expected[rel]=digest
    errors=[]
    for rel,digest in expected.items():
        p=ROOT/rel
        if not p.is_file():errors.append(f'missing: {rel}')
        elif sha256(p)!=digest:errors.append(f'hash mismatch: {rel}')
    actual={p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*') if p.is_file() and p!=MANIFEST and '__pycache__' not in p.parts and p.suffix!='.pyc'}
    extras=sorted(actual-set(expected));missing_index=sorted(set(expected)-actual)
    errors += [f'unindexed extra: {x}' for x in extras]
    errors += [f'indexed but absent: {x}' for x in missing_index]
    if errors:
        print('FAIL')
        for e in errors:print('-',e)
        return 2
    print(f'PASS: {len(expected)} indexed files verified')
    return 0

if __name__=='__main__':raise SystemExit(main())
