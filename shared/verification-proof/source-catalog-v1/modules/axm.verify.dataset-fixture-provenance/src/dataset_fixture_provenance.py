"""Detached AXM Dataset and Fixture Provenance Verifier v0.1.0."""
from __future__ import annotations
import re
from typing import Any,Dict,Mapping,Sequence
HEX=re.compile(r"^[0-9a-f]{64}$")
class DatasetProvenanceError(ValueError):pass
class DatasetFixtureProvenanceVerifier:
    def verify(self,record:Mapping[str,Any],expected_checksums:Mapping[str,str]|None=None)->Dict[str,Any]:
        if not isinstance(record,Mapping):raise DatasetProvenanceError("record mapping required")
        findings=[];unknown=[]
        for key in ("dataset_id","version","origins","transformations","permissions","splits","checksums","representativeness","limitations"):
            if key not in record or record[key] in (None,"",[],{}):unknown.append(key)
        checks=record.get("checksums",{})
        if checks and (not isinstance(checks,Mapping) or any(not isinstance(k,str) or not HEX.fullmatch(str(v)) for k,v in checks.items())):findings.append({"type":"INVALID_CHECKSUM_DECLARATION"})
        for name,want in (expected_checksums or {}).items():
            got=checks.get(name) if isinstance(checks,Mapping) else None
            if got!=want:findings.append({"type":"CHECKSUM_MISMATCH","subject":name,"expected":want,"observed":got})
        permission=record.get("permissions")
        if isinstance(permission,Mapping):
            state=permission.get("status")
            if state=="DENIED":findings.append({"type":"PERMISSION_DENIED"})
            elif state not in {"ALLOWED","DENIED"}:unknown.append("permissions.status")
        splits=record.get("splits")
        if isinstance(splits,Mapping):
            seen={}
            for split,ids in splits.items():
                if isinstance(ids,Sequence) and not isinstance(ids,(str,bytes)):
                    for item in ids:
                        if item in seen:findings.append({"type":"SPLIT_OVERLAP","item":item,"splits":sorted({seen[item],split})})
                        else:seen[item]=split
        verdict="FAIL" if findings else ("UNKNOWN" if unknown else "PASS")
        return {"schema_version":"axm.verify.dataset-fixture-provenance/0.1","verdict_state":verdict,"dataset_id":record.get("dataset_id"),"version":record.get("version"),"findings":findings,"unknown_fields":sorted(set(unknown)),"declared_record":dict(record),"representativeness_proven":False,"permission_legality_proven":False,"authority":"NONE","canon":False}
