
"""Detached AXM SLSA Expectation Verifier v0.1.0."""
from __future__ import annotations
from typing import Any,Dict,Mapping
STATES={"PASS","FAIL","UNKNOWN","NOT_RUN"}
class SLSAExpectationError(ValueError):pass
class SLSAExpectationVerifier:
    def verify(self,provenance:Mapping[str,Any],expectations:Mapping[str,Any])->Dict[str,Any]:
        if not isinstance(provenance,Mapping) or not isinstance(expectations,Mapping):raise SLSAExpectationError("provenance and expectations must be mappings")
        status=provenance.get("verification_status")
        if status not in STATES:raise SLSAExpectationError("invalid provenance verification status")
        mismatches=[]
        def allowed(field,allowed_values):
            if allowed_values is None:return
            if not isinstance(allowed_values,list) or any(not isinstance(x,str) or not x for x in allowed_values):raise SLSAExpectationError(f"{field} expectations must be strings")
            if provenance.get(field) not in allowed_values:mismatches.append({"field":field,"expected_one_of":allowed_values,"observed":provenance.get(field)})
        allowed("builder_id",expectations.get("allowed_builder_ids"));allowed("source_uri",expectations.get("allowed_source_uris"));allowed("build_type",expectations.get("allowed_build_types"))
        ext=provenance.get("external_parameters",{})
        if not isinstance(ext,Mapping):raise SLSAExpectationError("external_parameters must be a mapping")
        allowed_params=expectations.get("allowed_external_parameters")
        if allowed_params is not None:
            if not isinstance(allowed_params,list) or any(not isinstance(x,str) or not x for x in allowed_params):raise SLSAExpectationError("allowed_external_parameters must be strings")
            unexpected=sorted(set(ext)-set(allowed_params))
            if unexpected:mismatches.append({"field":"external_parameters","unexpected":unexpected})
        deps=provenance.get("dependency_digests",{})
        required=expectations.get("required_dependency_digests",{})
        if not isinstance(deps,Mapping) or not isinstance(required,Mapping):raise SLSAExpectationError("dependency digests must be mappings")
        for name,digest in required.items():
            if deps.get(name)!=digest:mismatches.append({"field":"dependency_digest","dependency":name,"expected":digest,"observed":deps.get(name)})
        if expectations.get("require_complete") is True and provenance.get("complete") is not True:mismatches.append({"field":"complete","expected":True,"observed":provenance.get("complete")})
        if status=="FAIL":mismatches.append({"field":"verification_status","observed":"FAIL"})
        verdict="FAIL" if mismatches else ("PASS" if status=="PASS" else "UNKNOWN")
        return {"schema_version":"axm.verify.slsa-expectation/0.1","verdict_state":verdict,"mismatches":mismatches,"verification_status":status,"slsa_level_assigned":False,"provenance_authentication_performed":False,"provenance_truth_proven":False,"authority":"NONE","canon":False}
