from __future__ import annotations
import json,sys
from pathlib import Path
from authority_audit_lib import scan_root
root=Path(__file__).resolve().parents[1]
actual=scan_root(root); expected=json.loads((root/'AUTHORITY_AUDIT.json').read_text(encoding='utf-8'))
errors=[]
if actual!=expected: errors.append('stored audit differs from current source')
if actual['issues']: errors.append(f"authority issues: {len(actual['issues'])}")
if actual['shadow_implementations']: errors.append('shadow modules contain implementations')
if errors:
    print('AUTHORITY SURFACE AUDIT: FAIL'); [print('-',e) for e in errors]; sys.exit(1)
print('AUTHORITY SURFACE AUDIT: PASS')
print(f"Files scanned: {actual['files_scanned']} | Issues: 0 | Shadow implementations: 0")
