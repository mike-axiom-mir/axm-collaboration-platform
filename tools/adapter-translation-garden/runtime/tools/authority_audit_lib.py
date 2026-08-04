from __future__ import annotations
import ast
from pathlib import Path
from typing import Any
FORBIDDEN_IMPORT_ROOTS={'socket','subprocess','ctypes','cffi','requests','httpx','serial','bluetooth','multiprocessing'}
FORBIDDEN_DIRECT_CALLS={'eval','exec','__import__','open'}
FORBIDDEN_QUALIFIED={('os','system'),('os','popen'),('subprocess','run'),('subprocess','Popen'),('socket','socket'),('ctypes','CDLL'),('ctypes','WinDLL')}
WRITE_ATTRS={'write_text','write_bytes','unlink','mkdir','rmdir','rename'}

def _qualified(node: ast.AST) -> tuple[str,...]:
    parts=[]
    while isinstance(node,ast.Attribute): parts.append(node.attr); node=node.value
    if isinstance(node,ast.Name): parts.append(node.id)
    return tuple(reversed(parts))

def scan_file(path: Path) -> list[dict[str,Any]]:
    issues=[]; tree=ast.parse(path.read_text(encoding='utf-8'))
    for node in ast.walk(tree):
        if isinstance(node,ast.Import):
            for alias in node.names:
                root=alias.name.split('.')[0]
                if root in FORBIDDEN_IMPORT_ROOTS: issues.append({'line':node.lineno,'kind':'forbidden_import','value':alias.name})
        elif isinstance(node,ast.ImportFrom) and node.module:
            root=node.module.split('.')[0]
            if root in FORBIDDEN_IMPORT_ROOTS: issues.append({'line':node.lineno,'kind':'forbidden_import','value':node.module})
        elif isinstance(node,ast.Call):
            if isinstance(node.func,ast.Name) and node.func.id in FORBIDDEN_DIRECT_CALLS: issues.append({'line':node.lineno,'kind':'forbidden_call','value':node.func.id})
            q=_qualified(node.func)
            if len(q)>=2 and (q[0],q[-1]) in FORBIDDEN_QUALIFIED: issues.append({'line':node.lineno,'kind':'forbidden_call','value':'.'.join(q)})
            if isinstance(node.func,ast.Attribute) and node.func.attr in WRITE_ATTRS: issues.append({'line':node.lineno,'kind':'write_surface','value':node.func.attr})
    return issues

def scan_root(root: Path) -> dict[str,Any]:
    files=sorted((root/'modules').glob('*/implementation.py'))+sorted((root/'shared').rglob('*.py'))
    results=[]
    for path in files:
        issues=scan_file(path); results.append({'path':path.relative_to(root).as_posix(),'sha256':__import__('hashlib').sha256(path.read_bytes()).hexdigest(),'issues':issues})
    shadows=[]
    for folder in sorted((root/'modules').glob('[0-9][0-9][0-9]_*')):
        import json
        m=json.loads((folder/'module.json').read_text(encoding='utf-8'))
        if m.get('authority_mode')=='shadow_only' and (folder/'implementation.py').exists(): shadows.append(folder.name)
    return {'schema':'axm.translation.authority-audit/v1','files_scanned':len(results),'issues':[{'path':r['path'],**i} for r in results for i in r['issues']],'shadow_implementations':shadows,'files':results}
