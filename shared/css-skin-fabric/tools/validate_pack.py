#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []
warnings: list[str] = []

json_files = [
    'PACK_INFO.json', 'registry/organs.json', 'registry/components.json', 'registry/materials.json',
    'registry/themes.json', 'registry/layouts.json', 'registry/important-exceptions.json', 'registry/governance.json',
    'contracts/material-recipe.schema.json', 'contracts/mold-request.schema.json', 'contracts/visual-change.schema.json',
    'examples/mold-request.json', 'examples/token-overrides.json', 'examples/visual-change.json'
]
for rel in json_files:
    try:
        json.loads((ROOT / rel).read_text(encoding='utf-8'))
    except Exception as exc:
        errors.append(f'Invalid JSON: {rel}: {exc}')

css_files = sorted((ROOT / 'src').rglob('*.css'))
component_files = sorted((ROOT / 'src/css/components').glob('*.css'))

banned = {
    r'transition\s*:\s*all\b': 'transition: all is banned',
    r'#[A-Za-z_][\w-]*\s*[{,]': 'ID selectors are banned in component CSS',
}
for path in component_files:
    text = path.read_text(encoding='utf-8')
    for pattern, message in banned.items():
        if re.search(pattern, text, re.I):
            errors.append(f'{path.relative_to(ROOT)}: {message}')
    if '!important' in text:
        errors.append(f'{path.relative_to(ROOT)}: unapproved !important')
    if re.findall(r'(?<![\w-])#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(|oklch\(', text):
        errors.append(f'{path.relative_to(ROOT)}: raw color found; use semantic tokens')
    for match in re.finditer(r'z-index\s*:\s*([^;]+)', text):
        if not match.group(1).strip().startswith('var('):
            errors.append(f'{path.relative_to(ROOT)}: raw z-index found')

exception_data = json.loads((ROOT / 'registry/important-exceptions.json').read_text(encoding='utf-8'))
expected_important = {item['path']: item['expected_count'] for item in exception_data['files']}
actual_important = {}
for path in css_files:
    count = path.read_text(encoding='utf-8').count('!important')
    if count:
        # Registry paths are portable POSIX-style paths. Normalise the native
        # Windows separator before comparing so the packaged validator works
        # on the platform its Windows launcher targets.
        actual_important[path.relative_to(ROOT).as_posix()] = count
if actual_important != expected_important:
    errors.append(f'!important registry mismatch: expected {expected_important}, found {actual_important}')

index_css = (ROOT / 'src/css/index.css').read_text(encoding='utf-8')
required_layers = ['reset', 'vendor', 'legacy', 'tokens', 'foundation', 'layout', 'components', 'effects', 'states', 'utilities', 'overrides']
for layer in required_layers:
    if layer not in index_css:
        errors.append(f'Missing cascade layer: {layer}')

for import_path in re.findall(r'@import\s+url\(["\']([^"\']+)["\']\)', index_css):
    target = (ROOT / 'src/css' / import_path).resolve()
    if not target.exists():
        errors.append(f'Missing CSS import target: {import_path}')

definitions: set[str] = set()
references: set[str] = set()
for path in css_files:
    text = path.read_text(encoding='utf-8')
    definitions.update(re.findall(r'(--axm-[\w-]+)\s*:', text))
    references.update(re.findall(r'var\((--axm-[\w-]+)', text))
for token in sorted(references - definitions):
    errors.append(f'Unknown token reference: {token}')

all_css = '\n'.join(path.read_text(encoding='utf-8') for path in css_files)
for registry, key in [('registry/materials.json', 'recipes'), ('registry/layouts.json', 'layouts'), ('registry/components.json', 'components')]:
    for item in json.loads((ROOT / registry).read_text(encoding='utf-8'))[key]:
        if f'.{item["class"]}' not in all_css:
            errors.append(f'Registered class missing from CSS: {item["class"]}')

html_text = (ROOT / 'index.html').read_text(encoding='utf-8')
ids = re.findall(r'\sid=["\']([^"\']+)["\']', html_text)
duplicates = sorted({item for item in ids if ids.count(item) > 1})
if duplicates:
    errors.append(f'Duplicate HTML IDs: {duplicates}')
if re.search(r'\sstyle\s*=', html_text, re.I):
    errors.append('index.html contains inline style attributes; gallery must model governed CSS')

for theme in json.loads((ROOT / 'registry/themes.json').read_text(encoding='utf-8'))['themes']:
    if f'value="{theme["id"]}"' not in html_text:
        errors.append(f'Theme missing from gallery control: {theme["id"]}')

for path in css_files:
    text = re.sub(r'/\*.*?\*/', '', path.read_text(encoding='utf-8'), flags=re.S)
    if text.count('{') != text.count('}'):
        errors.append(f'Unbalanced CSS braces: {path.relative_to(ROOT)}')

for path in sorted((ROOT / 'tools').glob('*.py')):
    try:
        compile(path.read_text(encoding='utf-8'), str(path), 'exec')
    except SyntaxError as exc:
        errors.append(f'Python syntax error: {path.relative_to(ROOT)}: {exc}')

try:
    result = subprocess.run(['node', '--check', str(ROOT / 'app.js')], capture_output=True, text=True, timeout=20)
    if result.returncode != 0:
        errors.append(f'JavaScript syntax error: {result.stderr.strip()}')
except (FileNotFoundError, subprocess.TimeoutExpired):
    warnings.append('Node.js unavailable; JavaScript syntax check skipped.')

try:
    import tinycss2
    for path in css_files:
        parsed = tinycss2.parse_stylesheet(path.read_text(encoding='utf-8'), skip_comments=True, skip_whitespace=True)
        parse_errors = [item for item in parsed if item.type == 'error']
        if parse_errors:
            errors.append(f'CSS parse errors in {path.relative_to(ROOT)}: {parse_errors}')
except ImportError:
    warnings.append('tinycss2 unavailable; deep CSS parser check skipped.')

print('AXM CSS Skin Fabric validation v0.2')
print(f'CSS files: {len(css_files)}')
print(f'Tokens defined: {len(definitions)}')
print(f'Tokens referenced: {len(references)}')
print(f'Registered components: {len(json.loads((ROOT / "registry/components.json").read_text())["components"])}')
print(f'Registered materials: {len(json.loads((ROOT / "registry/materials.json").read_text())["recipes"])}')
if warnings:
    print('\nWarnings:')
    for item in warnings:
        print(f'  - {item}')
if errors:
    print('\nFAIL:')
    for item in errors:
        print(f'  - {item}')
    sys.exit(1)
print('\nPASS: registries, governance, HTML, CSS contracts, scripts and token references are internally consistent.')
