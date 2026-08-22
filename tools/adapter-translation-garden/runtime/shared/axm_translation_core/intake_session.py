from __future__ import annotations
import copy,hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def _event(seq: int, event_type: str, payload: dict[str,Any], previous_sha256: str) -> dict[str,Any]:
    body={'seq':seq,'event_type':event_type,'payload':payload,'previous_sha256':previous_sha256}
    return {**body,'event_sha256':_hash(body)}

def build_intake_session_bundle(session_id: str, selected_modules: list[str], evidence_refs: list[dict[str,Any]], created_at: int) -> dict[str,Any]:
    start=_event(1,'SESSION_OPENED',{'selected_modules':sorted(set(map(str,selected_modules))),'evidence_refs':evidence_refs,'created_at':int(created_at)},'0'*64)
    body={'session_id':str(session_id),'events':[start],'closed':False,'automatic_decision':False,'automatic_action':False}
    return {'schema':'axm.translation.intake-session/v1',**body,'session_sha256':_hash(body)}

def append_intake_session_event(bundle: dict[str,Any], event_type: str, payload: dict[str,Any]) -> dict[str,Any]:
    out=copy.deepcopy(bundle); events=out.get('events',[]); prev=events[-1]['event_sha256'] if events else '0'*64
    events.append(_event(len(events)+1,str(event_type),payload,prev)); out['events']=events
    body={k:out.get(k) for k in ('session_id','events','closed','automatic_decision','automatic_action')}; out['session_sha256']=_hash(body); return out

def close_intake_session(bundle: dict[str,Any], decision: str, approved_by_human: bool) -> dict[str,Any]:
    out=append_intake_session_event(bundle,'SESSION_CLOSED',{'decision':str(decision),'approved_by_human':bool(approved_by_human)})
    out['closed']=True; body={k:out.get(k) for k in ('session_id','events','closed','automatic_decision','automatic_action')}; out['session_sha256']=_hash(body); return out

def verify_intake_session_bundle(bundle: dict[str,Any]) -> dict[str,Any]:
    errors=[]; prev='0'*64
    for i,e in enumerate(bundle.get('events',[]),1):
        body={k:e.get(k) for k in ('seq','event_type','payload','previous_sha256')}
        if e.get('seq')!=i or e.get('previous_sha256')!=prev or _hash(body)!=e.get('event_sha256'): errors.append(f'event_{i}'); break
        prev=e.get('event_sha256')
    body={k:bundle.get(k) for k in ('session_id','events','closed','automatic_decision','automatic_action')}
    if _hash(body)!=bundle.get('session_sha256'): errors.append('session_hash')
    if bundle.get('automatic_decision') is not False or bundle.get('automatic_action') is not False: errors.append('authority')
    return {'schema':'axm.translation.intake-session-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':errors,'event_count':len(bundle.get('events',[]))}
