#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
from collections import Counter
import argparse
import datetime
import json
import re

EXTENSIONS = {'.css', '.scss', '.sass', '.less', '.html', '.htm', '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'}
SKIP_DIRS = {'.git', 'node_modules', 'dist', 'build', '.next', '.cache', 'coverage', 'vendor', '.venv', 'venv'}

PATTERNS = {
    'hex_colors': re.compile(r'#[0-9a-fA-F]{3,8}\b'),
    'rgb_colors': re.compile(r'rgba?\([^)]*\)'),
    'hsl_colors': re.compile(r'hsla?\([^)]*\)'),
    'oklch_colors': re.compile(r'oklch\([^)]*\)', re.I),
    'spacing_values': re.compile(r'(?<![\w-])(?:margin|padding|gap|inset(?:-[\w-]+)?|top|right|bottom|left)\s*:\s*([^;{}]+)', re.I),
    'radii': re.compile(r'border-radius\s*:\s*([^;{}]+)', re.I),
    'shadows': re.compile(r'(?:box-shadow|text-shadow)\s*:\s*([^;{}]+)', re.I),
    'z_index': re.compile(r'z-index\s*:\s*([^;{}]+)', re.I),
    'durations': re.compile(r'(?<![\w-])(\d*\.?\d+(?:ms|s))\b', re.I),
    'important': re.compile(r'!important\b', re.I),
    'id_selectors': re.compile(r'#[A-Za-z_][\w-]*(?=[\s>+~.,:{[])'),
    'media_queries': re.compile(r'@media\s*([^\{]+)', re.I),
    'container_queries': re.compile(r'@container\s*([^\{]+)', re.I),
    'layers': re.compile(r'@layer\s+([^;{]+)', re.I),
    'inline_styles': re.compile(r'\sstyle\s*=\s*["\']', re.I),
    'css_in_js': re.compile(r'(?:styled\.|css`|createGlobalStyle|style\.setProperty|insertRule\s*\()', re.I),
    'transition_all': re.compile(r'transition\s*:\s*all\b', re.I),
    'fixed_widths': re.compile(r'(?:width|min-width|max-width)\s*:\s*(\d+(?:\.\d+)?px)\b', re.I),
}

RISK_WEIGHTS = {
    'important': 5,
    'inline_styles': 4,
    'css_in_js': 3,
    'transition_all': 4,
    'id_selectors': 2,
    'fixed_widths': 1,
}


def walk_files(root: Path):
    for path in root.rglob('*'):
        if not path.is_file() or path.suffix.lower() not in EXTENSIONS:
            continue
        if any(part in SKIP_DIRS for part in path.relative_to(root).parts):
            continue
        yield path


def normalized(value):
    if isinstance(value, tuple):
        value = ' '.join(value)
    return ' '.join(str(value).split())


def top_markdown(counter: Counter, limit=20):
    items = counter.most_common(limit)
    if not items:
        return '_None found._\n'
    return '\n'.join(f'- `{value}` — {count}' for value, count in items) + '\n'


def main():
    parser = argparse.ArgumentParser(description='Read-only CSS architecture audit for AXM migration.')
    parser.add_argument('source', type=Path)
    parser.add_argument('--out', type=Path, default=Path('audit-output'))
    parser.add_argument('--token-threshold', type=int, default=3, help='Minimum repetitions before proposing a token candidate.')
    args = parser.parse_args()

    source = args.source.resolve()
    if not source.exists() or not source.is_dir():
        parser.error(f'source must be an existing directory: {source}')
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)

    counters = {name: Counter() for name in PATTERNS}
    files = []
    file_metrics = []
    total_bytes = total_lines = total_risk = 0

    for path in walk_files(source):
        try:
            text = path.read_text(encoding='utf-8', errors='replace')
        except OSError:
            continue
        rel = str(path.relative_to(source))
        files.append(rel)
        size = path.stat().st_size
        lines = text.count('\n') + 1
        total_bytes += size
        total_lines += lines
        local_counts = {}

        for name, pattern in PATTERNS.items():
            matches = pattern.findall(text)
            local_counts[name] = len(matches)
            if name in RISK_WEIGHTS:
                if matches:
                    counters[name][rel] += len(matches)
            else:
                for match in matches:
                    counters[name][normalized(match)] += 1

        risk = sum(local_counts[name] * weight for name, weight in RISK_WEIGHTS.items())
        total_risk += risk
        file_metrics.append({
            'path': rel,
            'bytes': size,
            'lines': lines,
            'risk_score': risk,
            'signals': {name: count for name, count in local_counts.items() if count and name in RISK_WEIGHTS},
        })

    repeated_sources = ['hex_colors', 'rgb_colors', 'hsl_colors', 'oklch_colors', 'spacing_values', 'radii', 'shadows', 'z_index', 'durations']
    token_candidates = []
    for category in repeated_sources:
        for value, count in counters[category].most_common():
            if count >= args.token_threshold:
                token_candidates.append({'category': category, 'value': value, 'count': count, 'review_state': 'TEST-HOLD-REVIEW'})

    file_metrics.sort(key=lambda item: (-item['risk_score'], -item['lines'], item['path']))
    risk_band = 'low' if total_risk < 25 else 'medium' if total_risk < 100 else 'high'
    generated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    data = {
        'schema_version': '2.0',
        'generated_at': generated_at,
        'source': str(source),
        'file_count': len(files),
        'total_bytes': total_bytes,
        'total_lines': total_lines,
        'architecture_risk_score': total_risk,
        'architecture_risk_band': risk_band,
        'file_metrics': file_metrics,
        'counts': {name: dict(counter.most_common()) for name, counter in counters.items()},
        'token_candidates': token_candidates,
        'source_modified': False,
    }
    (out / 'audit-data.json').write_text(json.dumps(data, indent=2), encoding='utf-8')
    (out / 'migration-candidates.json').write_text(json.dumps({
        'schema_version': '1.0',
        'status': 'TEST-HOLD-REVIEW',
        'source': str(source),
        'generated_at': generated_at,
        'candidates': token_candidates,
        'canonical_write': False,
    }, indent=2), encoding='utf-8')

    risky = [item for item in file_metrics if item['risk_score']][:15]
    risky_md = '_No weighted risk signals found._\n' if not risky else '\n'.join(
        f'- `{item["path"]}` — score **{item["risk_score"]}**, signals: {item["signals"]}' for item in risky
    ) + '\n'

    report = f'''# AXM CSS Source Audit v2

Generated: {generated_at}  
Source: `{source}`

## Architecture signal

- Relevant files: **{len(files)}**
- Text lines: **{total_lines:,}**
- Bytes scanned: **{total_bytes:,}**
- Weighted risk score: **{total_risk} ({risk_band})**
- Proposed token candidates: **{len(token_candidates)}**

The score is a prioritization aid, not proof of poor code. Every match requires context review.

## Highest-risk files

{risky_md}
## Risk signals

### Files using `!important`
{top_markdown(counters['important'])}
### Files containing inline styles
{top_markdown(counters['inline_styles'])}
### Files containing likely CSS-in-JS/runtime injection
{top_markdown(counters['css_in_js'])}
### Files using `transition: all`
{top_markdown(counters['transition_all'])}
### ID selectors
{top_markdown(counters['id_selectors'])}
### Fixed pixel widths
{top_markdown(counters['fixed_widths'])}
## Repeated visual values

### Hex colors
{top_markdown(counters['hex_colors'], 40)}
### RGB colors
{top_markdown(counters['rgb_colors'], 30)}
### HSL / OKLCH colors
{top_markdown(counters['hsl_colors'], 20)}{top_markdown(counters['oklch_colors'], 20)}
### Spacing declarations
{top_markdown(counters['spacing_values'], 40)}
### Border radii
{top_markdown(counters['radii'], 30)}
### Shadows
{top_markdown(counters['shadows'], 30)}
### Z-index values
{top_markdown(counters['z_index'], 30)}
### Motion durations
{top_markdown(counters['durations'], 30)}
## Architecture features

### Cascade layers
{top_markdown(counters['layers'], 30)}
### Media queries
{top_markdown(counters['media_queries'], 40)}
### Container queries
{top_markdown(counters['container_queries'], 40)}
## Recommended migration order

1. Capture current routes and interaction states as screenshots.
2. Contain existing author CSS in the `legacy` cascade layer without changing output.
3. Review `migration-candidates.json`; promote only values whose repeated use has the same meaning.
4. Extract semantic tokens before component redesign.
5. Move one high-use component family at a time.
6. Separate effect recipes from layout and state logic.
7. Re-run this audit and compare the weighted score; do not optimize the score at the expense of behavior.

## Source integrity

This audit is read-only. It created reports only and changed no source file.
'''
    (out / 'AUDIT_REPORT.md').write_text(report, encoding='utf-8')
    print(f'Wrote {out / "AUDIT_REPORT.md"}')
    print(f'Wrote {out / "audit-data.json"}')
    print(f'Wrote {out / "migration-candidates.json"}')


if __name__ == '__main__':
    main()
