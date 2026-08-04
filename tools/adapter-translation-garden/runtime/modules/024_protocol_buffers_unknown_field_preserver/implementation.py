from __future__ import annotations
import base64, hashlib
from typing import Any


def _varint(data: bytes, pos: int) -> tuple[int,int]:
    value=0
    for shift in range(0,70,7):
        if pos>=len(data): raise ValueError('truncated varint')
        b=data[pos]; pos+=1; value|=(b&0x7f)<<shift
        if not b&0x80: return value,pos
    raise ValueError('varint too long')


def inspect_wire(data: bytes, *, known_field_numbers: list[int] | set[int], max_bytes: int = 1_000_000) -> dict[str, Any]:
    if len(data)>max_bytes: return {'verdict':'REFUSE','reason':'message exceeds max_bytes','segments':[]}
    known={int(x) for x in known_field_numbers}; pos=0; segments=[]
    try:
        while pos<len(data):
            start=pos; key,pos=_varint(data,pos); field=key>>3; wire=key&7
            if field<=0: raise ValueError('invalid field number')
            if wire==0: _,pos=_varint(data,pos)
            elif wire==1:
                if pos+8>len(data): raise ValueError('truncated fixed64')
                pos+=8
            elif wire==2:
                length,pos=_varint(data,pos)
                if length<0 or pos+length>len(data): raise ValueError('truncated length-delimited field')
                pos+=length
            elif wire==5:
                if pos+4>len(data): raise ValueError('truncated fixed32')
                pos+=4
            elif wire in {3,4}: raise ValueError('group wire types are unsupported')
            else: raise ValueError('invalid wire type')
            raw=data[start:pos]
            segments.append({'index':len(segments),'field_number':field,'wire_type':wire,'known':field in known,'raw_base64':base64.b64encode(raw).decode('ascii'),'sha256':hashlib.sha256(raw).hexdigest()})
    except ValueError as exc:
        return {'verdict':'REFUSE','reason':str(exc),'segments':segments,'consumed_bytes':pos,'message_size':len(data)}
    return {'schema':'axm.translation.protobuf-wire-preservation/v1','verdict':'INSPECTED','segments':segments,'known_count':sum(s['known'] for s in segments),'unknown_count':sum(not s['known'] for s in segments),'message_sha256':hashlib.sha256(data).hexdigest(),'message_size':len(data),'decoded_semantics':False}


def reassemble(segments: list[dict[str, Any]]) -> dict[str, Any]:
    ordered=sorted(segments,key=lambda x:int(x['index'])); raw=bytearray(); errors=[]
    for expected, segment in enumerate(ordered):
        if int(segment['index'])!=expected: errors.append('non_contiguous_or_duplicate_index')
        try: part=base64.b64decode(segment['raw_base64'],validate=True)
        except Exception: errors.append(f'invalid_base64_at_{expected}'); continue
        if hashlib.sha256(part).hexdigest()!=segment.get('sha256'): errors.append(f'hash_mismatch_at_{expected}')
        raw.extend(part)
    return {'verdict':'REASSEMBLED' if not errors else 'REFUSE','data':bytes(raw) if not errors else None,'errors':errors,'sha256':hashlib.sha256(raw).hexdigest() if not errors else None}


def run(data: bytes, **kwargs: Any) -> dict[str, Any]:
    return inspect_wire(data, **kwargs)
