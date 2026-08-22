#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, stat, zipfile
from pathlib import Path, PurePosixPath
from typing import Any

def sha256_file(path:Path)->str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return 'sha256:'+h.hexdigest()

def normalized(name:str)->str:
    return str(PurePosixPath(name.replace('\\\\','/')))

def probe(path:Path)->dict[str,Any]:
    result={'schema':'axm.intake.package-probe/v1','artifact_name':path.name,'artifact_hash':sha256_file(path),'format':'ZIP' if zipfile.is_zipfile(path) else 'OTHER','active_merge_safe':False,'blockers':[],'warnings':[],'entries':[],'metrics':{}}
    if not zipfile.is_zipfile(path):
        result['blockers'].append('Artifact is not a readable ZIP archive.')
        result['report_hash']=digest(result);return result
    seen={}; case_seen={}; total=0; max_ratio=0.0
    with zipfile.ZipFile(path,'r') as z:
        for info in z.infolist():
            raw=info.filename; norm=normalized(raw); parts=PurePosixPath(norm).parts
            is_abs=raw.startswith('/') or (len(raw)>=3 and raw[1:3]==':/')
            traversal='..' in parts
            mode=(info.external_attr>>16)&0xFFFF
            symlink=stat.S_ISLNK(mode)
            encrypted=bool(info.flag_bits & 0x1)
            ratio=(info.file_size/max(info.compress_size,1)) if info.file_size else 0.0
            max_ratio=max(max_ratio,ratio); total+=info.file_size
            rec={'path':raw,'normalized_path':norm,'uncompressed_size':info.file_size,'compressed_size':info.compress_size,'crc32':f'{info.CRC:08x}','is_directory':info.is_dir(),'absolute_path':is_abs,'parent_traversal':traversal,'symlink':symlink,'encrypted':encrypted,'compression_ratio':round(ratio,4)}
            result['entries'].append(rec)
            if is_abs: result['blockers'].append(f'Absolute archive path: {raw}')
            if traversal: result['blockers'].append(f'Parent traversal archive path: {raw}')
            if symlink: result['blockers'].append(f'Symbolic-link archive entry: {raw}')
            if encrypted: result['blockers'].append(f'Encrypted archive entry cannot be deterministically inspected: {raw}')
            if ratio>250 and info.file_size>1024*1024: result['blockers'].append(f'Suspicious compression ratio >250x: {raw}')
            if norm in seen: result['blockers'].append(f'Duplicate normalized archive path: {norm}')
            seen[norm]=raw
            cf=norm.casefold()
            if cf in case_seen and case_seen[cf]!=norm: result['blockers'].append(f'Case-fold path collision: {case_seen[cf]} <> {norm}')
            case_seen[cf]=norm
    if len(result['entries'])>20000: result['blockers'].append('Archive entry count exceeds rehearsal bound of 20,000.')
    if total>2*1024*1024*1024: result['blockers'].append('Archive uncompressed size exceeds rehearsal bound of 2 GiB.')
    result['metrics']={'entry_count':len(result['entries']),'total_uncompressed_bytes':total,'max_compression_ratio':round(max_ratio,4)}
    result['blockers']=sorted(set(result['blockers']))
    result['active_merge_safe']=not result['blockers']
    result['report_hash']=digest(result);return result

def canon(x:Any)->bytes:return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def digest(x:Any)->str:return 'sha256:'+hashlib.sha256(canon(x)).hexdigest()

def main():
    ap=argparse.ArgumentParser();ap.add_argument('artifact',type=Path);ap.add_argument('--out',type=Path);a=ap.parse_args();r=probe(a.artifact)
    if a.out:a.out.write_text(json.dumps(r,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    print(json.dumps({'active_merge_safe':r['active_merge_safe'],'blockers':r['blockers'],'artifact_hash':r['artifact_hash'],'report_hash':r['report_hash']},indent=2))
    raise SystemExit(0 if r['active_merge_safe'] else 2)
if __name__=='__main__':main()
