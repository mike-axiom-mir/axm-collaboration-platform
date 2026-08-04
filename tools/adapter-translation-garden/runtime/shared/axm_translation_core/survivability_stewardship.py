from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def build_survivability_stewardship_decision(survivability_verification: dict[str,Any], damage_verification: dict[str,Any], restore_verification: dict[str,Any], intake_verification: dict[str,Any], fixture_verification: dict[str,Any], pack_summary: dict[str,Any]) -> dict[str,Any]:
    holds=[]
    for name,evidence in [('survivability',survivability_verification),('damage',damage_verification),('restore',restore_verification),('uncertain_intake',intake_verification),('fixture_evolution',fixture_verification)]:
        if evidence.get('verdict')!='PASS': holds.append(name)
    if pack_summary.get('verified_packs')!=pack_summary.get('expected_packs') or pack_summary.get('failed_packs'): holds.append('selective_packs')
    body={'holds':holds,'decision':'READY_FOR_SELECTIVE_SURVIVABILITY_INTAKE_REVIEW' if not holds else 'HOLD','evidence':{'survivability':survivability_verification,'damage':damage_verification,'restore':restore_verification,'uncertain_intake':intake_verification,'fixture_evolution':fixture_verification,'packs':pack_summary},'automatic_failover':False,'automatic_refresh':False,'automatic_repair':False,'automatic_restore':False,'automatic_migration':False,'automatic_install':False}
    return {'schema':'axm.translation.survivability-stewardship-decision/v1',**body,'decision_sha256':_hash(body)}

def verify_survivability_stewardship_decision(decision: dict[str,Any]) -> dict[str,Any]:
    keys=('holds','decision','evidence','automatic_failover','automatic_refresh','automatic_repair','automatic_restore','automatic_migration','automatic_install'); body={k:decision.get(k) for k in keys}; errors=[]
    if _hash(body)!=decision.get('decision_sha256'): errors.append('hash')
    if any(decision.get(k) is not False for k in keys if k.startswith('automatic_')): errors.append('authority')
    if decision.get('decision')=='READY_FOR_SELECTIVE_SURVIVABILITY_INTAKE_REVIEW' and decision.get('holds'): errors.append('decision')
    return {'schema':'axm.translation.survivability-stewardship-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':errors,'bounded':True}

def survivability_stewardship_action_report(decision: dict[str,Any]) -> str:
    if decision.get('decision')=='READY_FOR_SELECTIVE_SURVIVABILITY_INTAKE_REVIEW': return 'Survivability evidence is ready for selective human intake review. No failover, repair, restore, migration, or installation occurred.'
    return 'Survivability stewardship remains on hold: '+', '.join(decision.get('holds',[]))+'.'
