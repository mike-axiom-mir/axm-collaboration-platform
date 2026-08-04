from __future__ import annotations
from typing import Any

_ALLOWED={'validation','compatibility','resource','permission','dependency','integrity','unknown'}

def normalize_failure(*, module_id: str, stage: str, kind: str, code: str, message: str, recoverable: bool=False, evidence_refs: list[str] | None=None) -> dict[str, Any]:
    normalized=kind if kind in _ALLOWED else 'unknown'
    return {'schema':'axm.translation.failure-envelope/v1','module_id':module_id,'stage':stage,'kind':normalized,'original_kind':kind,'code':code,'message':str(message)[:1000],'recoverable':bool(recoverable),'evidence_refs':sorted(set(evidence_refs or [])),'executed':False}


def build_retry_plan(failure: dict[str, Any], *, max_attempts: int=0, base_delay_ms: int=0) -> dict[str, Any]:
    attempts=max(0,min(int(max_attempts),10)); base=max(0,min(int(base_delay_ms),60000))
    delays=[base*(2**i) for i in range(attempts)] if failure.get('recoverable') else []
    return {'schema':'axm.translation.retry-plan/v1','failure_code':failure.get('code'),'attempts':len(delays),'delay_ms':delays,'scheduled':False,'executed':False,'verdict':'PLAN_AVAILABLE' if delays else 'NO_RETRY'}


def isolation_decision(failure: dict[str, Any], *, allow_retry_kinds: list[str] | None=None) -> dict[str, Any]:
    allowed=set(allow_retry_kinds or [])
    if failure.get('kind') in {'integrity','permission','compatibility','dependency'}: verdict='QUARANTINE'
    elif failure.get('recoverable') and failure.get('kind') in allowed: verdict='RETRY_PLAN_ONLY'
    else: verdict='FAIL_CLOSED'
    return {'schema':'axm.translation.failure-isolation/v1','verdict':verdict,'failure_code':failure.get('code'),'isolated':True,'automatic_retry':False,'automatic_release':False,'executed':False}


def aggregate_failures(failures: list[dict[str, Any]]) -> dict[str, Any]:
    kinds={}
    for f in failures: kinds[f.get('kind','unknown')]=kinds.get(f.get('kind','unknown'),0)+1
    severe=any(f.get('kind') in {'integrity','permission','compatibility','dependency'} for f in failures)
    return {'schema':'axm.translation.failure-summary/v1','count':len(failures),'kinds':dict(sorted(kinds.items())),'verdict':'QUARANTINE' if severe else ('REVIEW' if failures else 'PASS'),'executed':False}
