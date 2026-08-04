from __future__ import annotations
import re
from typing import Any


def _strip_comments(text: str) -> str:
    text=re.sub(r'/\*.*?\*/','',text,flags=re.S)
    return re.sub(r'//.*?$','',text,flags=re.M)


def _blocks(text: str) -> list[dict[str,str]]:
    pattern=re.compile(r'\b(world|interface)\s+([A-Za-z_][\w-]*)\s*\{')
    blocks=[]; pos=0
    while True:
        match=pattern.search(text,pos)
        if not match: break
        depth=1; i=match.end()
        while i<len(text) and depth:
            if text[i]=='{': depth+=1
            elif text[i]=='}': depth-=1
            i+=1
        if depth: raise ValueError(f'unbalanced braces for {match.group(2)}')
        blocks.append({'kind':match.group(1),'name':match.group(2),'body':text[match.end():i-1]}); pos=i
    return blocks


def run(wit_text: str, *, target_language: str | None = None) -> dict[str, Any]:
    clean=_strip_comments(wit_text)
    try: blocks=_blocks(clean)
    except ValueError as exc: return {'verdict':'REFUSE','reason':str(exc),'contracts':[],'compiled':False}
    seen=set(); contracts=[]; errors=[]
    for block in blocks:
        key=(block['kind'],block['name'])
        if key in seen: errors.append({'reason':'duplicate block','kind':key[0],'name':key[1]}); continue
        seen.add(key); declarations=[]
        for raw in block['body'].split(';'):
            raw=' '.join(raw.split())
            if not raw: continue
            kind='declaration'
            if raw.startswith('import '): kind='import'
            elif raw.startswith('export '): kind='export'
            elif ': func' in raw or raw.startswith('func '): kind='function'
            elif raw.startswith('type ') or raw.startswith('record ') or raw.startswith('variant '): kind='type'
            declarations.append({'kind':kind,'raw':raw})
        contracts.append({'kind':block['kind'],'name':block['name'],'declarations':declarations})
    binding={'target_language':target_language,'contracts':[{'kind':c['kind'],'name':c['name']} for c in contracts],'generated':False} if target_language else None
    return {'schema':'axm.translation.wit-contracts/v1','verdict':'EXTRACTED' if contracts and not errors else ('PARTIAL' if contracts else 'REFUSE'),'contracts':contracts,'errors':errors,'binding_descriptor':binding,'compiled':False,'loaded':False}
