from __future__ import annotations
from copy import deepcopy
from typing import Any

from axm_translation_core import canonical_json_bytes, contract_fingerprint


def _source_fingerprint(source: Any) -> dict[str,Any]:
    if isinstance(source,(bytes,bytearray,memoryview)):
        import hashlib
        raw=bytes(source); return {'algorithm':'sha256','digest':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'kind':'bytes'}
    result=contract_fingerprint(source); result['kind']='canonical-json'; return result


def create(source: Any, *, target_ref: str, provenance: list[Any]|None=None, unsupported_metadata: dict[str,Any]|None=None, color_profile: Any=None, timing: Any=None, extensions: dict[str,Any]|None=None) -> dict[str,Any]:
    body={'schema':'axm.translation.metadata-sidecar/v1','target_ref':target_ref,'source_fingerprint':_source_fingerprint(source),'provenance':deepcopy(provenance or []),'unsupported_metadata':deepcopy(unsupported_metadata or {}),'color_profile':deepcopy(color_profile),'timing':deepcopy(timing),'extensions':deepcopy(extensions or {})}
    body['integrity']=contract_fingerprint(body)['digest']
    return body


def validate(sidecar: dict[str,Any], source: Any) -> dict[str,Any]:
    unsigned={k:deepcopy(v) for k,v in sidecar.items() if k!='integrity'}
    integrity_ok=sidecar.get('integrity')==contract_fingerprint(unsigned)['digest']
    source_ok=sidecar.get('source_fingerprint')==_source_fingerprint(source)
    return {'schema':'axm.translation.metadata-sidecar-validation/v1','valid':integrity_ok and source_ok,'integrity_ok':integrity_ok,'source_matches':source_ok}


def merge(sidecars: list[dict[str,Any]]) -> dict[str,Any]:
    if not sidecars: raise ValueError('at least one sidecar required')
    conflicts=[]; merged=deepcopy(sidecars[0])
    for incoming in sidecars[1:]:
        for field in ['target_ref','source_fingerprint','color_profile','timing']:
            if incoming.get(field) != merged.get(field): conflicts.append({'field':field,'left':deepcopy(merged.get(field)),'right':deepcopy(incoming.get(field))})
        merged['provenance'].extend(deepcopy(incoming.get('provenance',[])))
        for bucket in ['unsupported_metadata','extensions']:
            for key,value in incoming.get(bucket,{}).items():
                if key in merged[bucket] and merged[bucket][key]!=value: conflicts.append({'field':f'{bucket}.{key}','left':deepcopy(merged[bucket][key]),'right':deepcopy(value)})
                else: merged[bucket][key]=deepcopy(value)
    merged.pop('integrity',None); merged['integrity']=contract_fingerprint(merged)['digest']
    return {'schema':'axm.translation.metadata-sidecar-merge/v1','ok':not conflicts,'sidecar':merged,'conflicts':conflicts}
