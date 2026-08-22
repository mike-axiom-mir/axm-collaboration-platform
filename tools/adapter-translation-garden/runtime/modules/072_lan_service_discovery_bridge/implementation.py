from __future__ import annotations
import copy, ipaddress
from typing import Any


def _local(host: str) -> bool:
    if host.lower().endswith('.local'): return True
    try:
        ip=ipaddress.ip_address(host); return ip.is_private or ip.is_loopback or ip.is_link_local
    except ValueError: return False


def run(observations: list[dict[str, Any]], *, allowed_service_types: list[str], allowed_service_ids: list[str] | None = None, require_verified: bool = True) -> dict[str, Any]:
    types=set(allowed_service_types); ids=set(allowed_service_ids or []); approved={}; rejected=[]
    for raw in observations:
        service_id=str(raw.get('id','')); service_type=raw.get('service_type'); host=str(raw.get('host','')); reasons=[]
        if service_type not in types: reasons.append('service_type_not_allowed')
        if ids and service_id not in ids: reasons.append('service_id_not_allowed')
        if not _local(host): reasons.append('host_not_local')
        if require_verified and not raw.get('verified',False): reasons.append('not_verified')
        if reasons: rejected.append({'id':service_id,'reasons':reasons}); continue
        normalized={'id':service_id,'service_type':service_type,'host':host,'port':raw.get('port'),'txt':copy.deepcopy(raw.get('txt',{})),'capabilities':sorted(set(raw.get('capabilities',[]))),'verified':bool(raw.get('verified',False)),'observed_only':True}
        prior=approved.get(service_id)
        if prior and prior!=normalized: rejected.append({'id':service_id,'reasons':['conflicting_duplicate']}); approved.pop(service_id,None)
        elif not prior: approved[service_id]=normalized
    return {'schema':'axm.translation.lan-service-catalog/v1','verdict':'CATALOG_READY' if approved else 'NO_APPROVED_SERVICES','services':[approved[k] for k in sorted(approved)],'rejected':rejected,'network_access':False,'connected':False}
