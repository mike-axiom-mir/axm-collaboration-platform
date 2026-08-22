from __future__ import annotations
import copy,hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def _diff(before: Any, after: Any, path: list[Any], out: list[dict[str,Any]]) -> None:
    if type(before) is not type(after): out.append({'op':'replace','path':path,'before':before,'after':after}); return
    if isinstance(before,dict):
        for key in sorted(set(before)|set(after)):
            if key not in before: out.append({'op':'add','path':path+[key],'after':after[key]})
            elif key not in after: out.append({'op':'remove','path':path+[key],'before':before[key]})
            else: _diff(before[key],after[key],path+[key],out)
    elif isinstance(before,list):
        if before!=after: out.append({'op':'replace','path':path,'before':before,'after':after})
    elif before!=after: out.append({'op':'replace','path':path,'before':before,'after':after})

def build_evidence_delta(before: Any, after: Any) -> dict[str,Any]:
    operations=[]; _diff(before,after,[],operations); body={'before_sha256':_hash(before),'after_sha256':_hash(after),'operations':operations,'root_preserved':True,'lossless':True,'executed_external_actions':False}
    raw_before=len(json.dumps(before,sort_keys=True,separators=(',',':'),ensure_ascii=False)); raw_after=len(json.dumps(after,sort_keys=True,separators=(',',':'),ensure_ascii=False)); delta_bytes=len(json.dumps(operations,sort_keys=True,separators=(',',':'),ensure_ascii=False))
    return {'schema':'axm.translation.evidence-delta/v1',**body,'delta_sha256':_hash(body),'size_report':{'before_bytes':raw_before,'after_bytes':raw_after,'delta_bytes':delta_bytes}}

def _parent(root: Any, path: list[Any]) -> tuple[Any,Any]:
    if not path: return None,None
    cur=root
    for p in path[:-1]: cur=cur[p]
    return cur,path[-1]

def apply_evidence_delta(before: Any, delta: dict[str,Any]) -> Any:
    if _hash(before)!=delta.get('before_sha256'): raise ValueError('before hash mismatch')
    out=copy.deepcopy(before)
    for op in delta.get('operations',[]):
        path=op.get('path',[])
        if not path:
            if op.get('op')!='replace': raise ValueError('root operation')
            out=copy.deepcopy(op.get('after')); continue
        parent,key=_parent(out,path)
        if op.get('op')=='add': parent[key]=copy.deepcopy(op.get('after'))
        elif op.get('op')=='remove':
            if isinstance(parent,list): parent.pop(key)
            else: parent.pop(key)
        elif op.get('op')=='replace': parent[key]=copy.deepcopy(op.get('after'))
        else: raise ValueError('unknown operation')
    return out

def verify_evidence_delta(before: Any, delta: dict[str,Any]) -> dict[str,Any]:
    body={k:delta.get(k) for k in ('before_sha256','after_sha256','operations','root_preserved','lossless','executed_external_actions')}; hash_valid=_hash(body)==delta.get('delta_sha256')
    try: expanded=apply_evidence_delta(before,delta); after_valid=_hash(expanded)==delta.get('after_sha256')
    except Exception: after_valid=False
    bounded=delta.get('root_preserved') is True and delta.get('lossless') is True and delta.get('executed_external_actions') is False
    valid=hash_valid and after_valid and bounded
    return {'valid':valid,'hash_valid':hash_valid,'after_hash_valid':after_valid,'bounded':bounded,'verdict':'PASS' if valid else 'HOLD'}
