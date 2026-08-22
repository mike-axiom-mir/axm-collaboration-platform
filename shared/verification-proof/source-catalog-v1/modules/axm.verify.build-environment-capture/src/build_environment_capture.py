
"""Detached AXM Build Environment Capture v0.1.0."""
from __future__ import annotations
import hashlib,json
from typing import Any,Dict,Mapping,Sequence
class EnvironmentCaptureError(ValueError):pass
def named(rows:Sequence[Mapping[str,Any]],label:str)->list[dict[str,Any]]:
    out=[];seen=set()
    for raw in rows:
        name=raw.get("name") if isinstance(raw,Mapping) else None;version=raw.get("version") if isinstance(raw,Mapping) else None
        if not isinstance(name,str) or not name or name in seen or not isinstance(version,str) or not version:raise EnvironmentCaptureError(f"invalid or duplicate {label}")
        seen.add(name);out.append({"name":name,"version":version,**({"digest":raw["digest"]} if isinstance(raw.get("digest"),str) and raw.get("digest") else {})})
    return sorted(out,key=lambda x:x["name"])
class BuildEnvironmentCapture:
    def capture(self,runtime:Mapping[str,Any],os_info:Mapping[str,Any],architecture:str,tools:Sequence[Mapping[str,Any]],dependencies:Sequence[Mapping[str,Any]],variables:Mapping[str,Any],locale:Mapping[str,Any],path_facts:Mapping[str,Any],secret_keys:Sequence[str]=())->Dict[str,Any]:
        if not isinstance(runtime.get("name") if isinstance(runtime,Mapping) else None,str) or not runtime.get("name") or not isinstance(os_info.get("name") if isinstance(os_info,Mapping) else None,str) or not os_info.get("name") or not isinstance(architecture,str) or not architecture:raise EnvironmentCaptureError("runtime, os, and architecture are required")
        secret=set(secret_keys)
        if any(not isinstance(k,str) or not k for k in secret):raise EnvironmentCaptureError("secret keys must be non-empty strings")
        if any(not isinstance(k,str) for k in variables):raise EnvironmentCaptureError("variable names must be strings")
        safe_vars={k:("<REDACTED>" if k in secret else variables[k]) for k in sorted(variables)}
        facts={"runtime":dict(runtime),"os":dict(os_info),"architecture":architecture,"tools":named(tools,"tool"),"dependencies":named(dependencies,"dependency"),"variables":safe_vars,"locale":dict(locale),"path_facts":dict(path_facts)}
        digest=hashlib.sha256(json.dumps(facts,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()
        return {"schema_version":"axm.verify.build-environment/0.1","environment":facts,"environment_digest":f"sha256:{digest}","redacted_keys":sorted(secret),"host_inspection_performed":False,"secret_values_retained":False,"completeness_proven":False,"authority":"NONE","canon":False}
