
"""Detached AXM Source-to-Artifact Provenance Builder v0.1.0."""
from __future__ import annotations
import hashlib,json
from typing import Any,Dict,Mapping,Sequence
class ProvenanceBuilderError(ValueError):pass
def canon(v:Any)->str:return json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False)
def records(rows:Sequence[Mapping[str,Any]],label:str)->list[dict[str,Any]]:
    out=[];seen=set()
    for raw in rows:
        name=raw.get("name") if isinstance(raw,Mapping) else None;digest=raw.get("digest") if isinstance(raw,Mapping) else None
        if not isinstance(name,str) or not name or name in seen or not isinstance(digest,str) or not digest:raise ProvenanceBuilderError(f"invalid or duplicate {label}")
        seen.add(name);out.append({"name":name,"digest":digest})
    return sorted(out,key=lambda x:x["name"])
class SourceArtifactProvenanceBuilder:
    def build(self,subjects:Sequence[Mapping[str,Any]],materials:Sequence[Mapping[str,Any]],builder:Mapping[str,Any],configuration:Mapping[str,Any],environment:Mapping[str,Any],activity:Mapping[str,Any])->Dict[str,Any]:
        subs=records(subjects,"subject");mats=records(materials,"material")
        if not subs:raise ProvenanceBuilderError("at least one subject is required")
        builder_id=builder.get("id") if isinstance(builder,Mapping) else None;activity_type=activity.get("type") if isinstance(activity,Mapping) else None
        if not isinstance(builder_id,str) or not builder_id or not isinstance(activity_type,str) or not activity_type:raise ProvenanceBuilderError("builder id and activity type are required")
        statement={"schema_version":"axm.verify.source-artifact-provenance/0.1","subjects":subs,"materials":mats,"builder":dict(builder),"configuration":dict(configuration),"environment":dict(environment),"activity":dict(activity),"declarations_are_caller_supplied":True,"activity_occurrence_proven":False,"builder_identity_authenticated":False,"authority":"NONE","canon":False}
        sealed=dict(statement);sealed["statement_id"]="sha256:"+hashlib.sha256(canon(statement).encode()).hexdigest();return sealed
