from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def build_capability_stewardship_decision(capability_checkpoint: dict[str,Any], metamorphic_gate: dict[str,Any], gap_report: dict[str,Any], intake_verification: dict[str,Any], compaction_verification: dict[str,Any], pack_summary: dict[str,Any]) -> dict[str,Any]:
    holds=[]
    if capability_checkpoint.get('decision')!='READY_FOR_BOUNDED_CAPABILITY_REVIEW': holds.append('capability_checkpoint')
    if metamorphic_gate.get('decision')!='REVIEWABLE': holds.append('metamorphic')
    if gap_report.get('uncovered'): holds.append('uncovered_capabilities_visible')
    if intake_verification.get('verdict')!='PASS': holds.append('intake_batch')
    if compaction_verification.get('verdict')!='PASS': holds.append('evidence_compaction')
    if int(pack_summary.get('verified_packs',0))!=int(pack_summary.get('expected_packs',0)) or pack_summary.get('failed_packs'): holds.append('selective_packs')
    body={'capability_checkpoint_sha256':_hash(capability_checkpoint),'metamorphic_gate_sha256':_hash(metamorphic_gate),'gap_report_sha256':_hash(gap_report),'intake_verification_sha256':_hash(intake_verification),'compaction_verification_sha256':_hash(compaction_verification),'pack_summary_sha256':_hash(pack_summary),'holds':holds,'automatic_execution':False,'automatic_install':False,'automatic_merge':False,'automatic_promotion':False}
    decision='READY_FOR_SELECTIVE_CAPABILITY_INTAKE_REVIEW' if not holds else ('REVIEW_WITH_VISIBLE_GAPS' if holds==['uncovered_capabilities_visible'] else 'HOLD')
    return {'schema':'axm.translation.capability-stewardship-decision/v1',**body,'decision_sha256':_hash(body),'decision':decision}

def verify_capability_stewardship_decision(decision: dict[str,Any]) -> dict[str,Any]:
    body={k:decision.get(k) for k in ('capability_checkpoint_sha256','metamorphic_gate_sha256','gap_report_sha256','intake_verification_sha256','compaction_verification_sha256','pack_summary_sha256','holds','automatic_execution','automatic_install','automatic_merge','automatic_promotion')}
    valid=_hash(body)==decision.get('decision_sha256'); bounded=all(decision.get(k) is False for k in ('automatic_execution','automatic_install','automatic_merge','automatic_promotion'))
    expected='READY_FOR_SELECTIVE_CAPABILITY_INTAKE_REVIEW' if not decision.get('holds') else ('REVIEW_WITH_VISIBLE_GAPS' if decision.get('holds')==['uncovered_capabilities_visible'] else 'HOLD')
    coherent=decision.get('decision')==expected
    return {'valid':valid and bounded and coherent,'hash_valid':valid,'bounded':bounded,'coherent':coherent,'verdict':'PASS' if valid and bounded and coherent else 'HOLD'}

def capability_stewardship_action_report(decision: dict[str,Any]) -> str:
    if decision.get('decision')=='READY_FOR_SELECTIVE_CAPABILITY_INTAKE_REVIEW': return 'Capability evidence is ready for selective human intake review. Nothing was executed, installed, merged, or promoted.'
    if decision.get('decision')=='REVIEW_WITH_VISIBLE_GAPS': return 'Capability evidence is reviewable with explicitly visible gaps. Nothing was executed, installed, merged, or promoted.'
    return 'Capability stewardship hold: '+', '.join(map(str,decision.get('holds',[])))+'. Nothing was executed, installed, merged, or promoted.'
