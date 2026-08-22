from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def evaluate_intake_under_uncertainty(candidates: list[dict[str,Any]], thresholds: dict[str,Any]|None=None) -> dict[str,Any]:
    t={'minimum_confidence':0.75,'minimum_evidence_count':2,'maximum_unknowns':0,'allow_conflicts':False,'allow_stale':False}; t.update(thresholds or {})
    reviews=[]
    for c in candidates:
        reasons=[]; confidence=c.get('confidence'); evidence=int(c.get('evidence_count',0)); unknowns=list(c.get('unknowns',[])); conflicts=list(c.get('conflicts',[])); stale=list(c.get('stale_evidence',[]))
        if confidence is None or float(confidence)<float(t['minimum_confidence']): reasons.append('confidence')
        if evidence<int(t['minimum_evidence_count']): reasons.append('evidence_count')
        if len(unknowns)>int(t['maximum_unknowns']): reasons.append('unknowns')
        if conflicts and not t['allow_conflicts']: reasons.append('conflicts')
        if stale and not t['allow_stale']: reasons.append('stale_evidence')
        reviews.append({'candidate_id':str(c.get('candidate_id')),'decision':'REVIEWABLE' if not reasons else 'HOLD','hold_reasons':reasons,'confidence':confidence,'evidence_count':evidence,'unknowns':unknowns,'conflicts':conflicts,'stale_evidence':stale})
    body={'thresholds':t,'reviews':reviews,'reviewable_candidate_ids':[r['candidate_id'] for r in reviews if r['decision']=='REVIEWABLE'],'held_candidate_ids':[r['candidate_id'] for r in reviews if r['decision']=='HOLD'],'automatic_acceptance':False}
    return {'schema':'axm.translation.uncertain-intake-review/v1',**body,'review_sha256':_hash(body)}

def build_uncertainty_budget(review: dict[str,Any]) -> dict[str,Any]:
    rows=[]
    for r in review.get('reviews',[]): rows.append({'candidate_id':r['candidate_id'],'unknown_count':len(r['unknowns']),'conflict_count':len(r['conflicts']),'stale_count':len(r['stale_evidence']),'remaining_budget':max(0,int(review['thresholds']['maximum_unknowns'])-len(r['unknowns']))})
    return {'schema':'axm.translation.uncertainty-budget/v1','candidates':rows,'automatic_acceptance':False}

def verify_uncertain_intake_review(review: dict[str,Any]) -> dict[str,Any]:
    body={k:review.get(k) for k in ('thresholds','reviews','reviewable_candidate_ids','held_candidate_ids','automatic_acceptance')}; errors=[]
    if _hash(body)!=review.get('review_sha256'): errors.append('hash')
    if review.get('automatic_acceptance') is not False: errors.append('authority')
    expected=[r['candidate_id'] for r in review.get('reviews',[]) if r['decision']=='REVIEWABLE']
    if expected!=review.get('reviewable_candidate_ids'): errors.append('reviewable_index')
    return {'schema':'axm.translation.uncertain-intake-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':errors,'bounded':True}
