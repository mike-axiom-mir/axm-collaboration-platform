from __future__ import annotations
import hashlib, json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def build_stewardship_decision(longevity: dict[str, Any], merge_gate: dict[str, Any], fixture_gate: dict[str, Any], recovery: dict[str, Any], pack_recovery_summary: dict[str, Any]) -> dict[str, Any]:
    holds=[]
    if longevity.get('verdict')!='PASS': holds.append('longevity')
    if merge_gate.get('decision')!='ALLOW_MANUAL_MERGE_REVIEW': holds.append('merge_gate')
    if fixture_gate.get('decision')!='REVIEWABLE': holds.append('fixture_adequacy')
    if recovery.get('decision')!='READY_FOR_HUMAN_RECOVERY_REVIEW': holds.append('recovery')
    if pack_recovery_summary.get('verified_packs')!=pack_recovery_summary.get('expected_packs') or pack_recovery_summary.get('failed_packs'): holds.append('pack_recovery')
    body={'longevity_sha256':_hash(longevity),'merge_gate_sha256':_hash(merge_gate),'fixture_gate_sha256':_hash(fixture_gate),'recovery_sha256':_hash(recovery),'pack_recovery_sha256':_hash(pack_recovery_summary),'holds':holds,'automatic_install':False,'automatic_merge':False,'automatic_restore':False}
    return {'schema':'axm.translation.stewardship-decision/v1',**body,'decision_sha256':_hash(body),'decision':'READY_FOR_SELECTIVE_HUMAN_REVIEW' if not holds else 'HOLD'}

def verify_stewardship_decision(decision: dict[str, Any]) -> dict[str, Any]:
    body={k:decision.get(k) for k in ('longevity_sha256','merge_gate_sha256','fixture_gate_sha256','recovery_sha256','pack_recovery_sha256','holds','automatic_install','automatic_merge','automatic_restore')}
    valid=_hash(body)==decision.get('decision_sha256')
    coherent=(decision.get('decision')=='READY_FOR_SELECTIVE_HUMAN_REVIEW')==(not decision.get('holds'))
    return {'valid':valid and coherent,'hash_valid':valid,'coherent':coherent,'verdict':'PASS' if valid and coherent else 'HOLD'}

def stewardship_action_report(decision: dict[str, Any]) -> str:
    if decision.get('decision')=='READY_FOR_SELECTIVE_HUMAN_REVIEW': return 'Evidence is ready for selective human review. Nothing was installed, merged, restored, or promoted.'
    return 'Stewardship hold: '+', '.join(map(str,decision.get('holds',[])))+'. Nothing was installed, merged, restored, or promoted.'
