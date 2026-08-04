from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def build_checkpoint_consensus(checkpoints: list[dict[str,Any]], required_claims: list[str], max_checkpoints: int=32) -> dict[str,Any]:
    if not isinstance(checkpoints,list) or len(checkpoints)>max_checkpoints: raise ValueError('checkpoints must be a bounded list')
    valid=[]; invalid=[]
    for i,c in enumerate(checkpoints):
        if not isinstance(c,dict) or not c.get('checkpoint_id') or not isinstance(c.get('claims'),dict) or c.get('verified') is not True:
            invalid.append(i); continue
        valid.append({'checkpoint_id':str(c['checkpoint_id']),'lineage_depth':int(c.get('lineage_depth',0)),'observed_at':int(c.get('observed_at',0)),'claims':c['claims']})
    rows=[]; agreed={}
    for claim in sorted(set(map(str,required_claims))):
        evidence=[]
        for c in valid:
            if claim in c['claims']:
                evidence.append({'checkpoint_id':c['checkpoint_id'],'value':c['claims'][claim],'value_sha256':_hash(c['claims'][claim]),'lineage_depth':c['lineage_depth'],'observed_at':c['observed_at']})
        hashes=sorted({e['value_sha256'] for e in evidence})
        if len(evidence)<len(valid): status='MISSING'
        elif len(hashes)>1: status='CONFLICT'
        elif len(hashes)==1 and valid: status='AGREED'
        else: status='NO_EVIDENCE'
        if status=='AGREED': agreed[claim]=evidence[0]['value']
        rows.append({'claim':claim,'status':status,'evidence':evidence,'active_value_hashes':hashes})
    blockers=[r['claim'] for r in rows if r['status']!='AGREED']
    body={'checkpoint_count':len(checkpoints),'valid_checkpoint_count':len(valid),'invalid_indices':invalid,'required_claims':sorted(set(map(str,required_claims))),'claims':rows,'agreed_claims':agreed,'blockers':blockers,'majority_selection':False,'automatic_truth_selection':False,'decision':'REVIEWABLE_CONVERGENCE' if valid and not blockers and not invalid else 'HOLD'}
    return {'schema':'axm.translation.checkpoint-consensus/v1',**body,'report_sha256':_hash(body)}

def verify_checkpoint_consensus(report: dict[str,Any]) -> dict[str,Any]:
    body={k:report.get(k) for k in ('checkpoint_count','valid_checkpoint_count','invalid_indices','required_claims','claims','agreed_claims','blockers','majority_selection','automatic_truth_selection','decision')}
    errors=[]
    if _hash(body)!=report.get('report_sha256'): errors.append('hash')
    expected=sorted(r.get('claim') for r in report.get('claims',[]) if r.get('status')!='AGREED')
    if sorted(report.get('blockers',[]))!=expected: errors.append('blockers')
    if report.get('majority_selection') is not False or report.get('automatic_truth_selection') is not False: errors.append('authority')
    if report.get('decision')=='REVIEWABLE_CONVERGENCE' and (expected or report.get('invalid_indices') or not report.get('valid_checkpoint_count')): errors.append('decision')
    return {'schema':'axm.translation.checkpoint-consensus-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':errors,'claim_count':len(report.get('claims',[]))}

def checkpoint_consensus_action_report(report: dict[str,Any]) -> str:
    if report.get('decision')=='REVIEWABLE_CONVERGENCE': return f"Verified convergence across {report.get('valid_checkpoint_count',0)} checkpoints. Human review is still required."
    return 'Hold checkpoint convergence review: '+', '.join(report.get('blockers',[]) or ['invalid or missing checkpoint evidence'])
