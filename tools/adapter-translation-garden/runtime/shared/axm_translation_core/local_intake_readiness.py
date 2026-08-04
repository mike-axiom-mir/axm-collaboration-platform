from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def build_local_intake_readiness(package_evidence: dict[str,Any], host_review: dict[str,Any], order_verification: dict[str,Any], dry_run_verification: dict[str,Any], rollback_verification: dict[str,Any], session_verification: dict[str,Any], shadow_lock_evidence: dict[str,Any]) -> dict[str,Any]:
    package_ok=bool(package_evidence.get('tests_pass')) and int(package_evidence.get('authority_violations',1))==0 and int(package_evidence.get('verified_packs',0))==int(package_evidence.get('expected_packs',-1)) and not package_evidence.get('failed_packs')
    holds=[]
    if not package_ok: holds.append('package')
    for name,item in [('order',order_verification),('dry_run',dry_run_verification),('rollback',rollback_verification),('session',session_verification)]:
        if item.get('verdict')!='PASS': holds.append(name)
    if shadow_lock_evidence.get('verdict')!='PASS' or int(shadow_lock_evidence.get('locked_count',0))!=int(shadow_lock_evidence.get('expected_locked_count',10)): holds.append('shadow_locks')
    host_verdict=host_review.get('verdict','HOST_CHECK_REQUIRED')
    if host_verdict=='HOLD': holds.append('host')
    if holds: decision='HOLD'
    elif host_verdict=='PASS': decision='READY_FOR_CONTROLLED_LOCAL_INTAKE'
    else: decision='READY_FOR_CONTROLLED_LOCAL_INTAKE_CANDIDATE'
    body={'decision':decision,'holds':sorted(set(holds)),'package_ready':package_ok,'host_verdict':host_verdict,'host_validation_required':host_verdict!='PASS','selective_staging_ready':package_ok and not holds,'direct_full_install_ready':False,'automatic_install':False,'automatic_enable':False,'automatic_merge':False,'recommended_first_batch':['axm.adapter.contract-fingerprint-service','axm.adapter.translation-loss-ambiguity-ledger','axm.adapter.allowlist-gate','axm.adapter.translation-diff-preview','axm.adapter.translation-proof-packet','axm.adapter.human-readable-translation-explainer'],'claim_boundary':'Ready means verified for controlled selective staging and review. It does not mean installed, merged, host-validated, runtime-integrated, or CANON.'}
    return {'schema':'axm.translation.local-intake-readiness/v1',**body,'readiness_sha256':_hash(body)}

def verify_local_intake_readiness(readiness: dict[str,Any]) -> dict[str,Any]:
    body={k:readiness.get(k) for k in ('decision','holds','package_ready','host_verdict','host_validation_required','selective_staging_ready','direct_full_install_ready','automatic_install','automatic_enable','automatic_merge','recommended_first_batch','claim_boundary')}; errors=[]
    if _hash(body)!=readiness.get('readiness_sha256'): errors.append('hash')
    if any(readiness.get(k) is not False for k in ('direct_full_install_ready','automatic_install','automatic_enable','automatic_merge')): errors.append('authority')
    if readiness.get('decision').startswith('READY') and readiness.get('holds'): errors.append('decision')
    if readiness.get('decision')=='READY_FOR_CONTROLLED_LOCAL_INTAKE' and readiness.get('host_verdict')!='PASS': errors.append('host')
    if readiness.get('decision')=='READY_FOR_CONTROLLED_LOCAL_INTAKE_CANDIDATE' and readiness.get('host_verdict')=='PASS': errors.append('candidate')
    return {'schema':'axm.translation.local-intake-readiness-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':errors}

def local_intake_action_report(readiness: dict[str,Any]) -> str:
    d=readiness.get('decision')
    if d=='READY_FOR_CONTROLLED_LOCAL_INTAKE': return 'Ready for controlled local intake on the validated host. No automatic installation or merge is authorized.'
    if d=='READY_FOR_CONTROLLED_LOCAL_INTAKE_CANDIDATE': return 'Package is ready for controlled local intake; run the included host check on the AXM machine before staging modules.'
    return 'Local intake is on hold: '+', '.join(readiness.get('holds',[]) or ['unknown blocker'])
