from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def build_adaptive_stewardship_decision(scenario_verification: dict[str,Any], policy_gate: dict[str,Any], degradation_verification: dict[str,Any], interop_gate: dict[str,Any], calibration_gate: dict[str,Any], counterfactual_verification: dict[str,Any], mutation_gate: dict[str,Any], admission_verification: dict[str,Any], delta_verification: dict[str,Any], pack_summary: dict[str,Any]) -> dict[str,Any]:
    holds=[]
    checks=[('scenario',scenario_verification.get('verdict')=='PASS'),('policy',policy_gate.get('verdict')=='PASS' and policy_gate.get('bounded')),('degradation',degradation_verification.get('verdict')=='PASS'),('interoperability',interop_gate.get('decision')=='REVIEWABLE'),('calibration',calibration_gate.get('decision')=='REVIEWABLE'),('counterfactual',counterfactual_verification.get('verdict')=='PASS'),('mutation',mutation_gate.get('decision')=='REVIEWABLE'),('admission',admission_verification.get('verdict')=='PASS'),('evidence_delta',delta_verification.get('verdict')=='PASS')]
    holds.extend(name for name,ok in checks if not ok)
    if int(pack_summary.get('verified_packs',0))!=int(pack_summary.get('expected_packs',0)) or pack_summary.get('failed_packs'): holds.append('selective_packs')
    body={'evidence_hashes':{'scenario':_hash(scenario_verification),'policy':_hash(policy_gate),'degradation':_hash(degradation_verification),'interoperability':_hash(interop_gate),'calibration':_hash(calibration_gate),'counterfactual':_hash(counterfactual_verification),'mutation':_hash(mutation_gate),'admission':_hash(admission_verification),'evidence_delta':_hash(delta_verification),'packs':_hash(pack_summary)},'holds':holds,'automatic_execution':False,'automatic_dispatch':False,'automatic_allocation':False,'automatic_install':False,'automatic_merge':False,'automatic_promotion':False}
    return {'schema':'axm.translation.adaptive-stewardship-decision/v1',**body,'decision_sha256':_hash(body),'decision':'READY_FOR_SELECTIVE_ADAPTIVE_INTAKE_REVIEW' if not holds else 'HOLD'}

def verify_adaptive_stewardship_decision(decision: dict[str,Any]) -> dict[str,Any]:
    body={k:decision.get(k) for k in ('evidence_hashes','holds','automatic_execution','automatic_dispatch','automatic_allocation','automatic_install','automatic_merge','automatic_promotion')}; hash_valid=_hash(body)==decision.get('decision_sha256'); bounded=all(decision.get(k) is False for k in ('automatic_execution','automatic_dispatch','automatic_allocation','automatic_install','automatic_merge','automatic_promotion')); coherent=(decision.get('decision')=='READY_FOR_SELECTIVE_ADAPTIVE_INTAKE_REVIEW')==(not decision.get('holds'))
    valid=hash_valid and bounded and coherent
    return {'valid':valid,'hash_valid':hash_valid,'bounded':bounded,'coherent':coherent,'verdict':'PASS' if valid else 'HOLD'}

def adaptive_stewardship_action_report(decision: dict[str,Any]) -> str:
    if decision.get('decision')=='READY_FOR_SELECTIVE_ADAPTIVE_INTAKE_REVIEW': return 'Adaptive evidence is ready for selective human review. No route, fallback, conversion, allocation, installation, merge, or promotion occurred.'
    return 'Adaptive stewardship hold: '+', '.join(map(str,decision.get('holds',[])))+'. No route, fallback, conversion, allocation, installation, merge, or promotion occurred.'
