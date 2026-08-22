"""Detached AXM Independent Verifier Seat Router v0.1.0."""
from __future__ import annotations
from typing import Any,Dict,Mapping,Sequence
class VerifierSeatRouterError(ValueError):pass

def _strings(v:Any,field:str)->list[str]:
    if not isinstance(v,list) or any(not isinstance(x,str) or not x for x in v):raise VerifierSeatRouterError(f"{field} must be string list")
    return list(v)
class IndependentVerifierSeatRouter:
    def route(self,request:Mapping[str,Any],seats:Sequence[Mapping[str,Any]])->Dict[str,Any]:
        if not isinstance(request,Mapping) or not isinstance(seats,list):raise VerifierSeatRouterError("request mapping and seat list required")
        required=set(_strings(request.get("required_capabilities",[]),"required_capabilities"));excluded=set(_strings(request.get("excluded_seat_ids",[]),"excluded_seat_ids"));producers=set(_strings(request.get("producer_operator_ids",[]),"producer_operator_ids"));claimants=set(_strings(request.get("claimant_operator_ids",[]),"claimant_operator_ids"));domains=set(_strings(request.get("conflict_domains",[]),"conflict_domains"));independent=request.get("independence_required",True)
        if not isinstance(independent,bool):raise VerifierSeatRouterError("independence_required must be boolean")
        eligible=[];rejected=[];seen=set()
        for raw in seats:
            if not isinstance(raw,Mapping) or not isinstance(raw.get("seat_id"),str) or not raw["seat_id"] or not isinstance(raw.get("operator_id"),str) or not raw["operator_id"]:raise VerifierSeatRouterError("invalid seat")
            sid=raw["seat_id"]
            if sid in seen:raise VerifierSeatRouterError("duplicate seat_id")
            seen.add(sid);caps=set(_strings(raw.get("capabilities",[]),"capabilities"));conflicts=set(_strings(raw.get("conflict_domains",[]),"seat conflict_domains"));available=raw.get("available");load=raw.get("current_load",0)
            if not isinstance(available,bool) or isinstance(load,bool) or not isinstance(load,int) or load<0:raise VerifierSeatRouterError("invalid seat availability or load")
            reasons=[]
            if not available:reasons.append("UNAVAILABLE")
            if sid in excluded:reasons.append("EXPLICITLY_EXCLUDED")
            if not required.issubset(caps):reasons.append("MISSING_CAPABILITY")
            if conflicts&domains:reasons.append("CONFLICT_DOMAIN")
            if independent and raw["operator_id"] in producers|claimants:reasons.append("NOT_INDEPENDENT")
            if reasons:rejected.append({"seat_id":sid,"reasons":sorted(reasons)})
            else:eligible.append({"seat_id":sid,"operator_id":raw["operator_id"],"current_load":load,"capabilities":sorted(caps)})
        eligible.sort(key=lambda x:(x["current_load"],x["seat_id"]))
        return {"schema_version":"axm.verify.independent-verifier-route/0.1","eligible_seats":eligible,"rejected_seats":sorted(rejected,key=lambda x:x["seat_id"]),"recommended_seat_id":eligible[0]["seat_id"] if eligible else None,"verdict_state":"PASS" if eligible else "UNKNOWN","assignment_applied":False,"independence_relaxed":False,"authority":"NONE","canon":False}
