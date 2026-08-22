"""Detached AXM Content-Addressed Evidence Bundle v0.1.0."""
from __future__ import annotations
import hashlib,json
from pathlib import PurePosixPath
from typing import Any,Dict,Sequence

class EvidenceBundleError(ValueError):pass

def _safe_name(name:str)->bool:
    p=PurePosixPath(name)
    return bool(name) and not p.is_absolute() and ".." not in p.parts and name not in {".",""}

class ContentAddressedEvidenceBundle:
    def bundle(self, objects: Sequence[Dict[str,Any]], max_objects:int=1000, max_total_bytes:int=100_000_000)->Dict[str,Any]:
        if not isinstance(objects,Sequence) or isinstance(objects,(str,bytes)) or not objects:raise EvidenceBundleError("non-empty object sequence required")
        if not isinstance(max_objects,int) or isinstance(max_objects,bool) or max_objects<=0 or not isinstance(max_total_bytes,int) or isinstance(max_total_bytes,bool) or max_total_bytes<0:raise EvidenceBundleError("invalid bounds")
        if len(objects)>max_objects:raise EvidenceBundleError("object count exceeds bound")
        names=set();manifest=[];blobs={};total=0
        for item in objects:
            if not isinstance(item,dict):raise EvidenceBundleError("each object must be a mapping")
            name=item.get("name");content=item.get("content");role=item.get("role");media=item.get("media_type")
            if not isinstance(name,str) or not _safe_name(name) or name in names:raise EvidenceBundleError("unsafe or duplicate logical name")
            if not isinstance(content,bytes):raise EvidenceBundleError("content must be bytes")
            if not isinstance(role,str) or not role or not isinstance(media,str) or not media:raise EvidenceBundleError("role and media type required")
            names.add(name);total+=len(content)
            if total>max_total_bytes:raise EvidenceBundleError("total bytes exceed bound")
            digest=hashlib.sha256(content).hexdigest();blobs.setdefault(digest,content)
            manifest.append({"name":name,"sha256":digest,"size":len(content),"role":role,"media_type":media})
        manifest.sort(key=lambda x:x["name"])
        manifest_bytes=json.dumps({"objects":manifest},sort_keys=True,separators=(",",":")).encode()
        return {"schema_version":"axm.verify.content-addressed-evidence-bundle/0.1","bundle_id":hashlib.sha256(manifest_bytes).hexdigest(),"manifest":manifest,"blobs":blobs,"logical_object_count":len(manifest),"unique_blob_count":len(blobs),"total_logical_bytes":total,"archive_written":False,"published":False,"authority":"NONE","canon":False}
