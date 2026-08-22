
"""Detached AXM SBOM and License Evidence Verifier v0.1.0."""
from __future__ import annotations
from typing import Any,Dict,Mapping
class SBOMVerifierError(ValueError):pass
class SBOMLicenseVerifier:
    def verify(self,bom:Mapping[str,Any],policy:Mapping[str,Any])->Dict[str,Any]:
        if not isinstance(bom,Mapping) or not isinstance(policy,Mapping):raise SBOMVerifierError("bom and policy must be mappings")
        comps={};findings=[]
        for raw in bom.get("components",[]):
            ref=raw.get("bom_ref") if isinstance(raw,Mapping) else None;name=raw.get("name") if isinstance(raw,Mapping) else None;version=raw.get("version") if isinstance(raw,Mapping) else None
            if not isinstance(ref,str) or not ref or ref in comps or not isinstance(name,str) or not name or not isinstance(version,str) or not version:raise SBOMVerifierError("invalid or duplicate component")
            hashes=raw.get("hashes",{});licenses=raw.get("licenses",[])
            if not isinstance(hashes,Mapping) or any(not isinstance(k,str) or not k or not isinstance(v,str) or not v for k,v in hashes.items()) or not isinstance(licenses,list) or any(not isinstance(x,str) or not x for x in licenses):raise SBOMVerifierError("invalid component hashes or licenses")
            comps[ref]=dict(raw)
        for rel in bom.get("relationships",[]):
            source=rel.get("from") if isinstance(rel,Mapping) else None;target=rel.get("to") if isinstance(rel,Mapping) else None;rtype=rel.get("type") if isinstance(rel,Mapping) else None
            if source not in comps or target not in comps or not isinstance(rtype,str) or not rtype:raise SBOMVerifierError("invalid relationship")
        denied=set(policy.get("denied_licenses",[]));required=set(policy.get("required_components",[]))
        if any(not isinstance(x,str) or not x for x in denied|required):raise SBOMVerifierError("policy lists require non-empty strings")
        require_hash=policy.get("require_hash",False)
        if not isinstance(require_hash,bool):raise SBOMVerifierError("require_hash must be boolean")
        names={row["name"] for row in comps.values()}
        for ref,row in sorted(comps.items()):
            if require_hash and not row.get("hashes"):findings.append({"type":"missing_hash","bom_ref":ref})
            blocked=sorted(set(row.get("licenses",[]))&denied)
            if blocked:findings.append({"type":"denied_license","bom_ref":ref,"licenses":blocked})
        for name in sorted(required-names):findings.append({"type":"missing_required_component","name":name})
        completeness=bom.get("complete") is True
        uncertain=[] if completeness else [{"type":"completeness_not_declared"}]
        verdict="FAIL" if findings else ("PASS" if completeness else "UNKNOWN")
        return {"schema_version":"axm.verify.sbom-license/0.1","verdict_state":verdict,"component_count":len(comps),"relationship_count":len(bom.get("relationships",[])),"findings":findings,"uncertainty":uncertain,"legal_advice_provided":False,"package_resolution_performed":False,"sbom_completeness_proven":False,"authority":"NONE","canon":False}
