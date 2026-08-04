from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def build_degradation_ladder(representations: list[dict[str,Any]]) -> dict[str,Any]:
    holds=[]; steps=[]
    if not representations: holds.append('no_representations')
    privacy_rank={'public':0,'internal':1,'personal':2,'sensitive':3,'secret':4}
    ordered=sorted(representations,key=lambda x:(-float(x.get('quality',0)),float(x.get('cost',0)),str(x.get('id'))))
    prev=None
    for item in ordered:
        step={'id':str(item.get('id')),'quality':float(item.get('quality',0)),'cost':float(item.get('cost',0)),'latency_ms':float(item.get('latency_ms',0)),'privacy_classification':str(item.get('privacy_classification','internal')),'proof_level':int(item.get('proof_level',0)),'losses':list(item.get('losses',[]))}
        if prev is not None:
            if step['quality']>prev['quality']: holds.append('quality_not_monotonic')
            if step['cost']>prev['cost']: holds.append('cost_not_monotonic')
            if privacy_rank.get(step['privacy_classification'],99)>privacy_rank.get(prev['privacy_classification'],99): holds.append('privacy_worsens')
            if step['proof_level']<0: holds.append('invalid_proof_level')
        steps.append(step); prev=step
    body={'steps':steps,'holds':sorted(set(holds)),'silent_fallback':False,'automatic_fallback':False,'executed':False}
    return {'schema':'axm.translation.degradation-ladder/v1',**body,'ladder_sha256':_hash(body),'decision':'REVIEWABLE_LADDER' if not holds else 'HOLD'}

def select_degradation_step(ladder: dict[str,Any], context: dict[str,Any]) -> dict[str,Any]:
    if ladder.get('decision')!='REVIEWABLE_LADDER': return {'schema':'axm.translation.degradation-selection/v1','decision':'HOLD','selected':None,'reasons':['invalid_ladder'],'automatic_apply':False,'executed':False}
    privacy_rank={'public':0,'internal':1,'personal':2,'sensitive':3,'secret':4}; max_priv=str(context.get('max_privacy_classification','secret'))
    eligible=[]
    for step in ladder.get('steps',[]):
        reasons=[]
        if step['cost']>float(context.get('max_cost',10**12)): reasons.append('cost')
        if step['latency_ms']>float(context.get('max_latency_ms',10**12)): reasons.append('latency')
        if step['quality']<float(context.get('minimum_quality',0)): reasons.append('quality')
        if step['proof_level']<int(context.get('minimum_proof_level',0)): reasons.append('proof')
        if privacy_rank.get(step['privacy_classification'],99)>privacy_rank.get(max_priv,-1): reasons.append('privacy')
        if not reasons: eligible.append(step)
    selected=eligible[0] if eligible else None
    return {'schema':'axm.translation.degradation-selection/v1','decision':'REVIEWABLE_SELECTION' if selected else 'REFUSE_NO_SAFE_STEP','selected':selected,'eligible_ids':[x['id'] for x in eligible],'reasons':[] if selected else ['no_step_satisfies_context'],'degradation_disclosed':bool(selected and selected!=ladder.get('steps',[None])[0]),'automatic_apply':False,'executed':False}

def verify_degradation_ladder(ladder: dict[str,Any]) -> dict[str,Any]:
    body={k:ladder.get(k) for k in ('steps','holds','silent_fallback','automatic_fallback','executed')}; valid=_hash(body)==ladder.get('ladder_sha256') and ladder.get('silent_fallback') is False and ladder.get('automatic_fallback') is False and ladder.get('executed') is False and ((ladder.get('decision')=='REVIEWABLE_LADDER')==(not ladder.get('holds')))
    return {'valid':valid,'verdict':'PASS' if valid else 'HOLD'}
