"""Detached AXM Evidence Pointer Resolver v0.1.0."""
from __future__ import annotations
from pathlib import PurePosixPath
from typing import Any,Dict,Mapping

CATALOG_STATES={"ACTIVE","STALE"}
class EvidencePointerError(ValueError):pass

def _safe(path:str)->bool:
    p=PurePosixPath(path)
    return isinstance(path,str) and bool(path) and not p.is_absolute() and ".." not in p.parts

def _result(pointer_type:str,target:Any,status:str)->Dict[str,Any]:
    state="RESOLVED" if status=="ACTIVE" else ("STALE" if status=="STALE" else "BROKEN")
    verdict="PASS" if state=="RESOLVED" else ("UNKNOWN" if state=="STALE" else "FAIL")
    return {"schema_version":"axm.verify.evidence-pointer-resolution/0.1","pointer_type":pointer_type,"pointer_state":state,"verdict_state":verdict,"target":target,"network_accessed":False,"filesystem_accessed":False,"authority":"NONE","canon":False}

class EvidencePointerResolver:
    def resolve(self,pointer:Mapping[str,Any],catalog:Mapping[str,Any])->Dict[str,Any]:
        if not isinstance(pointer,Mapping) or not isinstance(catalog,Mapping):raise EvidencePointerError("pointer and catalog required")
        kind=pointer.get("type")
        if kind=="relative":
            path=pointer.get("path")
            if not _safe(path):raise EvidencePointerError("unsafe relative path")
            record=catalog.get("relative",{}).get(path)
        elif kind=="content_addressed":
            digest=pointer.get("sha256")
            if not isinstance(digest,str) or len(digest)!=64:raise EvidencePointerError("invalid content digest")
            try:bytes.fromhex(digest)
            except ValueError as exc:raise EvidencePointerError("invalid content digest") from exc
            record=catalog.get("content",{}).get(digest)
        elif kind=="archive":
            archive=pointer.get("archive_id");member=pointer.get("member")
            if not isinstance(archive,str) or not archive or not _safe(member):raise EvidencePointerError("invalid archive pointer")
            container=catalog.get("archives",{}).get(archive);record=container.get("members",{}).get(member) if isinstance(container,Mapping) else None
        elif kind=="source_line":
            sid=pointer.get("source_id");start=pointer.get("start");end=pointer.get("end")
            if not isinstance(sid,str) or not sid or not isinstance(start,int) or isinstance(start,bool) or not isinstance(end,int) or isinstance(end,bool) or start<1 or end<start:raise EvidencePointerError("invalid source line pointer")
            source=catalog.get("sources",{}).get(sid)
            if isinstance(source,Mapping) and end<=source.get("line_count",0):record={"target":source.get("target"),"status":source.get("status"),"line_range":[start,end]}
            else:record=None
        elif kind=="receipt":record=catalog.get("receipts",{}).get(pointer.get("receipt_id"))
        elif kind=="native_surface":record=catalog.get("native_surfaces",{}).get(pointer.get("surface_id"))
        else:raise EvidencePointerError("unsupported pointer type")
        if not isinstance(record,Mapping):return _result(kind,None,"BROKEN")
        status=record.get("status")
        if status not in CATALOG_STATES:raise EvidencePointerError("invalid catalog record state")
        target={key:value for key,value in record.items() if key!="status"}
        return _result(kind,target,status)
