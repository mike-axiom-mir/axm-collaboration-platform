from __future__ import annotations
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
errors = []
folders = sorted((root / 'modules').glob('[0-9][0-9][0-9]_*'))
if len(folders) != 100:
    errors.append(f'Expected 100 module folders, found {len(folders)}')
ids, numbers = set(), set()
prototype_numbers, shadow_numbers = [], []
for folder in folders:
    path = folder / 'module.json'
    if not path.exists():
        errors.append(f'Missing manifest: {folder.name}')
        continue
    try:
        manifest = json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:
        errors.append(f'Invalid JSON {path}: {exc}')
        continue
    num, module_id = manifest.get('number'), manifest.get('id')
    if num in numbers: errors.append(f'Duplicate number: {num}')
    if module_id in ids: errors.append(f'Duplicate id: {module_id}')
    numbers.add(num); ids.add(module_id)
    if manifest.get('default_enabled') is not False:
        errors.append(f'Default enabled is not false: {folder.name}')
    impl = manifest.get('implementation', {})
    if impl.get('network_access') is not False or impl.get('native_writes') is not False:
        errors.append(f'Detached safety boundary violated: {folder.name}')
    if impl.get('state') == 'prototype':
        prototype_numbers.append(num)
        if not (folder / 'implementation.py').exists():
            errors.append(f'Prototype missing implementation: {folder.name}')
    elif (folder / 'implementation.py').exists():
        errors.append(f'Contract-only module has implementation: {folder.name}')
    if manifest.get('authority_mode') == 'shadow_only':
        shadow_numbers.append(num)
if numbers != set(range(1, 101)):
    errors.append('Module numbering is not exactly 1..100')
summary = json.loads((root / 'MODULE_STATUS_SUMMARY.json').read_text(encoding='utf-8'))
if sorted(prototype_numbers) != summary.get('prototype_numbers'):
    errors.append('Prototype list differs from MODULE_STATUS_SUMMARY.json')
if sorted(shadow_numbers) != summary.get('shadow_only_numbers'):
    errors.append('Shadow-only list differs from MODULE_STATUS_SUMMARY.json')
if summary.get('local_prototypes') != len(prototype_numbers):
    errors.append('Prototype count differs from status summary')
index = json.loads((root / 'module_index.json').read_text(encoding='utf-8'))
if len(index) != 100:
    errors.append('module_index.json must contain 100 entries')
if errors:
    print('GARDEN VALIDATION: FAIL')
    for error in errors: print('-', error)
    sys.exit(1)
print('GARDEN VALIDATION: PASS')
print(f'Modules: {len(folders)} | Prototypes: {len(prototype_numbers)} | Contract-only: {len(folders)-len(prototype_numbers)}')
