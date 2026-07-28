#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import datetime, hashlib, html, json, re, sys

ROOT = Path(__file__).resolve().parents[1]

def fail(message: str):
    print(f'ERROR: {message}', file=sys.stderr)
    raise SystemExit(2)

TOKEN_ROOT = ROOT / 'src/tokens'
TOKEN_RE = re.compile(r'(?P<name>--axm-[\w-]+)\s*:\s*(?P<value>[^;]+);')

def read_tokens():
    tokens=[]
    for path in sorted(TOKEN_ROOT.glob('*.css')):
        text=path.read_text(encoding='utf-8')
        for match in TOKEN_RE.finditer(text):
            tokens.append({'name':match.group('name'),'value':' '.join(match.group('value').split()),'source':str(path.relative_to(ROOT))})
    return tokens

def export_tokens():
    tokens=read_tokens()
    out=ROOT/'dist'
    out.mkdir(exist_ok=True)
    payload={'schema_version':'1.0','generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'token_count':len(tokens),'tokens':tokens}
    target=out/'axm-tokens.json'
    target.write_text(json.dumps(payload,indent=2),encoding='utf-8')
    print(f'Exported {len(tokens)} tokens to {target.relative_to(ROOT)}')

def make_candidate(request_path: Path):
    req=json.loads(request_path.read_text(encoding='utf-8'))
    required={'name','purpose','overrides'}
    if set(req) != required:
        fail(f'Fields must be exactly: {sorted(required)}')
    if not re.fullmatch(r'[a-z][a-z0-9-]{2,48}',req['name']):
        fail('name must be kebab-case, 3–49 characters')
    if not isinstance(req['purpose'],str) or not (10 <= len(req['purpose']) <= 240):
        fail('purpose must be 10–240 characters')
    known={item['name'] for item in read_tokens()}
    for name,value in req['overrides'].items():
        if name not in known:
            fail(f'Unknown token: {name}')
        if not isinstance(value, str) or not (1 <= len(value) <= 120):
            fail(f'Unsafe token value length for {name}')
        lowered = value.lower()
        banned = ('url(', '@import', 'expression(', '<', '>', '{', '}', ';', '\n', '\r', '/*', '*/')
        if any(item in lowered for item in banned):
            fail(f'Unsafe token value for {name}')
    canonical=json.dumps(req,sort_keys=True,separators=(',',':'))
    fingerprint=hashlib.sha256(canonical.encode()).hexdigest()[:16]
    out=ROOT/'candidates'/f'tokens-{req["name"]}-{fingerprint}'
    if out.exists():
        fail(f'Duplicate token candidate: {out.relative_to(ROOT)}')
    out.mkdir(parents=True)
    lines=['/* TEST-HOLD-REVIEW — token override candidate, not canonical */',f'[data-token-candidate="{req["name"]}"] {{']
    for name,value in sorted(req['overrides'].items()): lines.append(f'  {name}: {value};')
    lines.append('}')
    (out/'candidate-tokens.css').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    manifest={'candidate_id':out.name,'fingerprint':fingerprint,'status':'TEST-HOLD-REVIEW','generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'request':req,'canonical_write':False}
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    specimen=f'''<!doctype html><html lang="en" data-theme="unified" data-density="comfortable" data-effects="balanced" data-motion="full" data-token-candidate="{html.escape(req['name'])}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Token candidate</title><link rel="stylesheet" href="../../src/css/index.css"><link rel="stylesheet" href="candidate-tokens.css"></head><body><main class="axm-shell axm-cover"><section class="axm-panel axm-material axm-material--soft-glass"><span class="axm-card__eyebrow">TEST-HOLD-REVIEW</span><h1>{html.escape(req['name'].replace('-',' ').title())}</h1><p>{html.escape(req['purpose'])}</p><div class="axm-cluster"><span class="axm-badge axm-badge--warning">Token candidate</span><span class="axm-badge">{len(req['overrides'])} overrides</span></div></section></main></body></html>'''
    (out/'specimen.html').write_text(specimen,encoding='utf-8')
    print(f'Created {out.relative_to(ROOT)}; canonical token files unchanged.')

def main():
    command=sys.argv[1] if len(sys.argv)>1 else 'export'
    if command=='export': export_tokens()
    elif command=='candidate':
        path=Path(sys.argv[2]) if len(sys.argv)>2 else ROOT/'examples/token-overrides.json'
        make_candidate(path)
    else: fail('Usage: token_bridge.py export | candidate [request.json]')

if __name__=='__main__': main()
