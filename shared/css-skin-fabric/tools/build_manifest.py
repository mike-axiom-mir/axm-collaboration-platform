#!/usr/bin/env python3
from pathlib import Path
import hashlib, json, datetime
ROOT = Path(__file__).resolve().parents[1]
items = []
for path in sorted(ROOT.rglob('*')):
    if not path.is_file() or path.name == 'FILE_MANIFEST.json':
        continue
    data = path.read_bytes()
    items.append({'path': str(path.relative_to(ROOT)), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
manifest = {'generated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'file_count': len(items), 'files': items}
(ROOT/'FILE_MANIFEST.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(f'Wrote manifest for {len(items)} files.')
