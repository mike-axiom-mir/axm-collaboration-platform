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
CANDIDATES = ROOT / 'candidates'


def fail(message: str):
    print(f'ERROR: {message}', file=sys.stderr)
    raise SystemExit(2)


def load(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def specimen_markup(component: str, title: str, purpose: str) -> str:
    templates = {
        'button': f'<button class="axm-button axm-button--primary">{title}</button>',
        'field': f'<label class="axm-field"><span class="axm-field__label">{title}</span><input class="axm-input" value="Candidate value"><span class="axm-field__hint">{purpose}</span></label>',
        'card': f'<article class="axm-card"><span class="axm-card__eyebrow">TEST-HOLD-REVIEW</span><h1 class="axm-card__title">{title}</h1><p class="axm-card__body">{purpose}</p><footer class="axm-card__footer"><span class="axm-badge axm-badge--warning">Candidate</span><button class="axm-button">Review</button></footer></article>',
        'panel': f'<section class="axm-panel"><header class="axm-panel__header"><div><span class="axm-card__eyebrow">TEST-HOLD-REVIEW</span><h1 class="axm-panel__title">{title}</h1></div><span class="axm-badge axm-badge--warning">Candidate</span></header><p class="axm-panel__subtitle">{purpose}</p></section>',
        'dialog': f'<dialog class="axm-dialog" open><section class="axm-panel"><header class="axm-panel__header"><h1 class="axm-panel__title">{title}</h1><button class="axm-button axm-button--quiet" aria-label="Close">×</button></header><p>{purpose}</p></section></dialog>',
        'tabs': f'<div class="axm-tabs" role="tablist" aria-label="{title}"><button class="axm-tab" role="tab" aria-selected="true">Foundation</button><button class="axm-tab" role="tab" aria-selected="false">Candidate</button></div>',
        'toolbar': f'<div class="axm-toolbar"><div class="axm-toolbar__group"><button class="axm-button axm-button--primary">{title}</button><button class="axm-button">Review</button></div><span class="axm-badge axm-badge--warning">Candidate</span></div>',
        'navigation': f'<nav class="axm-nav" aria-label="{title}"><a class="axm-nav__link" aria-current="page" href="#">Overview</a><a class="axm-nav__link" href="#">{title}</a></nav>',
        'badge': f'<span class="axm-badge axm-badge--warning">{title}</span>',
        'state': f'<section class="axm-state"><div class="axm-state__icon">◇</div><h1>{title}</h1><p class="axm-state__description">{purpose}</p><button class="axm-button axm-button--primary">Review only</button></section>',
        'progress': f'<div class="axm-progress" data-progress="68" role="progressbar" aria-label="{title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="68"><div class="axm-progress__header"><span>{title}</span><strong>68%</strong></div><div class="axm-progress__track"><div class="axm-progress__value"></div></div></div>',
        'notice': f'<div class="axm-notice axm-notice--warning"><span class="axm-notice__icon">◇</span><div><strong class="axm-notice__title">{title}</strong><p class="axm-notice__body">{purpose}</p></div><button class="axm-button">Review</button></div>',
        'data-table': f'<div class="axm-table-wrap"><table class="axm-table"><thead><tr><th>Mold</th><th>Status</th></tr></thead><tbody><tr data-selected="true"><td>{title}</td><td><span class="axm-badge axm-badge--warning">Candidate</span></td></tr><tr><td>Purpose</td><td>{purpose}</td></tr></tbody></table></div>',
        'command': f'<section class="axm-command"><div class="axm-command__search"><span>⌕</span><input class="axm-command__input" value="{title}" aria-label="Search"></div><div class="axm-command__list"><button class="axm-command__item" aria-selected="true"><span>◈</span><span><strong>{title}</strong><span class="axm-command__meta">{purpose}</span></span><kbd>Enter</kbd></button></div><div class="axm-command__footer">TEST-HOLD-REVIEW</div></section>',
        'skeleton': '<article class="axm-card axm-stack"><div class="axm-skeleton axm-skeleton--title"></div><div class="axm-skeleton axm-skeleton--text"></div><div class="axm-skeleton axm-skeleton--text"></div></article>',
        'inspector': f'<aside class="axm-inspector"><header class="axm-inspector__header"><div><span class="axm-card__eyebrow">TEST-HOLD-REVIEW</span><h1>{title}</h1></div><span class="axm-badge axm-badge--warning">Candidate</span></header><section class="axm-inspector__section"><span class="axm-inspector__label">Purpose</span><p>{purpose}</p></section></aside>',
    }
    if component not in templates:
        fail(f'No specimen template registered for component: {component}')
    return templates[component]


def main():
    request_path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'examples/mold-request.json'
    request = load(request_path)
    required = {'name', 'component', 'material', 'theme', 'purpose'}
    if set(request) != required:
        fail(f'Fields must be exactly: {sorted(required)}')
    if not re.fullmatch(r'[a-z][a-z0-9-]{2,48}', request['name']):
        fail('name must be kebab-case, 3–49 characters')
    if not isinstance(request['purpose'], str) or not (10 <= len(request['purpose']) <= 240):
        fail('purpose must be 10–240 characters')

    components = {item['id']: item for item in load(ROOT / 'registry/components.json')['components']}
    materials = {item['id']: item for item in load(ROOT / 'registry/materials.json')['recipes']}
    themes = {item['id']: item for item in load(ROOT / 'registry/themes.json')['themes']}
    for field, options in [('component', components), ('material', materials), ('theme', themes)]:
        if request[field] not in options:
            fail(f'Unknown {field}: {request[field]}')

    canonical = json.dumps(request, sort_keys=True, separators=(',', ':'))
    fingerprint = hashlib.sha256(canonical.encode()).hexdigest()[:16]
    candidate_id = f'{request["name"]}-{fingerprint}'
    out = CANDIDATES / candidate_id
    if out.exists():
        fail(f'Duplicate candidate already exists: {out.relative_to(ROOT)}')
    out.mkdir(parents=True)

    candidate_class = f'axm-candidate--{request["name"]}'
    css = f'''/* TEST-HOLD-REVIEW — generated candidate, not canonical */
.{candidate_class} {{
  display: grid;
  gap: var(--axm-space-4);
  padding: var(--axm-panel-padding);
}}

.{candidate_class}__meta {{
  display: flex;
  flex-wrap: wrap;
  gap: var(--axm-space-2);
}}
'''
    (out / 'candidate.css').write_text(css, encoding='utf-8')

    title = html.escape(request['name'].replace('-', ' ').title())
    purpose = html.escape(request['purpose'])
    component_html = specimen_markup(request['component'], title, purpose)
    material_class = materials[request['material']]['class']
    specimen = f'''<!doctype html>
<html lang="en" data-theme="{html.escape(request['theme'])}" data-density="comfortable" data-effects="balanced" data-motion="full">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{title} candidate</title><link rel="stylesheet" href="../../src/css/index.css"><link rel="stylesheet" href="candidate.css"><script>addEventListener('DOMContentLoaded',()=>document.querySelectorAll('[data-progress]').forEach(x=>x.style.setProperty('--axm-progress',x.dataset.progress+'%')))</script></head>
<body><main class="axm-shell axm-cover"><section class="axm-panel axm-material {material_class} {candidate_class}"><div class="{candidate_class}__meta"><span class="axm-badge">{html.escape(request['component'])}</span><span class="axm-badge axm-badge--info">{html.escape(request['material'])}</span><span class="axm-badge axm-badge--warning">TEST-HOLD-REVIEW</span></div>{component_html}</section></main></body></html>
'''
    (out / 'specimen.html').write_text(specimen, encoding='utf-8')

    manifest = {
        'candidate_id': candidate_id,
        'fingerprint': fingerprint,
        'status': 'TEST-HOLD-REVIEW',
        'generated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'request': request,
        'component_states_to_review': components[request['component']]['states'],
        'canonical_write': False,
        'promotion_requires': ['human-review', 'responsive-check', 'state-matrix', 'visual-baseline', 'accessibility-check', 'performance-check', 'rollback-pointer'],
    }
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(f'Created review candidate: {out.relative_to(ROOT)}')
    print('No canonical files were changed.')


if __name__ == '__main__':
    main()
