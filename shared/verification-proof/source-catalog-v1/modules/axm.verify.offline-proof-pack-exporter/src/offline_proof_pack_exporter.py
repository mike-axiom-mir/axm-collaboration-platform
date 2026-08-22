"""Detached AXM Offline Proof Pack Exporter v0.1.0."""
from __future__ import annotations
import hashlib,io,json,zipfile
from pathlib import PurePosixPath
from typing import Any,Dict,Mapping,Sequence

PRIVACY={"PASS","FAIL","UNKNOWN","NOT_RUN"}
class OfflineProofPackError(ValueError):pass

def _safe(path:str)->bool:
    p=PurePosixPath(path)
    return isinstance(path,str) and bool(path) and not p.is_absolute() and ".." not in p.parts and path!="MANIFEST.json"

def _zip_info(path:str)->zipfile.ZipInfo:
    info=zipfile.ZipInfo(path,date_time=(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_STORED;info.create_system=3;info.external_attr=0o100644<<16;return info

class OfflineProofPackExporter:
    def export(self,entries:Sequence[Mapping[str,Any]],mode:str="PRIVATE",metadata:Mapping[str,Any]|None=None,max_total_bytes:int=100_000_000)->Dict[str,Any]:
        if mode not in {"PUBLIC","PRIVATE"}:raise OfflineProofPackError("mode must be PUBLIC or PRIVATE")
        if not isinstance(entries,Sequence) or isinstance(entries,(str,bytes)) or not entries:raise OfflineProofPackError("non-empty entry sequence required")
        if not isinstance(max_total_bytes,int) or isinstance(max_total_bytes,bool) or max_total_bytes<0:raise OfflineProofPackError("invalid byte bound")
        try:metadata_bytes=json.dumps(metadata or {},sort_keys=True,separators=(",",":"),ensure_ascii=False,allow_nan=False).encode()
        except (TypeError,ValueError) as exc:raise OfflineProofPackError("metadata must be deterministic JSON") from exc
        names=set();manifest=[];contents={};total=0;uncertainty=[]
        for item in entries:
            if not isinstance(item,Mapping):raise OfflineProofPackError("entry mapping required")
            path=item.get("path");content=item.get("content");role=item.get("role");privacy=item.get("privacy_status")
            if not _safe(path) or path in names:raise OfflineProofPackError("unsafe or duplicate path")
            if not isinstance(content,bytes) or not isinstance(role,str) or not role or privacy not in PRIVACY:raise OfflineProofPackError("invalid entry content or metadata")
            if mode=="PUBLIC" and privacy!="PASS":raise OfflineProofPackError("public export requires PASS privacy status for every entry")
            if mode=="PRIVATE" and privacy in {"UNKNOWN","NOT_RUN"}:uncertainty.append({"path":path,"privacy_status":privacy})
            if privacy=="FAIL":raise OfflineProofPackError("privacy failure blocks export")
            names.add(path);contents[path]=content;total+=len(content)
            if total>max_total_bytes:raise OfflineProofPackError("total bytes exceed bound")
            manifest.append({"path":path,"sha256":hashlib.sha256(content).hexdigest(),"size":len(content),"role":role,"privacy_status":privacy})
        manifest.sort(key=lambda x:x["path"])
        manifest_object={"schema_version":"axm.verify.offline-proof-pack-manifest/0.1","mode":mode,"metadata":json.loads(metadata_bytes),"entries":manifest,"network_required":False,"encrypted":False,"signed":False}
        manifest_payload=json.dumps(manifest_object,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()
        buffer=io.BytesIO()
        with zipfile.ZipFile(buffer,"w") as archive:
            archive.writestr(_zip_info("MANIFEST.json"),manifest_payload)
            for item in manifest:archive.writestr(_zip_info(item["path"]),contents[item["path"]])
        payload=buffer.getvalue();verdict="UNKNOWN" if uncertainty else "PASS"
        return {"schema_version":"axm.verify.offline-proof-pack-export/0.1","verdict_state":verdict,"mode":mode,"archive_bytes":payload,"archive_sha256":hashlib.sha256(payload).hexdigest(),"archive_size":len(payload),"manifest":manifest_object,"uncertainty":uncertainty,"written_to_disk":False,"encrypted":False,"signed":False,"authority":"NONE","canon":False}
