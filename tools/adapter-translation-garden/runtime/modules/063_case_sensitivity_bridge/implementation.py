from __future__ import annotations
import hashlib
import unicodedata
from typing import Any


def _key(value: str, form: str) -> str:
    return unicodedata.normalize(form,value).casefold()


def analyze(names: list[str], *, target_case_sensitive: bool, normalization: str='NFC') -> dict[str,Any]:
    groups={}
    for name in names:
        key=name if target_case_sensitive else _key(name,normalization)
        groups.setdefault(key,[]).append(name)
    collisions=[{'comparison_key':key,'names':values} for key,values in groups.items() if len(values)>1]
    return {'schema':'axm.translation.case-collision-report/v1','target_case_sensitive':target_case_sensitive,'normalization':normalization,'collisions':collisions,'collision_count':len(collisions)}


def resolve(names: list[str], *, target_case_sensitive: bool, policy: str='refuse', normalization: str='NFC') -> dict[str,Any]:
    report=analyze(names,target_case_sensitive=target_case_sensitive,normalization=normalization)
    if report['collision_count']==0: return {'schema':'axm.translation.case-resolution/v1','ok':True,'mapping':{n:n for n in names},'collisions':[],'policy':policy}
    if policy=='refuse': return {'schema':'axm.translation.case-resolution/v1','ok':False,'mapping':None,'collisions':report['collisions'],'policy':policy}
    if policy not in {'suffix','hash_suffix'}: raise ValueError('policy must be refuse, suffix, or hash_suffix')
    mapping={}; used=set()
    for name in names:
        candidate=name; index=1
        while _key(candidate,normalization) in used:
            if policy=='suffix': candidate=f'{name}__case_{index}'
            else: candidate=f"{name}__{hashlib.sha256(name.encode('utf-8')).hexdigest()[:8]}_{index}"
            index+=1
        used.add(_key(candidate,normalization)); mapping[name]=candidate
    return {'schema':'axm.translation.case-resolution/v1','ok':True,'mapping':mapping,'collisions':report['collisions'],'policy':policy,'source_names_preserved_in_mapping':True}


def run(names: list[str], **kwargs: Any) -> dict[str,Any]: return resolve(names,**kwargs)
