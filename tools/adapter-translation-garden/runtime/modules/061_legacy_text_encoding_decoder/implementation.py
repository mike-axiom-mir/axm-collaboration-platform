from __future__ import annotations
import base64
from typing import Any

_ALLOWED=['utf-8-sig','utf-8','cp1252','latin-1','cp437','shift_jis']
_CONF={'utf-8-sig':1.0,'utf-8':0.95,'shift_jis':0.65,'cp1252':0.6,'latin-1':0.35,'cp437':0.3}


def run(data: bytes|bytearray|memoryview, *, candidates: list[str]|None=None, preferred: str|None=None, preserve_bytes: bool=True) -> dict[str,Any]:
    raw=bytes(data); names=candidates or _ALLOWED
    if any(n not in _ALLOWED for n in names): raise ValueError('candidate encoding is outside the reviewed allowlist')
    results=[]
    for name in names:
        try:
            text=raw.decode(name,'strict'); exact=text.encode(name,'strict')==raw
            confidence=_CONF[name]
            if name=='utf-8-sig' and not raw.startswith(b'\xef\xbb\xbf'): confidence=0.2
            results.append({'encoding':name,'text':text,'roundtrip_exact':exact,'confidence':confidence})
        except (UnicodeDecodeError,UnicodeEncodeError): pass
    selected=None
    if preferred:
        selected=next((r for r in results if r['encoding']==preferred),None)
        if selected is None: raise ValueError('preferred encoding did not decode strictly')
    else:
        distinct={r['text'] for r in results}
        high=sorted(results,key=lambda r:r['confidence'],reverse=True)
        if raw.startswith(b'\xef\xbb\xbf'):
            selected=next((r for r in results if r['encoding']=='utf-8-sig'),None)
        elif high and len(distinct)==1 and any(b>=128 for b in raw) and high[0]['confidence']>=0.9:
            selected=high[0]
        elif high and len(distinct)>1 and high[0]['confidence']>=0.9 and (len(high)==1 or high[0]['confidence']-high[1]['confidence']>=0.25):
            selected=high[0]
    return {'schema':'axm.translation.legacy-decoding/v1','selected':selected,'candidates':results,'ambiguous':selected is None and len(results)>1,'decoded':selected['text'] if selected else None,'source_bytes_base64':base64.b64encode(raw).decode('ascii') if preserve_bytes else None,'bytes_preserved':preserve_bytes,'complete_detection_claimed':False}
