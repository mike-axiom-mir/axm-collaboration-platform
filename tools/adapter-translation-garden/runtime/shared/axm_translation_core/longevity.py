from __future__ import annotations
import hashlib, json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def build_longevity_checkpoint(source_drift: dict[str, Any], reproducibility: dict[str, Any], freshness: dict[str, Any], deprecation_states: list[dict[str, Any]]) -> dict[str, Any]:
    holds=[]
    if source_drift.get('verdict')!='PASS': holds.append('source_drift')
    if reproducibility.get('verdict')!='PASS': holds.append('reproducibility')
    if freshness.get('verdict')!='PASS': holds.append('evidence_freshness')
    blocking=[x.get('module_id') for x in deprecation_states if x.get('phase')=='SUNSET_REACHED' and x.get('removal_readiness')!='REVIEWABLE']
    if blocking: holds.append('sunset_blocked')
    body={'source_drift_sha256':_hash(source_drift),'reproducibility_sha256':_hash(reproducibility),'freshness_sha256':_hash(freshness),'deprecation_states_sha256':_hash(deprecation_states),'holds':holds,'blocking_sunset_modules':blocking,'automatic_merge':False}
    return {'schema':'axm.translation.longevity-checkpoint/v1',**body,'checkpoint_sha256':_hash(body),'verdict':'PASS' if not holds else 'HOLD'}

def verify_longevity_checkpoint(checkpoint: dict[str, Any]) -> dict[str, Any]:
    body={k:checkpoint.get(k) for k in ('source_drift_sha256','reproducibility_sha256','freshness_sha256','deprecation_states_sha256','holds','blocking_sunset_modules','automatic_merge')}
    valid=_hash(body)==checkpoint.get('checkpoint_sha256')
    coherent=(checkpoint.get('verdict')=='PASS')==(not checkpoint.get('holds'))
    return {'valid':valid and coherent,'hash_valid':valid,'coherent':coherent,'verdict':'PASS' if valid and coherent else 'HOLD'}

def longevity_action_report(checkpoint: dict[str, Any]) -> str:
    if checkpoint.get('verdict')=='PASS': return 'Longevity evidence is reviewable. No merge, install, or retirement occurred.'
    return 'Longevity hold: '+', '.join(map(str,checkpoint.get('holds',[])))+'. No merge, install, or retirement occurred.'
