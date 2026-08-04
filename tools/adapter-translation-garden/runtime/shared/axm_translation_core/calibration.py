from __future__ import annotations
from typing import Any

def build_calibration_report(observations: list[dict[str,Any]], bins: int=10) -> dict[str,Any]:
    if bins<2 or bins>50: raise ValueError('bins')
    valid=[]; invalid=[]
    for i,o in enumerate(observations):
        c=o.get('confidence'); outcome=o.get('outcome')
        if isinstance(c,bool) or not isinstance(c,(int,float)) or float(c)<0 or float(c)>1 or outcome not in (0,1,False,True): invalid.append(i); continue
        valid.append((float(c),1 if outcome else 0))
    buckets=[]; ece=0.0; brier=0.0
    for b in range(bins):
        low=b/bins; high=(b+1)/bins; members=[x for x in valid if low<=x[0]<(high if b<bins-1 else high+1e-12)]
        if not members: continue
        avg_conf=sum(x[0] for x in members)/len(members); accuracy=sum(x[1] for x in members)/len(members); gap=abs(avg_conf-accuracy); ece+=gap*len(members)/max(1,len(valid)); buckets.append({'low':low,'high':high,'count':len(members),'average_confidence':round(avg_conf,8),'accuracy':round(accuracy,8),'gap':round(gap,8)})
    if valid: brier=sum((c-y)**2 for c,y in valid)/len(valid)
    return {'schema':'axm.translation.confidence-calibration-report/v1','valid_observations':len(valid),'invalid_observation_indices':invalid,'bins':buckets,'expected_calibration_error':round(ece,8),'brier_score':round(brier,8),'uncertainty_preserved':True,'runtime_prediction_performed':False}

def calibrate_confidence(raw_confidence: float, report: dict[str,Any]) -> dict[str,Any]:
    if isinstance(raw_confidence,bool) or not isinstance(raw_confidence,(int,float)) or not 0<=float(raw_confidence)<=1: raise ValueError('raw_confidence')
    bins=report.get('bins',[]); matching=[b for b in bins if b['low']<=float(raw_confidence)<b['high'] or (float(raw_confidence)==1 and b['high']==1)]
    if not matching: return {'schema':'axm.translation.calibrated-confidence/v1','raw_confidence':float(raw_confidence),'calibrated_confidence':None,'decision':'INSUFFICIENT_EVIDENCE','automatic_decision':False}
    b=matching[-1]
    return {'schema':'axm.translation.calibrated-confidence/v1','raw_confidence':float(raw_confidence),'calibrated_confidence':b['accuracy'],'bin_count':b['count'],'calibration_gap':b['gap'],'decision':'EVIDENCE_CALIBRATED','automatic_decision':False}

def calibration_gate(report: dict[str,Any], max_ece: float=0.15, minimum_observations: int=20) -> dict[str,Any]:
    holds=[]
    if int(report.get('valid_observations',0))<minimum_observations: holds.append('insufficient_observations')
    if float(report.get('expected_calibration_error',1))>max_ece: holds.append('calibration_error_high')
    if report.get('invalid_observation_indices'): holds.append('invalid_observations_present')
    return {'schema':'axm.translation.calibration-gate/v1','decision':'REVIEWABLE' if not holds else 'HOLD','holds':holds,'automatic_confidence_override':False}
