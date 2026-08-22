from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def build_evidence_conflict_report(items: list[dict[str,Any]], max_items: int=1024) -> dict[str,Any]:
    if not isinstance(items,list) or len(items)>max_items: raise ValueError('items must be a bounded list')
    groups: dict[str,list[dict[str,Any]]]={}; malformed=[]
    for i,item in enumerate(items):
        if not isinstance(item,dict) or not item.get('claim') or not item.get('source_id') or 'value' not in item:
            malformed.append(i); continue
        row={k:item.get(k) for k in ('claim','source_id','value','authority','verified','confidence','observed_at','superseded')}
        row['value_sha256']=_hash(item['value']); groups.setdefault(str(item['claim']),[]).append(row)
    claims=[]
    for claim,rows in sorted(groups.items()):
        hashes=sorted({r['value_sha256'] for r in rows if not r.get('superseded')})
        claims.append({'claim':claim,'evidence':rows,'active_value_hashes':hashes,'conflict':len(hashes)>1})
    body={'evidence_count':len(items),'valid_evidence_count':sum(len(x['evidence']) for x in claims),'malformed_indices':malformed,'claims':claims,'conflict_claims':[x['claim'] for x in claims if x['conflict']],'automatic_resolution':False}
    return {'schema':'axm.translation.evidence-conflict-report/v1',**body,'report_sha256':_hash(body)}

def rank_conflict_candidates(report: dict[str,Any], precedence: list[str]|None=None) -> dict[str,Any]:
    order=precedence or ['human_approved','verified_fixture','verified_observation','declared','inferred','unknown']; rank={v:i for i,v in enumerate(order)}
    reviewed=[]
    for group in report.get('claims',[]):
        rows=sorted(group.get('evidence',[]),key=lambda r:(rank.get(str(r.get('authority') or 'unknown'),len(rank)),not bool(r.get('verified')), -float(r.get('confidence') or 0),-int(r.get('observed_at') or 0),str(r.get('source_id'))))
        reviewed.append({'claim':group['claim'],'conflict':group['conflict'],'ranked_candidates':rows,'decision':'HUMAN_REVIEW_REQUIRED' if group['conflict'] else ('SINGLE_ACTIVE_VALUE' if rows else 'NO_VALID_EVIDENCE')})
    return {'schema':'axm.translation.evidence-conflict-ranking/v1','claims':reviewed,'precedence':order,'automatic_selection':False,'decision':'HOLD' if report.get('malformed_indices') or any(x['conflict'] for x in reviewed) else 'REVIEWABLE'}

def verify_evidence_conflict_report(report: dict[str,Any]) -> dict[str,Any]:
    body={k:report.get(k) for k in ('evidence_count','valid_evidence_count','malformed_indices','claims','conflict_claims','automatic_resolution')}
    errors=[]
    if _hash(body)!=report.get('report_sha256'): errors.append('hash')
    if report.get('automatic_resolution') is not False: errors.append('automatic_resolution')
    expected=sorted(x.get('claim') for x in report.get('claims',[]) if x.get('conflict'))
    if sorted(report.get('conflict_claims',[]))!=expected: errors.append('conflict_index')
    return {'schema':'axm.translation.evidence-conflict-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':errors,'conflicts':len(expected),'bounded':True}
