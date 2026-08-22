"""Detached AXM Golden Fixture Registry v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Iterable
import hashlib,json
CATEGORIES={"VALID","INVALID","EDGE","LEGACY","ADVERSARIAL","RECOVERY"}
class GoldenFixtureError(ValueError):pass
def _text(v:Any,f:str)->str:
 if not isinstance(v,str) or not v.strip():raise GoldenFixtureError(f"{f} must be non-empty")
 return v.strip()
class GoldenFixtureRegistry:
 def __init__(self,registry_id:str):self.registry_id=_text(registry_id,"registry_id");self._records={};self._payloads={}
 def register(self,fixture_id:str,category:str,payload:bytes,provenance:str,expected_claim_ids:Iterable[str],reviewed_by:str,review_receipt:str)->Dict[str,Any]:
  fid=_text(fixture_id,"fixture_id")
  if fid in self._records:raise GoldenFixtureError("duplicate fixture_id")
  cat=_text(category,"category").upper()
  if cat not in CATEGORIES:raise GoldenFixtureError("unsupported category")
  if not isinstance(payload,bytes):raise GoldenFixtureError("payload must be bytes")
  claims=tuple(dict.fromkeys(_text(x,"expected_claim_id") for x in expected_claim_ids))
  if not claims:raise GoldenFixtureError("expected_claim_ids cannot be empty")
  record={"fixture_id":fid,"category":cat,"sha256":hashlib.sha256(payload).hexdigest(),"size_bytes":len(payload),"provenance":_text(provenance,"provenance"),"expected_claim_ids":list(claims),"reviewed_by":_text(reviewed_by,"reviewed_by"),"review_receipt":_text(review_receipt,"review_receipt"),"immutable":True}
  self._records[fid]=record;self._payloads[fid]=bytes(payload);return json.loads(json.dumps(record))
 def get(self,fixture_id:str)->Dict[str,Any]:
  fid=_text(fixture_id,"fixture_id")
  if fid not in self._records:raise GoldenFixtureError("unknown fixture_id")
  return json.loads(json.dumps(self._records[fid]))
 def verify_payload(self,fixture_id:str,payload:bytes)->Dict[str,Any]:
  if not isinstance(payload,bytes):raise GoldenFixtureError("payload must be bytes")
  rec=self.get(fixture_id);actual=hashlib.sha256(payload).hexdigest();ok=actual==rec["sha256"] and len(payload)==rec["size_bytes"]
  return {"schema_version":"axm.verify.golden-fixture-verification/0.1","registry_id":self.registry_id,"fixture_id":rec["fixture_id"],"expected_sha256":rec["sha256"],"observed_sha256":actual,"verdict_state":"PASS" if ok else "FAIL","claim_scope":rec["expected_claim_ids"],"authority":"NONE","canon":False}
 def list(self,category:str|None=None)->list[Dict[str,Any]]:
  cat=None if category is None else _text(category,"category").upper()
  if cat is not None and cat not in CATEGORIES:raise GoldenFixtureError("unsupported category")
  return [self.get(k) for k in sorted(self._records) if cat is None or self._records[k]["category"]==cat]
 def export_manifest(self)->Dict[str,Any]:return {"schema_version":"axm.verify.golden-fixture-manifest/0.1","registry_id":self.registry_id,"fixtures":self.list(),"payloads_embedded":False,"authority":"NONE","canon":False}
