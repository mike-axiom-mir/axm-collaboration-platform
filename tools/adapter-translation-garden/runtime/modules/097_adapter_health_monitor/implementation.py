from __future__ import annotations
from typing import Any


def run(adapter_id: str, observations: list[dict[str, Any]], *, now_epoch: float, stale_after_seconds: float = 300.0, max_failure_rate: float = 0.2, max_latency_ms: float = 1000.0, max_pressure: float = 0.9) -> dict[str, Any]:
    if not observations: return {'verdict':'NO_DATA','adapter_id':adapter_id,'status':'unknown','actions_performed':[]}
    ordered=sorted(observations,key=lambda x:float(x.get('timestamp_epoch',0))); latest=ordered[-1]; total=len(ordered); failures=sum(not bool(x.get('ok',False)) for x in ordered); failure_rate=failures/total
    latencies=[float(x['latency_ms']) for x in ordered if x.get('latency_ms') is not None]; avg_latency=sum(latencies)/len(latencies) if latencies else None
    pressure=max([float(x.get('resource_pressure',0)) for x in ordered] or [0]); drift=any(bool(x.get('contract_drift',False)) for x in ordered); verified=bool(latest.get('verified',False)); age=float(now_epoch)-float(latest.get('timestamp_epoch',0))
    reasons=[]
    if drift: reasons.append('contract_drift')
    if age>stale_after_seconds: reasons.append('stale')
    if failure_rate>max_failure_rate: reasons.append('failure_rate')
    if avg_latency is not None and avg_latency>max_latency_ms: reasons.append('latency')
    if pressure>max_pressure: reasons.append('resource_pressure')
    if not verified: reasons.append('latest_not_verified')
    if 'contract_drift' in reasons: status='drifted'
    elif 'stale' in reasons: status='stale'
    elif 'failure_rate' in reasons: status='unhealthy'
    elif reasons: status='degraded'
    else: status='healthy'
    return {'schema':'axm.translation.adapter-health/v1','verdict':'CLASSIFIED','adapter_id':adapter_id,'status':status,'reasons':reasons,'metrics':{'samples':total,'failure_rate':round(failure_rate,6),'average_latency_ms':avg_latency,'max_resource_pressure':pressure,'age_seconds':age,'verified':verified},'actions_performed':[],'polled':False}
