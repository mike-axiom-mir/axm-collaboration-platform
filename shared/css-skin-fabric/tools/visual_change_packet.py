#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import datetime
import hashlib
import html
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
TOKEN_RE = re.compile(r'(?P<name>--axm-[\w-]+)\s*:\s*(?P<value>[^;]+);')


def fail(message: str):
    print(f'ERROR: {message}', file=sys.stderr)
    raise SystemExit(2)


def read_tokens():
    result = {}
    for path in sorted((ROOT / 'src/tokens').glob('*.css')):
        for match in TOKEN_RE.finditer(path.read_text(encoding='utf-8')):
            result.setdefault(match.group('name'), {
                'value': ' '.join(match.group('value').split()),
                'source': str(path.relative_to(ROOT)),
            })
    return result


def safe_value(name: str, value: object):
    if not isinstance(value, str) or not (1 <= len(value) <= 120):
        fail(f'Unsafe token value length for {name}')
    lowered = value.lower()
    banned = ('url(', '@import', 'expression(', '<', '>', '{', '}', ';', '\n', '\r', '/*', '*/')
    if any(item in lowered for item in banned):
        fail(f'Unsafe token value for {name}')


def main():
    request_path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'examples/visual-change.json'
    request = json.loads(request_path.read_text(encoding='utf-8'))
    required = {'name', 'purpose', 'author', 'source', 'overrides', 'rollback_pointer'}
    if set(request) != required:
        fail(f'Fields must be exactly: {sorted(required)}')
    if not re.fullmatch(r'[a-z][a-z0-9-]{2,48}', request['name']):
        fail('name must be kebab-case, 3–49 characters')
    for field, minimum, maximum in [('purpose', 10, 240), ('author', 2, 80), ('source', 2, 120), ('rollback_pointer', 3, 160)]:
        if not isinstance(request[field], str) or not (minimum <= len(request[field]) <= maximum):
            fail(f'{field} must be {minimum}–{maximum} characters')
    if not isinstance(request['overrides'], dict) or not request['overrides']:
        fail('overrides must be a non-empty object')

    governance = json.loads((ROOT / 'registry/governance.json').read_text(encoding='utf-8'))
    allowlist = set(governance['public_tuning_allowlist'])
    known = read_tokens()
    changes = []
    for name, value in sorted(request['overrides'].items()):
        if name not in known:
            fail(f'Unknown token: {name}')
        if name not in allowlist:
            fail(f'Token is not public-tuning allowlisted: {name}')
        safe_value(name, value)
        changes.append({'token': name, 'before': known[name]['value'], 'after': value, 'source': known[name]['source']})

    canonical = json.dumps(request, sort_keys=True, separators=(',', ':'))
    fingerprint = hashlib.sha256(canonical.encode()).hexdigest()[:16]
    candidate_id = f'change-{request["name"]}-{fingerprint}'
    out = ROOT / 'candidates' / candidate_id
    if out.exists():
        fail(f'Duplicate change packet already exists: {out.relative_to(ROOT)}')
    out.mkdir(parents=True)
    generated = datetime.datetime.now(datetime.timezone.utc).isoformat()

    css_lines = ['/* TEST-HOLD-REVIEW — visual change packet; canonical source unchanged */', f'[data-token-candidate="{request["name"]}"] {{']
    css_lines.extend(f'  {item["token"]}: {item["after"]};' for item in changes)
    css_lines.append('}')
    (out / 'candidate.css').write_text('\n'.join(css_lines) + '\n', encoding='utf-8')

    manifest = {
        'schema_version': '1.0',
        'candidate_id': candidate_id,
        'fingerprint': fingerprint,
        'status': 'TEST-HOLD-REVIEW',
        'generated_at': generated,
        'request': request,
        'changes': changes,
        'qa': {'responsive': 'PENDING', 'contrast': 'PENDING', 'keyboard': 'PENDING', 'motion': 'PENDING', 'performance': 'PENDING', 'visual_baseline': 'PENDING'},
        'decision': 'PENDING_HUMAN_REVIEW',
        'canonical_write': False,
    }
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')

    rows = '\n'.join(f'| `{item["token"]}` | `{item["before"]}` | `{item["after"]}` | `{item["source"]}` |' for item in changes)
    review = f'''# Visual Change Review Packet

Status: **TEST-HOLD-REVIEW**  
Candidate: `{candidate_id}`  
Fingerprint: `{fingerprint}`  
Generated: {generated}

## Purpose

{request['purpose']}

## Source and authorship

- Author: {request['author']}
- Source: {request['source']}
- Rollback pointer: `{request['rollback_pointer']}`

## Token changes

| Token | Before | After | Canonical source |
|---|---|---|---|
{rows}

## Required evidence

- [ ] Before screenshot
- [ ] After screenshot
- [ ] Phone and narrow-container check
- [ ] Keyboard and focus check
- [ ] Semantic contrast check
- [ ] Reduced-motion and reduced-transparency check
- [ ] Minimal-effects performance check
- [ ] Human decision recorded

## Boundary

This packet changed no canonical file and cannot promote itself.
'''
    (out / 'REVIEW_PACKET.md').write_text(review, encoding='utf-8')

    specimen = f'''<!doctype html><html lang="en" data-theme="aetherglass" data-density="comfortable" data-effects="balanced" data-motion="full" data-token-candidate="{html.escape(request['name'])}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(request['name'])}</title><link rel="stylesheet" href="../../src/css/index.css"><link rel="stylesheet" href="candidate.css"></head><body><main class="axm-shell axm-cover"><section class="axm-panel axm-material axm-material--aetherglass"><span class="axm-card__eyebrow">TEST-HOLD-REVIEW</span><h1>{html.escape(request['name'].replace('-', ' ').title())}</h1><p>{html.escape(request['purpose'])}</p><div class="axm-cluster"><span class="axm-badge axm-badge--warning">{len(changes)} token changes</span><span class="axm-badge axm-badge--info">Rollback recorded</span></div><button class="axm-button axm-button--primary">Candidate action</button></section></main></body></html>'''
    (out / 'specimen.html').write_text(specimen, encoding='utf-8')
    print(f'Created {out.relative_to(ROOT)}')
    print('Canonical files remain unchanged.')


if __name__ == '__main__':
    main()
