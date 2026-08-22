"""Detached AXM Layout and Responsive Proof v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping, Sequence

STATES={"PASS","FAIL","UNKNOWN","NOT_RUN"}
class LayoutProofError(ValueError):pass
class LayoutResponsiveProof:
    def verify(self,viewports:Sequence[Mapping[str,Any]],observations:Sequence[Mapping[str,Any]],policy:Mapping[str,Any])->Dict[str,Any]:
        min_touch=policy.get("min_touch_px",44) if isinstance(policy,Mapping) else None;max_overflow=policy.get("max_overflow_px",0) if isinstance(policy,Mapping) else None;min_scale=policy.get("min_scale",0.5) if isinstance(policy,Mapping) else None;max_scale=policy.get("max_scale",2.0) if isinstance(policy,Mapping) else None
        if not all(isinstance(x,(int,float)) for x in (min_touch,max_overflow,min_scale,max_scale)) or min_touch<=0 or max_overflow<0 or min_scale<=0 or max_scale<min_scale:raise LayoutProofError("invalid layout policy")
        profiles={}
        for raw in viewports:
            vid=raw.get("viewport_id") if isinstance(raw,Mapping) else None;w=raw.get("width") if isinstance(raw,Mapping) else None;h=raw.get("height") if isinstance(raw,Mapping) else None
            if not isinstance(vid,str) or not vid or vid in profiles or not isinstance(w,(int,float)) or not isinstance(h,(int,float)) or w<=0 or h<=0:raise LayoutProofError("invalid or duplicate viewport")
            profiles[vid]=dict(raw)
        if not profiles:raise LayoutProofError("viewports must not be empty")
        obs={}
        for raw in observations:
            vid=raw.get("viewport_id") if isinstance(raw,Mapping) else None;status=raw.get("status") if isinstance(raw,Mapping) else None
            if vid not in profiles or vid in obs or status not in STATES:raise LayoutProofError("invalid, duplicate, or unknown observation")
            obs[vid]=dict(raw)
        reports=[];missing=[];failures=[];unknown=[]
        for vid in sorted(profiles):
            row=obs.get(vid)
            if row is None:missing.append(vid);reports.append({"viewport_id":vid,"verdict_state":"UNKNOWN","issues":["missing_observation"]});continue
            issues=[]
            if row["status"]=="FAIL":issues.append("reported_failure")
            if row.get("hidden_content"):issues.append("hidden_content")
            if float(row.get("horizontal_overflow_px",0))>max_overflow:issues.append("horizontal_overflow")
            for target in row.get("touch_targets",[]):
                if target.get("enabled",True) and (target.get("width",0)<min_touch or target.get("height",0)<min_touch):issues.append("small_touch_target");break
            if "expected_focus_order" in row and row.get("expected_focus_order")!=row.get("observed_focus_order"):issues.append("focus_order")
            scale=row.get("scale",1.0)
            if not isinstance(scale,(int,float)) or scale<min_scale or scale>max_scale:issues.append("scale")
            if "expected_breakpoint" in row and row.get("expected_breakpoint")!=row.get("observed_breakpoint"):issues.append("breakpoint")
            state="FAIL" if issues else ("UNKNOWN" if row["status"] in {"UNKNOWN","NOT_RUN"} else "PASS")
            reports.append({"viewport_id":vid,"verdict_state":state,"issues":sorted(set(issues))})
            if state=="FAIL":failures.append(vid)
            elif state=="UNKNOWN":unknown.append(vid)
        verdict="FAIL" if failures else ("UNKNOWN" if missing or unknown else "PASS")
        return {"schema_version":"axm.verify.layout-responsive-proof/0.1","verdict_state":verdict,"viewports":profiles,"results":reports,"missing_observations":missing,"failed_viewports":failures,"unknown_viewports":unknown,"does_not_render":True,"observations_are_caller_supplied":True,"authority":"NONE","canon":False}
