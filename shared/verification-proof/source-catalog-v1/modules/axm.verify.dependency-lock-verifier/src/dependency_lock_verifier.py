"""Detached AXM Exact Dependency Lock Verifier v0.1.0."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Sequence
import re
HEX64=re.compile(r"^[0-9a-f]{64}$")
class DependencyLockError(ValueError):pass
def _text(v:Any,f:str)->str:
 if not isinstance(v,str) or not v.strip():raise DependencyLockError(f"{f} must be non-empty")
 return v.strip()
@dataclass(frozen=True)
class LockEntry:
 identity:str;version:str;source:str;sha256:str;dependencies:tuple[str,...]=()
 def __post_init__(self):
  for f in ("identity","version","source"):object.__setattr__(self,f,_text(getattr(self,f),f))
  digest=_text(self.sha256,"sha256").lower()
  if not HEX64.fullmatch(digest):raise DependencyLockError("sha256 must be 64 lowercase hexadecimal characters")
  deps=tuple(sorted(_text(x,"dependency") for x in self.dependencies))
  if len(deps)!=len(set(deps)):raise DependencyLockError("duplicate transitive dependency")
  if self.identity in deps:raise DependencyLockError("self dependency")
  object.__setattr__(self,"sha256",digest);object.__setattr__(self,"dependencies",deps)
 @classmethod
 def from_mapping(cls,d):return cls(d["identity"],d["version"],d["source"],d["sha256"],tuple(d.get("dependencies",())))
 def payload(self):return {"identity":self.identity,"version":self.version,"source":self.source,"sha256":self.sha256,"dependencies":list(self.dependencies)}
class DependencyLockVerifier:
 def __init__(self,verifier_id:str):self.verifier_id=_text(verifier_id,"verifier_id")
 def _index(self,entries:Sequence[LockEntry],field:str):
  if not isinstance(entries,(list,tuple)) or not all(isinstance(x,LockEntry) for x in entries):raise DependencyLockError(f"{field} must contain LockEntry values")
  ids=[x.identity for x in entries]
  if len(ids)!=len(set(ids)):raise DependencyLockError(f"duplicate dependency identity in {field}")
  return {x.identity:x for x in entries}
 def verify(self,reviewed_lock:Sequence[LockEntry],resolved:Sequence[LockEntry])->Dict[str,Any]:
  expected=self._index(reviewed_lock,"reviewed_lock");actual=self._index(resolved,"resolved")
  missing=sorted(set(expected)-set(actual));unexpected=sorted(set(actual)-set(expected));mismatches=[]
  for ident in sorted(set(expected)&set(actual)):
   a=expected[ident].payload();b=actual[ident].payload();diff={k:{"expected":a[k],"observed":b[k]} for k in ("version","source","sha256","dependencies") if a[k]!=b[k]}
   if diff:mismatches.append({"identity":ident,"fields":diff})
  ok=not missing and not unexpected and not mismatches
  return {"schema_version":"axm.verify.dependency-lock-receipt/0.1","verifier_id":self.verifier_id,"reviewed_count":len(expected),"resolved_count":len(actual),"missing":missing,"unexpected":unexpected,"mismatches":mismatches,"verdict_state":"PASS" if ok else "FAIL","dependency_safety_proven":False,"authority":"NONE","canon":False}
