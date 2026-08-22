from __future__ import annotations
import hashlib
import math
from collections import Counter
from pathlib import Path
from typing import Any

_MAGIC=[
('png','image/png',b'\x89PNG\r\n\x1a\n',False,'image'),('jpeg','image/jpeg',b'\xff\xd8\xff',False,'image'),
('gif','image/gif',b'GIF8',False,'image'),('pdf','application/pdf',b'%PDF-',False,'document'),
('zip','application/zip',b'PK\x03\x04',False,'archive'),('gzip','application/gzip',b'\x1f\x8b',False,'compression'),
('7z','application/x-7z-compressed',b"7z\xbc\xaf'\x1c",False,'archive'),('rar','application/vnd.rar',b'Rar!\x1a\x07',False,'archive'),
('elf','application/x-elf',b'\x7fELF',True,'executable'),('pe','application/vnd.microsoft.portable-executable',b'MZ',True,'executable'),
('wasm','application/wasm',b'\x00asm',True,'executable'),('sqlite','application/vnd.sqlite3',b'SQLite format 3\x00',False,'database'),
('ogg','application/ogg',b'OggS',False,'media'),('flac','audio/flac',b'fLaC',False,'audio'),
]
_EXT={'.png':'png','.jpg':'jpeg','.jpeg':'jpeg','.gif':'gif','.pdf':'pdf','.zip':'zip','.gz':'gzip','.7z':'7z','.rar':'rar','.exe':'pe','.dll':'pe','.wasm':'wasm','.sqlite':'sqlite','.db':'sqlite','.ogg':'ogg','.flac':'flac'}


def _entropy(data: bytes) -> float:
    if not data: return 0.0
    counts=Counter(data); total=len(data)
    return -sum((n/total)*math.log2(n/total) for n in counts.values())


def run(data: bytes|bytearray|memoryview, *, filename: str|None=None, declared_type: str|None=None, max_probe_bytes: int=4096) -> dict[str, Any]:
    raw=bytes(data)
    probe=raw[:max_probe_bytes]
    detected=None
    for name,mime,magic,executable,family in _MAGIC:
        if probe.startswith(magic):
            detected={'format':name,'media_type':mime,'family':family,'executable_like':executable,'magic_hex':magic.hex()}; break
    if detected is None and len(probe)>=12 and probe[:4]==b'RIFF':
        subtype=probe[8:12]
        detected={'format':'wav' if subtype==b'WAVE' else 'riff','media_type':'audio/wav' if subtype==b'WAVE' else 'application/x-riff','family':'audio' if subtype==b'WAVE' else 'container','executable_like':False,'magic_hex':probe[:12].hex()}
    if detected is None and len(probe)>=12 and probe[4:8]==b'ftyp':
        detected={'format':'iso-base-media','media_type':'video/mp4','family':'media-container','executable_like':False,'magic_hex':probe[:12].hex()}
    extension=Path(filename).suffix.lower() if filename else None
    expected=_EXT.get(extension) if extension else None
    warnings=[]
    if expected and detected and expected!=detected['format']:
        warnings.append('filename extension disagrees with magic bytes')
    if declared_type and detected and declared_type not in {detected['format'],detected['media_type']}:
        warnings.append('declared type disagrees with magic bytes')
    return {'schema':'axm.translation.binary-probe/v1','bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'probe_bytes':len(probe),'first_32_bytes_hex':probe[:32].hex(),'detected':detected,'filename_extension':extension,'declared_type':declared_type,'warnings':warnings,'entropy_first_probe':round(_entropy(probe),4),'content_decoded':False,'executable_content_executed':False}
