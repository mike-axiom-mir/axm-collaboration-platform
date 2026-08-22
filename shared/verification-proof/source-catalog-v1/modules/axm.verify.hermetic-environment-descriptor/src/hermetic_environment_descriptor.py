"""Detached AXM Hermetic Test Environment Descriptor v0.1.0."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Mapping
import hashlib, json, math

NETWORK_STATES={"OFFLINE","LOOPBACK_ONLY","ALLOWLISTED","OPEN"}
class EnvironmentDescriptorError(ValueError):pass
def _text(v:Any,f:str)->str:
 if not isinstance(v,str) or not v.strip():raise EnvironmentDescriptorError(f"{f} must be a non-empty string")
 return v.strip()
def _unique(values:Iterable[str],field:str)->tuple[str,...]:
 vals=tuple(_text(x,field) for x in values)
 if len(vals)!=len(set(vals)):raise EnvironmentDescriptorError(f"duplicate {field}")
 return tuple(sorted(vals))
def _limits(values:Mapping[str,float|int])->tuple[tuple[str,float],...]:
 if not isinstance(values,Mapping):raise EnvironmentDescriptorError("resource_limits must be a mapping")
 out=[]
 for k,v in values.items():
  key=_text(k,"resource_limit key")
  if not isinstance(v,(int,float)) or isinstance(v,bool) or not math.isfinite(v) or v<0:raise EnvironmentDescriptorError("invalid resource limit")
  out.append((key,float(v)))
 return tuple(sorted(out))
@dataclass(frozen=True)
class HermeticEnvironmentDescriptor:
 descriptor_id:str
 runtime:str
 os_name:str
 architecture:str
 dependencies:tuple[str,...]
 tools:tuple[str,...]
 permissions:tuple[str,...]
 network_state:str
 resource_limits:tuple[tuple[str,float],...]
 locale:str="C"
 timezone:str="UTC"
 working_directory_policy:str="ISOLATED_TEMP"
 def __post_init__(self):
  for f in ("descriptor_id","runtime","os_name","architecture","locale","timezone","working_directory_policy"):object.__setattr__(self,f,_text(getattr(self,f),f))
  object.__setattr__(self,"dependencies",_unique(self.dependencies,"dependency"));object.__setattr__(self,"tools",_unique(self.tools,"tool"));object.__setattr__(self,"permissions",_unique(self.permissions,"permission"))
  ns=_text(self.network_state,"network_state").upper()
  if ns not in NETWORK_STATES:raise EnvironmentDescriptorError("unsupported network_state")
  object.__setattr__(self,"network_state",ns);object.__setattr__(self,"resource_limits",_limits(dict(self.resource_limits)))
 @classmethod
 def from_mapping(cls,data:Mapping[str,Any]):
  return cls(data["descriptor_id"],data["runtime"],data.get("os_name",data.get("os")),data["architecture"],tuple(data.get("dependencies",())),tuple(data.get("tools",())),tuple(data.get("permissions",())),data["network_state"],tuple(dict(data.get("resource_limits",{})).items()),data.get("locale","C"),data.get("timezone","UTC"),data.get("working_directory_policy","ISOLATED_TEMP"))
 def canonical_payload(self)->Dict[str,Any]:
  return {"schema_version":"axm.verify.hermetic-environment/0.1","descriptor_id":self.descriptor_id,"runtime":self.runtime,"os_name":self.os_name,"architecture":self.architecture,"dependencies":list(self.dependencies),"tools":list(self.tools),"permissions":list(self.permissions),"network_state":self.network_state,"resource_limits":dict(self.resource_limits),"locale":self.locale,"timezone":self.timezone,"working_directory_policy":self.working_directory_policy}
 def digest(self)->str:
  raw=json.dumps(self.canonical_payload(),sort_keys=True,separators=(",",":"),ensure_ascii=False).encode();return hashlib.sha256(raw).hexdigest()
 def compare(self,observed:"HermeticEnvironmentDescriptor")->Dict[str,Any]:
  if not isinstance(observed,HermeticEnvironmentDescriptor):raise EnvironmentDescriptorError("observed must be a HermeticEnvironmentDescriptor")
  a=self.canonical_payload();b=observed.canonical_payload();ignore={"descriptor_id","schema_version"};m={k:{"expected":a[k],"observed":b[k]} for k in a if k not in ignore and a[k]!=b[k]}
  return {"schema_version":"axm.verify.hermetic-environment-comparison/0.1","expected_descriptor_id":self.descriptor_id,"observed_descriptor_id":observed.descriptor_id,"expected_digest":self.digest(),"observed_digest":observed.digest(),"mismatches":m,"verdict_state":"PASS" if not m else "FAIL","hermetic_execution_proven":False,"authority":"NONE","canon":False}
