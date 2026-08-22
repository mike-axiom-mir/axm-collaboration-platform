
"""Detached AXM Artifact Identity Hasher v0.1.0."""
from __future__ import annotations
import hashlib,json,math
from typing import Any,Dict
class ArtifactIdentityError(ValueError):pass
def _json_bytes(value:Any)->bytes:
    def reject(obj:Any)->None:
        if isinstance(obj,float) and not math.isfinite(obj):raise ArtifactIdentityError("non-finite numbers are not canonical")
        if isinstance(obj,dict):
            if any(not isinstance(k,str) for k in obj):raise ArtifactIdentityError("mapping keys must be strings")
            for v in obj.values():reject(v)
        elif isinstance(obj,(list,tuple)):
            for v in obj:reject(v)
        elif obj is not None and not isinstance(obj,(str,int,float,bool)):raise ArtifactIdentityError("unsupported canonical value")
    reject(value)
    try:return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False,allow_nan=False).encode("utf-8")
    except (TypeError,ValueError) as exc:raise ArtifactIdentityError(str(exc)) from exc
class ArtifactIdentityHasher:
    def identity(self,payload:Any,artifact_type:str="generic",scope:str="content")->Dict[str,Any]:
        if not isinstance(artifact_type,str) or not artifact_type or not isinstance(scope,str) or not scope:raise ArtifactIdentityError("artifact_type and scope are required")
        if isinstance(payload,bytes):data=payload;canonicalization="exact-bytes"
        elif isinstance(payload,str):data=payload.encode("utf-8");canonicalization="utf-8-text"
        else:data=_json_bytes(payload);canonicalization="canonical-json"
        content=hashlib.sha256(data).hexdigest()
        envelope=_json_bytes({"algorithm":"sha256","artifact_type":artifact_type,"canonicalization":canonicalization,"content_digest":content,"scope":scope})
        identity=hashlib.sha256(envelope).hexdigest()
        return {"schema_version":"axm.verify.artifact-identity/0.1","algorithm":"sha256","artifact_type":artifact_type,"scope":scope,"canonicalization":canonicalization,"byte_length":len(data),"content_digest":f"sha256:{content}","identity_digest":f"sha256:{identity}","semantic_equivalence_proven":False,"authority":"NONE","canon":False}
