from __future__ import annotations
from dataclasses import dataclass
@dataclass(frozen=True)
class UpstreamReceipt:
    task_id:str; accepted:bool; evidence_digest:str; fresh:bool; status:str='RETURNED'

def evaluate_join(receipts:list[UpstreamReceipt],*,required_ids:set[str])->dict:
    by={r.task_id:r for r in receipts}; missing=sorted(required_ids-set(by)); rejected=[]
    for tid in required_ids&set(by):
        r=by[tid]
        if not r.accepted or not r.evidence_digest or not r.fresh: rejected.append(tid)
    ready=not missing and not rejected
    return {'ok':ready,'status':'JOIN_READY' if ready else 'PARTIAL_VISIBLE_HELD','missing':missing,'rejected':sorted(rejected),'partial_results_preserved':sorted(by)}
