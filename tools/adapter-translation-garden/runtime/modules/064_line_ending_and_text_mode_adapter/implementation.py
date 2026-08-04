from __future__ import annotations
import hashlib
from typing import Any

from axm_translation_core import add_loss, new_loss_ledger

_EOL={'LF':'\n','CRLF':'\r\n','CR':'\r'}


def run(data: bytes|bytearray|memoryview, *, target: str='LF', encoding: str='utf-8', dos_eof_policy: str='preserve') -> dict[str,Any]:
    if target not in _EOL: raise ValueError('target must be LF, CRLF, or CR')
    raw=bytes(data); ledger=new_loss_ledger(); source_hash=hashlib.sha256(raw).hexdigest()
    if b'\x00' in raw:
        return {'schema':'axm.translation.text-mode/v1','status':'BINARY_UNCHANGED','data':raw,'source_sha256':source_hash,'loss':ledger}
    bom=raw.startswith(b'\xef\xbb\xbf'); payload=raw[3:] if bom else raw
    try: text=payload.decode(encoding,'strict')
    except UnicodeDecodeError:
        return {'schema':'axm.translation.text-mode/v1','status':'BINARY_OR_UNDECODABLE_UNCHANGED','data':raw,'source_sha256':source_hash,'loss':ledger}
    dos_eof=text.endswith('\x1a')
    if dos_eof and dos_eof_policy=='strip':
        text=text[:-1]; add_loss(ledger,kind='dos_eof_removed',path='$.text',reason='explicit dos_eof_policy=strip',severity='high',reversible=False)
    elif dos_eof_policy not in {'preserve','strip'}: raise ValueError('dos_eof_policy must be preserve or strip')
    counts={'CRLF':text.count('\r\n')}; no_crlf=text.replace('\r\n',''); counts['CR']=no_crlf.count('\r'); counts['LF']=no_crlf.count('\n')
    normalized=text.replace('\r\n','\n').replace('\r','\n')
    converted=normalized.replace('\n',_EOL[target])
    out=converted.encode(encoding)
    if bom: out=b'\xef\xbb\xbf'+out
    if out!=raw: add_loss(ledger,kind='line_endings_changed',path='$.text',source_value=counts,target_value=target,reason='explicit newline target requested',severity='low',reversible=True)
    return {'schema':'axm.translation.text-mode/v1','status':'TEXT_TRANSLATED','data':out,'source_sha256':source_hash,'target_sha256':hashlib.sha256(out).hexdigest(),'source_counts':counts,'target':target,'bom_preserved':bom,'dos_eof_present':dos_eof,'loss':ledger}
