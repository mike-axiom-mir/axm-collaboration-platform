from __future__ import annotations
import hashlib, json, unicodedata
from pathlib import PurePosixPath

def normalize_path(name:str)->str:
    s=unicodedata.normalize('NFC',name.replace('\\','/'))
    p=PurePosixPath(s)
    if p.is_absolute() or any(part in {'','..'} for part in p.parts): raise ValueError('UNSAFE_PATH')
    return p.as_posix()
def canonical_manifest(entries:list[dict])->dict:
    errors=[]; seen=set(); case_seen=set(); out=[]
    for e in entries:
        try: path=normalize_path(str(e['path']))
        except Exception: errors.append('UNSAFE_PATH'); continue
        key=unicodedata.normalize('NFC',path); case=key.casefold()
        if key in seen: errors.append('DUPLICATE_PATH')
        if case in case_seen and key not in seen: errors.append('CASE_OR_UNICODE_COLLISION')
        seen.add(key); case_seen.add(case)
        if not e.get('sha256') or len(e['sha256'])!=64: errors.append('INVALID_DIGEST')
        out.append({'path':key,'sha256':e.get('sha256'),'bytes':int(e.get('bytes',0)),'semantic_kind':e.get('semantic_kind','data')})
    out=sorted(out,key=lambda x:x['path'])
    payload=json.dumps(out,sort_keys=True,separators=(',',':'))
    return {'ok':not errors,'errors':sorted(set(errors)),'entries':out,'manifest_digest':hashlib.sha256(payload.encode()).hexdigest()}
def verify_manifest(manifest:dict,entries:list[dict])->dict:
    rebuilt=canonical_manifest(entries)
    ok=rebuilt['ok'] and rebuilt['manifest_digest']==manifest.get('manifest_digest')
    return {'ok':ok,'errors':rebuilt['errors']+([] if ok else ['MANIFEST_DIGEST_MISMATCH'])}
