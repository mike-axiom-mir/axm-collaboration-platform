from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def simulate_evidence_aging(records: list[dict[str,Any]], start_time: int, horizons: list[int], max_records: int=2048) -> dict[str,Any]:
    if len(records)>max_records: raise ValueError('too many records')
    snapshots=[]
    for offset in sorted(set(int(x) for x in horizons)):
        t=int(start_time)+offset; rows=[]
        for r in records:
            rid=str(r.get('evidence_id','')); observed=int(r.get('observed_at',0)); max_age=r.get('max_age_seconds'); expires=r.get('expires_at'); required=bool(r.get('required',True))
            if not rid: state='UNKNOWN'
            elif observed>t: state='FUTURE'
            elif expires is not None and int(expires)<=t: state='EXPIRED'
            elif max_age is not None and t-observed>int(max_age): state='STALE'
            else: state='FRESH'
            rows.append({'evidence_id':rid,'state':state,'required':required,'age_seconds':None if observed>t else t-observed})
        snapshots.append({'offset_seconds':offset,'time':t,'records':rows,'required_holds':sorted(x['evidence_id'] for x in rows if x['required'] and x['state']!='FRESH')})
    body={'start_time':int(start_time),'horizons':sorted(set(int(x) for x in horizons)),'snapshots':snapshots,'clock_read':False,'records_mutated':False}
    return {'schema':'axm.translation.evidence-aging-simulation/v1',**body,'simulation_sha256':_hash(body)}

def evidence_aging_gate(simulation: dict[str,Any], allowed_optional_states: list[str]|None=None) -> dict[str,Any]:
    holds=[]
    for s in simulation.get('snapshots',[]):
        if s.get('required_holds'): holds.append({'offset_seconds':s.get('offset_seconds'),'evidence_ids':s.get('required_holds')})
    return {'schema':'axm.translation.evidence-aging-gate/v1','verdict':'PASS' if not holds else 'HOLD','holds':holds,'allowed_optional_states':sorted(set(allowed_optional_states or ['STALE','EXPIRED'])),'automatic_refresh':False,'network_access':False}

def verify_evidence_aging_simulation(simulation: dict[str,Any]) -> dict[str,Any]:
    body={k:simulation.get(k) for k in ('start_time','horizons','snapshots','clock_read','records_mutated')}; errors=[]
    if _hash(body)!=simulation.get('simulation_sha256'): errors.append('hash')
    if simulation.get('clock_read') is not False or simulation.get('records_mutated') is not False: errors.append('side_effect')
    for snap in simulation.get('snapshots',[]):
        expected=sorted(x.get('evidence_id') for x in snap.get('records',[]) if x.get('required') and x.get('state')!='FRESH')
        if sorted(snap.get('required_holds',[]))!=expected: errors.append('required_holds'); break
    return {'schema':'axm.translation.evidence-aging-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':errors}
