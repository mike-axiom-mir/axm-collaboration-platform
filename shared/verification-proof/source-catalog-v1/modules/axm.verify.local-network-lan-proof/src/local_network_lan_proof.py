"""Detached AXM Local Network and LAN Proof v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping, Sequence

SCENARIOS={"discovery","pairing","authority","latency","reconnect","isolation","offline"};STATES={"PASS","FAIL","UNKNOWN","NOT_RUN"}
class LanProofError(ValueError):pass
class LocalNetworkLanProof:
    def verify(self,network_profile:Mapping[str,Any],required_scenarios:Sequence[str],observations:Sequence[Mapping[str,Any]])->Dict[str,Any]:
        nid=network_profile.get("network_id") if isinstance(network_profile,Mapping) else None;authority=network_profile.get("authority_id") if isinstance(network_profile,Mapping) else None;max_latency=network_profile.get("max_latency_ms",100) if isinstance(network_profile,Mapping) else None
        if not isinstance(nid,str) or not nid or not isinstance(authority,str) or not authority or not isinstance(max_latency,(int,float)) or max_latency<0:raise LanProofError("invalid network profile")
        required=list(required_scenarios)
        if not required or len(set(required))!=len(required) or any(x not in SCENARIOS for x in required):raise LanProofError("invalid or duplicate required scenario")
        obs={}
        for raw in observations:
            scenario=raw.get("scenario") if isinstance(raw,Mapping) else None;status=raw.get("status") if isinstance(raw,Mapping) else None
            if scenario not in required or scenario in obs or status not in STATES:raise LanProofError("invalid, duplicate, or unknown observation")
            obs[scenario]=dict(raw)
        reports=[];failures=[];unknown=[]
        for scenario in required:
            row=obs.get(scenario)
            if row is None:reports.append({"scenario":scenario,"verdict_state":"UNKNOWN","issues":["missing_observation"]});unknown.append(scenario);continue
            issues=[]
            if row["status"]=="FAIL":issues.append("reported_failure")
            if scenario=="authority" and row.get("observed_authority_id")!=authority:issues.append("authority_mismatch")
            if scenario=="latency" and (not isinstance(row.get("latency_ms"),(int,float)) or row.get("latency_ms")>max_latency):issues.append("latency_budget")
            if scenario=="offline" and network_profile.get("offline_required",False) and row.get("external_network_available") is not False:issues.append("offline_violation")
            if scenario=="isolation" and network_profile.get("isolation_required",False) and row.get("cross_network_reachable") is not False:issues.append("isolation_violation")
            state="FAIL" if issues else ("UNKNOWN" if row["status"] in {"UNKNOWN","NOT_RUN"} else "PASS")
            reports.append({"scenario":scenario,"verdict_state":state,"issues":issues})
            if state=="FAIL":failures.append(scenario)
            elif state=="UNKNOWN":unknown.append(scenario)
        verdict="FAIL" if failures else ("UNKNOWN" if unknown else "PASS")
        return {"schema_version":"axm.verify.local-network-lan-proof/0.1","verdict_state":verdict,"network_profile":dict(network_profile),"results":reports,"failures":failures,"unknown":unknown,"does_not_open_sockets":True,"observations_are_caller_supplied":True,"network_isolation_independently_measured":False,"authority":"NONE","canon":False}
