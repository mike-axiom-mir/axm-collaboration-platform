from __future__ import annotations
import json, sys
from pathlib import Path
from assurance_lib import compute_entry
root=Path(__file__).resolve().parents[1]
expected=json.loads((root/'ASSURANCE_INDEX.json').read_text(encoding='utf-8'))
errors=[]; actual=[]
for folder in sorted((root/'modules').glob('[0-9][0-9][0-9]_*')):
    try: actual.append(compute_entry(folder))
    except Exception as exc: errors.append(f'{folder.name}: {exc}')
if len(actual)!=100: errors.append(f'expected 100 entries, got {len(actual)}')
by_num={e['number']:e for e in expected.get('entries',[])}
for entry in actual:
    prior=by_num.get(entry['number'])
    if prior!=entry: errors.append(f"assurance mismatch: {entry['number']:03d}")
if expected.get('source_sha256')!='b5c2a77acd863ded821735d4ecb43f499dbbe73c66457238888817b88fc86277': errors.append('source hash mismatch')
if errors:
    print('ASSURANCE VERIFICATION: FAIL'); [print('-',e) for e in errors]; sys.exit(1)
print('ASSURANCE VERIFICATION: PASS')
print(f"Indexed capsules: {len(actual)} | Prototypes: {sum(e['status']=='LOCAL_PROTOTYPE' for e in actual)}")
