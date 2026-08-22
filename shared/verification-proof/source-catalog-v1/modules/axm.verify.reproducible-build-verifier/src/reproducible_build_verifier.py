
"""Detached AXM Reproducible Build Verifier v0.1.0."""
from __future__ import annotations
from typing import Any,Dict,Mapping,Sequence
STATES={"PASS","FAIL","UNKNOWN","NOT_RUN"}
class ReproducibleBuildError(ValueError):pass
class ReproducibleBuildVerifier:
    def verify(self,builds:Sequence[Mapping[str,Any]],specified_outputs:Sequence[str]=())->Dict[str,Any]:
        if len(builds)<2:raise ReproducibleBuildError("at least two builds are required")
        rows=[];seen=set()
        for raw in builds:
            bid=raw.get("build_id") if isinstance(raw,Mapping) else None;status=raw.get("status") if isinstance(raw,Mapping) else None;outputs=raw.get("outputs") if isinstance(raw,Mapping) else None
            if not isinstance(bid,str) or not bid or bid in seen or status not in STATES or not isinstance(outputs,Mapping) or any(not isinstance(k,str) or not k or not isinstance(v,str) or not v for k,v in outputs.items()):raise ReproducibleBuildError("invalid or duplicate build")
            for key in ("source_digest","environment_digest","instructions_digest"):
                if not isinstance(raw.get(key),str) or not raw.get(key):raise ReproducibleBuildError(f"missing {key}")
            seen.add(bid);rows.append(dict(raw))
        requested=list(specified_outputs) if specified_outputs else sorted(rows[0]["outputs"])
        if not requested or any(not isinstance(x,str) or not x for x in requested) or len(set(requested))!=len(requested):raise ReproducibleBuildError("specified outputs must be unique non-empty paths")
        baseline=rows[0];mismatches=[]
        for row in rows[1:]:
            for field in ("source_digest","environment_digest","instructions_digest"):
                if row[field]!=baseline[field]:mismatches.append({"build_id":row["build_id"],"type":"context","field":field,"expected":baseline[field],"observed":row[field]})
            for path in requested:
                expected=baseline["outputs"].get(path);observed=row["outputs"].get(path)
                if expected is None or observed is None:mismatches.append({"build_id":row["build_id"],"type":"missing_output","path":path})
                elif expected!=observed:mismatches.append({"build_id":row["build_id"],"type":"output_digest","path":path,"expected":expected,"observed":observed})
        uncertain=[{"build_id":r["build_id"],"status":r["status"]} for r in rows if r["status"] in {"UNKNOWN","NOT_RUN"}]
        if any(r["status"]=="FAIL" for r in rows):mismatches.append({"type":"reported_build_failure"})
        verdict="FAIL" if mismatches else ("UNKNOWN" if uncertain else "PASS")
        return {"schema_version":"axm.verify.reproducible-build/0.1","verdict_state":verdict,"baseline_build_id":baseline["build_id"],"build_count":len(rows),"specified_outputs":requested,"mismatches":mismatches,"uncertain_builds":uncertain,"builds_executed_by_module":False,"functional_correctness_proven":False,"safety_proven":False,"authority":"NONE","canon":False}
