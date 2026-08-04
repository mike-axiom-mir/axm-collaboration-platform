from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def build_capability_checkpoint(effectiveness_gate: dict[str,Any], composition_verification: dict[str,Any], simulation_gate: dict[str,Any], containment_gate: dict[str,Any], invariant_checkpoint: dict[str,Any]) -> dict[str,Any]:
    holds=[]
    if effectiveness_gate.get('decision')!='REVIEWABLE': holds.append('effectiveness')
    if composition_verification.get('verdict')!='PASS': holds.append('composition')
    if simulation_gate.get('decision')!='REVIEWABLE': holds.append('simulation')
    if containment_gate.get('decision')!='REVIEWABLE': holds.append('containment')
    if invariant_checkpoint.get('decision')!='REVIEWABLE': holds.append('invariants')
    body={'effectiveness_sha256':_hash(effectiveness_gate),'composition_sha256':_hash(composition_verification),'simulation_sha256':_hash(simulation_gate),'containment_sha256':_hash(containment_gate),'invariants_sha256':_hash(invariant_checkpoint),'holds':holds,'automatic_execution':False,'automatic_merge':False,'automatic_promotion':False}
    return {'schema':'axm.translation.capability-checkpoint/v1',**body,'checkpoint_sha256':_hash(body),'decision':'READY_FOR_BOUNDED_CAPABILITY_REVIEW' if not holds else 'HOLD'}

def verify_capability_checkpoint(checkpoint: dict[str,Any]) -> dict[str,Any]:
    body={k:checkpoint.get(k) for k in ('effectiveness_sha256','composition_sha256','simulation_sha256','containment_sha256','invariants_sha256','holds','automatic_execution','automatic_merge','automatic_promotion')}
    valid=_hash(body)==checkpoint.get('checkpoint_sha256'); coherent=(checkpoint.get('decision')=='READY_FOR_BOUNDED_CAPABILITY_REVIEW')==(not checkpoint.get('holds'))
    bounded=all(checkpoint.get(k) is False for k in ('automatic_execution','automatic_merge','automatic_promotion'))
    return {'valid':valid and coherent and bounded,'hash_valid':valid,'coherent':coherent,'bounded':bounded,'verdict':'PASS' if valid and coherent and bounded else 'HOLD'}
