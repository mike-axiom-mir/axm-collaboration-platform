from __future__ import annotations
import io, stat, unicodedata, zipfile
from pathlib import PurePosixPath

def inspect_zip_bytes(data:bytes,*,max_entries:int=10000,max_uncompressed:int=250_000_000,max_ratio:float=200.0)->dict:
    errors=[]; seen=set(); case_seen=set(); total=0
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            infos=z.infolist()
            if len(infos)>max_entries: errors.append('ENTRY_LIMIT')
            for i in infos:
                name=unicodedata.normalize('NFC',i.filename.replace('\\','/')); p=PurePosixPath(name)
                if p.is_absolute() or '..' in p.parts: errors.append('TRAVERSAL_OR_ABSOLUTE')
                if name in seen: errors.append('DUPLICATE')
                cf=name.casefold()
                if cf in case_seen and name not in seen: errors.append('CASE_OR_UNICODE_COLLISION')
                seen.add(name); case_seen.add(cf); total+=i.file_size
                mode=(i.external_attr>>16)&0xFFFF
                if stat.S_ISLNK(mode): errors.append('SYMLINK')
                if i.flag_bits&0x1: errors.append('ENCRYPTED')
                ratio=i.file_size/max(i.compress_size,1)
                if ratio>max_ratio: errors.append('RATIO_LIMIT')
            if total>max_uncompressed: errors.append('UNCOMPRESSED_LIMIT')
    except Exception: errors.append('INVALID_ZIP')
    return {'ok':not errors,'errors':sorted(set(errors)),'entry_count':len(seen),'uncompressed_bytes':total}
