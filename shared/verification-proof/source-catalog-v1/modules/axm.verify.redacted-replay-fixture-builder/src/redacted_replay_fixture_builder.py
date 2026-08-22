"""Detached AXM Redacted Replay Fixture Builder v0.1.0."""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict, Mapping, Sequence
import hashlib,json
class ReplayRedactionError(ValueError):pass
PROTECTED={"password","secret","token","auth_token","access_token","refresh_token","email","phone","address","full_name"}
def _text(v:Any,f:str)->str:
 if not isinstance(v,str) or not v.strip():raise ReplayRedactionError(f"{f} must be non-empty")
 return v.strip()
def _json_safe(v:Any)->Any:
 try:return json.loads(json.dumps(v,sort_keys=True,ensure_ascii=False))
 except (TypeError,ValueError) as e:raise ReplayRedactionError("event values must be JSON-safe") from e
def _instant(v:Any)->datetime:
 if isinstance(v,(int,float)) and not isinstance(v,bool):return datetime.fromtimestamp(float(v),timezone.utc)
 if isinstance(v,str):
  try:d=datetime.fromisoformat(v.replace("Z","+00:00"))
  except ValueError as e:raise ReplayRedactionError("invalid timestamp") from e
  if d.tzinfo is None:raise ReplayRedactionError("timestamp must include timezone")
  return d.astimezone(timezone.utc)
 raise ReplayRedactionError("invalid timestamp")
class RedactedReplayFixtureBuilder:
 def __init__(self,builder_id:str,keep_fields:Sequence[str]=(),drop_fields:Sequence[str]=(),mask_fields:Sequence[str]=(),hash_fields:Sequence[str]=(),generalize_fields:Mapping[str,str]|None=None,timestamp_field:str|None="timestamp",salt:str|None=None):
  self.builder_id=_text(builder_id,"builder_id");self.keep=set(map(str,keep_fields));self.drop=set(map(str,drop_fields));self.mask=set(map(str,mask_fields));self.hash=set(map(str,hash_fields));self.generalize={str(k):_text(v,"generalize action").upper() for k,v in (generalize_fields or {}).items()};self.timestamp_field=timestamp_field
  sets=[self.keep,self.drop,self.mask,self.hash,set(self.generalize)]
  if any(sets[i]&sets[j] for i in range(len(sets)) for j in range(i+1,len(sets))):raise ReplayRedactionError("field has multiple redaction actions")
  if self.keep&PROTECTED:raise ReplayRedactionError("protected sensitive field cannot be kept")
  if self.hash and (not isinstance(salt,str) or not salt):raise ReplayRedactionError("hash fields require salt")
  if any(v not in {"TYPE_ONLY","LENGTH","BOOLEAN_PRESENT"} for v in self.generalize.values()):raise ReplayRedactionError("unsupported generalize action")
  self.salt=salt or ""
 def _generalize(self,value:Any,action:str)->Any:
  if action=="TYPE_ONLY":return {"type":type(value).__name__}
  if action=="LENGTH":return {"type":type(value).__name__,"length":len(value) if hasattr(value,"__len__") else None}
  return bool(value is not None)
 def build(self,events:Sequence[Mapping[str,Any]])->Dict[str,Any]:
  if not isinstance(events,(list,tuple)) or not events:raise ReplayRedactionError("events must be non-empty")
  safe=[_json_safe(dict(e)) if isinstance(e,Mapping) else (_ for _ in ()).throw(ReplayRedactionError("each event must be a mapping")) for e in events]
  base=None;out=[];counts={"kept":0,"dropped":0,"masked":0,"hashed":0,"generalized":0,"relative_time":0}
  for event in safe:
   row={}
   if self.timestamp_field and self.timestamp_field in event:
    instant=_instant(event[self.timestamp_field]);base=instant if base is None else base;row["relative_ms"]=int((instant-base).total_seconds()*1000);counts["relative_time"]+=1
   for key,value in event.items():
    if key==self.timestamp_field:continue
    if key in self.drop:counts["dropped"]+=1
    elif key in self.mask:row[key]="***";counts["masked"]+=1
    elif key in self.hash:
     raw=json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(",",":"));row[key+"_sha256"]=hashlib.sha256((self.salt+raw).encode()).hexdigest();counts["hashed"]+=1
    elif key in self.generalize:row[key]=self._generalize(value,self.generalize[key]);counts["generalized"]+=1
    elif key in self.keep:row[key]=value;counts["kept"]+=1
    else:counts["dropped"]+=1
   out.append(row)
  return {"schema_version":"axm.verify.redacted-replay-fixture/0.1","builder_id":self.builder_id,"events":out,"transformation_counts":counts,"default_action":"DROP","absolute_timestamps_retained":False,"deidentification_guaranteed":False,"free_text_human_review_required":bool(self.generalize),"authority":"NONE","canon":False}
