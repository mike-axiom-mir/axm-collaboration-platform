#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import argparse
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
IMPORT_RE = re.compile(r'@import\s+url\(["\']([^"\']+)["\']\)\s+layer\(([^)]+)\);')


def bundle_css(path: Path) -> str:
    text = path.read_text(encoding='utf-8')

    def replace(match):
        target = (path.parent / match.group(1)).resolve()
        content = bundle_css(target)
        return f'@layer {match.group(2).strip()} {{\n{content}\n}}'

    return IMPORT_RE.sub(replace, text)


def bundled_html() -> str:
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    css = bundle_css(ROOT / 'src/css/index.css')
    js = (ROOT / 'app.js').read_text(encoding='utf-8')
    html = re.sub(r'<link rel="stylesheet" href="src/css/index\.css">', lambda _: f'<style>{css}</style>', html)
    html = re.sub(r'<script type="module" src="app\.js"></script>', lambda _: f'<script type="module">{js}</script>', html)
    return html


def main():
    parser = argparse.ArgumentParser(description='Optional Playwright smoke screenshots for the AXM Skin Fabric gallery.')
    parser.add_argument('--out', type=Path, default=ROOT / 'qa' / 'screenshots-v0.2')
    args = parser.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('Playwright is optional and not installed. Run: pip install playwright && playwright install chromium', file=sys.stderr)
        raise SystemExit(2)

    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    results = {'status': 'PASS', 'console_errors': [], 'page_errors': [], 'screenshots': [], 'render_mode': 'in-memory bundle'}
    page_html = bundled_html()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        for name, width, height in [('desktop', 1440, 1100), ('mobile', 390, 844)]:
            page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
            page.on('console', lambda message: results['console_errors'].append(message.text) if message.type == 'error' else None)
            page.on('pageerror', lambda error: results['page_errors'].append(str(error)))
            page.set_content(page_html, wait_until='load')
            page.wait_for_timeout(350)
            target = out / f'PREVIEW_{name.upper()}_v0_2.png'
            page.screenshot(path=str(target), full_page=True)
            results['screenshots'].append(str(target.relative_to(ROOT)))
            results[f'{name}_diagnostic_summary'] = page.locator('#diagnostic-summary').inner_text()
            results[f'{name}_target_count'] = page.locator('button, a, input, select, textarea').count()
            page.close()
        browser.close()

    if results['console_errors'] or results['page_errors']:
        results['status'] = 'FAIL'
    (out / 'SMOKE_RESULTS.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(json.dumps(results, indent=2))
    if results['status'] != 'PASS':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
