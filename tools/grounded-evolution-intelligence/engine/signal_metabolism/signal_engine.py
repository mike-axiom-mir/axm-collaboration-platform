#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,re
from collections import defaultdict
from pathlib import Path
from typing import Any
from jsonschema import Draft202012Validator
BASE=Path(__file__).resolve().parent
TS='2026-08-08T01:36:00Z'
def canon(x:Any)->bytes:return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def digest(x:Any)->str:return 'sha256:'+hashlib.sha256(canon(x)).hexdigest()
def norm(s:str)->str:return ' '.join(s.strip().lower().split())
def short(seed:Any)->str: return hashlib.sha256(canon(seed)).hexdigest()[:24]
def validate_input(x):
    required={'occurrence_id','captured_at','source_type','source_location','source_digest','signal_type','statement','truth_state','linked_scope','assessment','derivative_candidates'}
    missing=required-set(x)
    if missing: raise ValueError(f'missing input fields: {sorted(missing)}')
    if not x['source_digest'].startswith('sha256:'): raise ValueError('source_digest required')

def build(inputs:list[dict[str,Any]])->dict[str,Any]:
    grouped=defaultdict(list)
    for x in inputs:
        validate_input(x)
        key=(norm(x['statement']),x['source_digest'],x['source_type'])
        grouped[key].append(x)
    records=[]; events=[]; prev=None; seq=1
    for key,items in sorted(grouped.items(),key=lambda kv:kv[0]):
        base=items[0]; statement_norm=norm(base['statement'])
        sid='axm:signal:'+short({'statement':statement_norm,'source_digest':base['source_digest'],'source_type':base['source_type']})
        cid='axm:signal-cluster:'+short({'statement':statement_norm})
        ass=base['assessment']; maturity={'UNASSESSED':'NORMALIZED','CORROBORATED':'CORROBORATED','DISCONFIRMED':'DISCONFIRMED','CONFLICTED':'CONFLICTED','INSUFFICIENT_DATA':'INSUFFICIENT_DATA'}[ass['state']]
        evidence=sorted(set(ass.get('evidence_refs',[])))
        derivatives=[]
        for it in items:
            for d in it.get('derivative_candidates',[]):
                if d not in derivatives: derivatives.append(d)
        components={
          'assessment_conflict':0.25 if ass['state']=='CONFLICTED' else 0.0,
          'disconfirmed_learning_value':0.15 if ass['state']=='DISCONFIRMED' else 0.0,
          'has_evidence':0.20 if evidence else 0.0,
          'has_derivative_candidate':0.20 if derivatives and not all(d['kind']=='NO_ACTION' for d in derivatives) else 0.0,
          'scope_reach':min(0.20,0.05*len(set(base['linked_scope']))),
          'duplicate_penalty':-min(0.15,0.05*(len(items)-1)),
        }
        score=round(max(0,min(1,sum(components.values()))),4)
        tier='HOT' if score>=0.65 else ('WARM' if score>=0.35 else 'COLD')
        rec={'schema':'axm.gei.signal-record/v1','signal_id':sid,'cluster_id':cid,'first_captured_at':min(x['captured_at'] for x in items),'last_captured_at':max(x['captured_at'] for x in items),'source_type':base['source_type'],'source_location':base['source_location'],'source_digest':base['source_digest'],'statement':base['statement'],'statement_digest':digest(statement_norm),'signal_type':base['signal_type'],'truth_state':base['truth_state'],'maturity_state':maturity,'linked_scope':sorted(set(x for it in items for x in it['linked_scope'])),'evidence_refs':evidence,'occurrence_count':len(items),'occurrence_ids':sorted(x['occurrence_id'] for x in items),'assessment':{'state':ass['state'],'reason':ass['reason'],'evidence_refs':evidence},'derivative_candidates':derivatives,'attention':{'components':components,'score':score,'tier':tier,'meaning':'Attention only; never truth, proof, priority, authority, or CANON.'},'authority':{'evidence_promotion':False,'need_creation':False,'direction_execution':False,'canon_authority':False,'silent_overwrite':False}}
        records.append(rec)
        for it in sorted(items,key=lambda x:x['occurrence_id']):
            payload={'occurrence_id':it['occurrence_id'],'source_digest':it['source_digest'],'statement_digest':digest(norm(it['statement']))}
            ev={'schema':'axm.gei.signal-event/v1','event_id':'axm:signal-event:'+short({'seq':seq,'sid':sid,'payload':payload}),'sequence':seq,'occurred_at':it['captured_at'],'event_type':'SIGNAL_CAPTURED','signal_id':sid,'payload':payload,'previous_event_hash':prev}; ev['event_hash']=digest(ev); prev=ev['event_hash'];events.append(ev);seq+=1
        if ass['state']!='UNASSESSED':
            payload={'state':ass['state'],'reason':ass['reason'],'evidence_refs':evidence}
            ev={'schema':'axm.gei.signal-event/v1','event_id':'axm:signal-event:'+short({'seq':seq,'sid':sid,'payload':payload}),'sequence':seq,'occurred_at':TS,'event_type':'ASSESSMENT_APPENDED','signal_id':sid,'payload':payload,'previous_event_hash':prev};ev['event_hash']=digest(ev);prev=ev['event_hash'];events.append(ev);seq+=1
        for d in derivatives:
            payload=d
            ev={'schema':'axm.gei.signal-event/v1','event_id':'axm:signal-event:'+short({'seq':seq,'sid':sid,'payload':payload}),'sequence':seq,'occurred_at':TS,'event_type':'DERIVATIVE_PROPOSED','signal_id':sid,'payload':payload,'previous_event_hash':prev};ev['event_hash']=digest(ev);prev=ev['event_hash'];events.append(ev);seq+=1
    clusters=[]
    byc=defaultdict(list)
    for r in records:byc[r['cluster_id']].append(r)
    for cid,rs in sorted(byc.items()):
        clusters.append({'schema':'axm.gei.signal-cluster/v1','cluster_id':cid,'normalized_statement':norm(rs[0]['statement']),'signal_ids':sorted(r['signal_id'] for r in rs),'occurrence_count':sum(r['occurrence_count'] for r in rs),'truth_states':sorted(set(r['truth_state'] for r in rs)),'assessment_states':sorted(set(r['assessment']['state'] for r in rs))})
    result={'schema':'axm.gei.signal-metabolism-report/v1','generated_at':TS,'unique_signals':len(records),'occurrences':sum(r['occurrence_count'] for r in records),'exact_duplicates':sum(max(0,r['occurrence_count']-1) for r in records),'signals':records,'clusters':clusters,'events':events,'signal_chain_head':prev,'truth_boundary':['Signal capture is not evidence promotion.','A disconfirmed signal remains retained and may still produce a validator, need, research, or invariant candidate.','Attention scores only bound human/machine attention; they never determine truth, priority, authority, or CANON.','Exact duplicates compact into one signal record while every occurrence remains in the append-only signal event stream.']}
    result['report_hash']=digest(result)
    return result

def validate(r):
    schemas={n:json.loads((BASE/'schemas'/n).read_text()) for n in ['signal_record.schema.json','signal_event.schema.json','signal_cluster.schema.json']}
    for x in r['signals']:Draft202012Validator(schemas['signal_record.schema.json']).validate(x)
    for x in r['events']:Draft202012Validator(schemas['signal_event.schema.json']).validate(x)
    for x in r['clusters']:Draft202012Validator(schemas['signal_cluster.schema.json']).validate(x)
    prev=None
    for i,e in enumerate(r['events'],1):
        if e['sequence']!=i:raise ValueError('non-contiguous signal event sequence')
        if e['previous_event_hash']!=prev:raise ValueError('signal chain previous hash mismatch')
        stored=e['event_hash']; c=dict(e);c.pop('event_hash')
        if stored!=digest(c):raise ValueError('signal event hash mismatch')
        prev=stored
    if prev!=r['signal_chain_head']:raise ValueError('signal chain head mismatch')
    return True

def main():
    inp=json.loads((BASE/'fixtures'/'signal_inputs.json').read_text())['signals'];r=build(inp);validate(r)
    (BASE/'generated'/'signal_metabolism_report.json').write_text(json.dumps(r,indent=2,sort_keys=True,ensure_ascii=False)+'\n')
    (BASE/'generated'/'signal_ledger.jsonl').write_text('\n'.join(json.dumps(x,sort_keys=True,ensure_ascii=False) for x in r['signals'])+'\n')
    (BASE/'generated'/'signal_events.jsonl').write_text('\n'.join(json.dumps(x,sort_keys=True,ensure_ascii=False) for x in r['events'])+'\n')
    (BASE/'generated'/'signal_clusters.json').write_text(json.dumps(r['clusters'],indent=2,sort_keys=True,ensure_ascii=False)+'\n')
    print(json.dumps({'status':'PASS','unique_signals':r['unique_signals'],'occurrences':r['occurrences'],'exact_duplicates':r['exact_duplicates'],'signal_chain_head':r['signal_chain_head'],'report_hash':r['report_hash']},indent=2))
if __name__=='__main__':main()
