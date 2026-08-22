from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def build_survivability_checkpoint(conflict_verification: dict[str,Any], drift_gate: dict[str,Any], availability_verification: dict[str,Any], freshness_gate: dict[str,Any], pack_summary: dict[str,Any]) -> dict[str,Any]:
    holds=[]
    if conflict_verification.get('verdict')!='PASS' or conflict_verification.get('conflicts',0): holds.append('evidence_conflicts')
    if drift_gate.get('verdict')!='PASS': holds.append('policy_drift')
    if availability_verification.get('verdict')!='PASS': holds.append('partial_availability')
    if freshness_gate.get('verdict')!='PASS': holds.append('dependency_freshness')
    if pack_summary.get('verified_packs')!=pack_summary.get('expected_packs') or pack_summary.get('failed_packs'): holds.append('selective_packs')
    body={'holds':holds,'decision':'READY_FOR_SURVIVABILITY_REVIEW' if not holds else 'HOLD','evidence':{'conflict':conflict_verification,'policy_drift':drift_gate,'availability':availability_verification,'freshness':freshness_gate,'packs':pack_summary},'automatic_failover':False,'automatic_refresh':False,'automatic_install':False}
    return {'schema':'axm.translation.survivability-checkpoint/v1',**body,'checkpoint_sha256':_hash(body)}

def verify_survivability_checkpoint(checkpoint: dict[str,Any]) -> dict[str,Any]:
    body={k:checkpoint.get(k) for k in ('holds','decision','evidence','automatic_failover','automatic_refresh','automatic_install')}; errors=[]
    if _hash(body)!=checkpoint.get('checkpoint_sha256'): errors.append('hash')
    if any(checkpoint.get(k) is not False for k in ('automatic_failover','automatic_refresh','automatic_install')): errors.append('authority')
    if checkpoint.get('decision')=='READY_FOR_SURVIVABILITY_REVIEW' and checkpoint.get('holds'): errors.append('decision')
    return {'schema':'axm.translation.survivability-checkpoint-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':errors,'bounded':True}

def survivability_action_report(checkpoint: dict[str,Any]) -> str:
    if checkpoint.get('decision')=='READY_FOR_SURVIVABILITY_REVIEW': return 'Survivability evidence is ready for detached human review. No failover, refresh, or installation occurred.'
    return 'Survivability checkpoint is on hold: '+', '.join(checkpoint.get('holds',[]))+'. No corrective action was executed.'
