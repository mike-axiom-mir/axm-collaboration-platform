from __future__ import annotations
import ast, hashlib, json
from pathlib import Path
from typing import Any


def _sha(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()


def _canon(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()


def public_api(path: Path) -> list[dict[str, Any]]:
    if not path.exists(): return []
    tree=ast.parse(path.read_text(encoding='utf-8')); out=[]
    for node in tree.body:
        if not isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)) or node.name.startswith('_'): continue
        a=node.args
        out.append({'name':node.name,'async':isinstance(node,ast.AsyncFunctionDef),'positional':[x.arg for x in a.posonlyargs+a.args],'kwonly':[x.arg for x in a.kwonlyargs],'vararg':a.vararg.arg if a.vararg else None,'kwarg':a.kwarg.arg if a.kwarg else None,'defaults':[ast.unparse(x) for x in a.defaults],'kwdefaults':[ast.unparse(x) if x is not None else None for x in a.kw_defaults]})
    return sorted(out,key=lambda x:x['name'])


def file_hashes(folder: Path) -> dict[str,str]:
    return {p.relative_to(folder).as_posix():_sha(p) for p in sorted(folder.rglob('*')) if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc'}


def compute_entry(folder: Path) -> dict[str, Any]:
    m=json.loads((folder/'module.json').read_text(encoding='utf-8')); impl=folder/'implementation.py'; api=public_api(impl)
    identity={k:m.get(k) for k in ('schema','number','id','slug','name','category','purpose','status','version','maturity','authority_mode','default_enabled','implementation','hard_dependencies','recommended_helpers','protected_roots','boundaries','intake')}
    return {'number':m['number'],'id':m['id'],'folder':folder.name,'status':m['status'],'authority_mode':m['authority_mode'],'source_record_number':m.get('evidence',{}).get('source_record_number'),'source_pack':m.get('evidence',{}).get('source_pack'),'manifest_contract_sha256':_canon(identity),'implementation_sha256':_sha(impl) if impl.exists() else None,'public_api':api,'public_api_sha256':_canon(api),'boundaries_sha256':_canon(m.get('boundaries',[])),'capsule_files_sha256':file_hashes(folder)}
