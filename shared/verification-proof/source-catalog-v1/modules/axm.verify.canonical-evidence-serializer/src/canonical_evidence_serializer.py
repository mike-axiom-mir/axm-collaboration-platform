"""Detached AXM Canonical Evidence Serializer v0.1.0."""
from __future__ import annotations
import hashlib, json, unicodedata
from typing import Any, Dict

class CanonicalEvidenceError(ValueError):pass

def _normalise(value: Any) -> Any:
    if value is None or isinstance(value, bool): return value
    if isinstance(value, int) and not isinstance(value, bool): return value
    if isinstance(value, float): raise CanonicalEvidenceError("floating-point values are not canonical in this profile")
    if isinstance(value, str): return unicodedata.normalize("NFC", value)
    if isinstance(value, list): return [_normalise(item) for item in value]
    if isinstance(value, dict):
        result={}; originals={}
        for key,item in value.items():
            if not isinstance(key,str): raise CanonicalEvidenceError("mapping keys must be strings")
            canonical_key=unicodedata.normalize("NFC",key)
            if canonical_key in result and originals[canonical_key] != key:
                raise CanonicalEvidenceError("mapping keys collide after Unicode normalization")
            originals[canonical_key]=key;result[canonical_key]=_normalise(item)
        return result
    raise CanonicalEvidenceError(f"unsupported evidence type: {type(value).__name__}")

class CanonicalEvidenceSerializer:
    def serialize(self, value: Any) -> Dict[str, Any]:
        normalized=_normalise(value)
        payload=json.dumps(normalized,sort_keys=True,separators=(",",":"),ensure_ascii=False,allow_nan=False).encode("utf-8")
        return {"schema_version":"axm.verify.canonical-evidence-serialization/0.1","canonical_bytes":payload,"sha256":hashlib.sha256(payload).hexdigest(),"byte_length":len(payload),"normalization":"Unicode NFC; sorted string keys; compact UTF-8 JSON; integers only","semantic_truth_proven":False,"authority":"NONE","canon":False}
