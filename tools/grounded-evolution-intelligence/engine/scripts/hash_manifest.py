#!/usr/bin/env python3
import hashlib
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
manifest=BASE/'generated/MANIFEST.sha256'
rows=[]
for p in sorted(BASE.rglob('*')):
    if p.is_file() and p != manifest and p.name != 'MANIFEST.sha256':
        rel=p.relative_to(BASE).as_posix()
        rows.append(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {rel}')
manifest.write_text('\n'.join(rows)+'\n',encoding='utf-8')
print(f'Wrote {len(rows)} hashes to {manifest}')
