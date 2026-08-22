"""Detached AXM Behavioral Capability Coverage Mapper v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping, Sequence

class CapabilityCoverageError(ValueError): pass
class BehavioralCapabilityCoverageMapper:
    def map(self, capabilities: Sequence[Mapping[str, Any]], scenarios: Sequence[Mapping[str, Any]], *, require_proof_surface: bool = True) -> Dict[str, Any]:
        if not capabilities:
            raise CapabilityCoverageError("capabilities must not be empty")
        cap_map = {}
        for raw in capabilities:
            cid = raw.get("capability_id") if isinstance(raw,Mapping) else None
            if not isinstance(cid,str) or not cid.strip() or cid in cap_map:
                raise CapabilityCoverageError("capability_id must be unique and non-empty")
            behaviors = raw.get("required_behaviors", [])
            if isinstance(behaviors,(str,bytes)):
                raise CapabilityCoverageError("required_behaviors must be a sequence")
            cap_map[cid] = {str(item) for item in behaviors}
        normalized = []
        seen = set()
        for raw in scenarios:
            sid = raw.get("scenario_id") if isinstance(raw,Mapping) else None
            if not isinstance(sid,str) or not sid.strip() or sid in seen:
                raise CapabilityCoverageError("scenario_id must be unique and non-empty")
            caps = raw.get("capabilities", [])
            behaviors = raw.get("behaviors", [])
            surfaces = raw.get("proof_surfaces", [])
            if any(isinstance(value,(str,bytes)) for value in (caps,behaviors,surfaces)):
                raise CapabilityCoverageError("scenario fields must be sequences")
            unknown_caps = {str(item) for item in caps} - set(cap_map)
            if unknown_caps:
                raise CapabilityCoverageError("scenario references unknown capability")
            normalized.append({"scenario_id":sid,"capabilities":{str(item) for item in caps},"behaviors":{str(item) for item in behaviors},"proof_surfaces":{str(item) for item in surfaces},"verdict_state":raw.get("verdict_state","UNKNOWN")})
            seen.add(sid)
        results = {}
        for cid, required in cap_map.items():
            relevant = [item for item in normalized if cid in item["capabilities"] and item["verdict_state"] == "PASS"]
            observed = set().union(*(item["behaviors"] for item in relevant)) if relevant else set()
            surfaces = set().union(*(item["proof_surfaces"] for item in relevant)) if relevant else set()
            missing = required - observed
            if not relevant:
                state = "UNCOVERED"
            elif missing or (require_proof_surface and not surfaces):
                state = "PARTIAL"
            else:
                state = "COVERED"
            results[cid] = {"state":state,"required_behaviors":sorted(required),"observed_behaviors":sorted(observed),"missing_behaviors":sorted(missing),"proof_surfaces":sorted(surfaces),"passing_scenarios":sorted(item["scenario_id"] for item in relevant)}
        states = {item["state"] for item in results.values()}
        verdict = "PASS" if states == {"COVERED"} else "FAIL"
        return {"schema_version":"axm.verify.behavioral-capability-coverage/0.1","verdict_state":verdict,"capabilities":results,"require_proof_surface":require_proof_surface,"coverage_is_not_behavioral_correctness":True,"authority":"NONE","canon":False}
