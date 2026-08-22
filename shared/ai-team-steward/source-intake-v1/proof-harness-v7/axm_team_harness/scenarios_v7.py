from __future__ import annotations
import hashlib, io, json, zipfile
from .decision_snapshot_v7 import DecisionSnapshot,seal_decision,validate_decision
from .receipt_auth_v7 import sign_receipt,verify_receipt
from .canonical_package_v7 import canonical_manifest
from .transaction_rehearsal_v7 import prepare_transaction,commit_rehearsal
from .invariant_bundle_v7 import build_bundle,verify_member
from .human_handoff_v7 import validate_handoff_kit
from .archive_safety_v7 import inspect_zip_bytes
from .final_gate_v7 import evaluate_final_gate

def _zip(entries):
    b=io.BytesIO()
    with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:
        for n,d in entries: z.writestr(n,d)
    return b.getvalue()
def run_scenarios_v7()->dict:
    out=[]
    cur={k:hashlib.sha256(k.encode()).hexdigest() for k in ['source','contract','policy','task','options']}
    s=DecisionSnapshot('d','human','HUMAN','builder','yes',cur['source'],cur['contract'],cur['policy'],cur['task'],cur['options'],True)
    out.append(('decision_drift_rejected',not validate_decision(seal_decision(s),current={**cur,'policy':'changed'})['ok']))
    env=sign_receipt({'x':1},key_id='k1',key=b'secret',epoch=2)
    out.append(('rotated_key_rejected',not verify_receipt(env,keyring={'k1':b'secret'},current_epoch=3,revoked_keys={'k1'})['ok']))
    d='0'*64; out.append(('unicode_collision_rejected',not canonical_manifest([{'path':'caf\u00e9.txt','sha256':d},{'path':'cafe\u0301.txt','sha256':d}])['ok']))
    p=prepare_transaction([{'phase':'PROPOSE','target':'x','irreversible':False}],manifest_digest='m',human_prepare_receipt='h')
    out.append(('transaction_digest_mismatch_rejected',not commit_rehearsal(p,presented_digest='bad',human_commit_receipt='h2')['ok']))
    m={'module_id':'a','invariant':'i','witness':'w'}; b=build_bundle('authority',[m]); out.append(('bundle_tamper_rejected',not verify_member(b,{**m,'witness':'x'})['ok']))
    kit={'sections':{k:'x' for k in ['purpose','start','stop','truth_boundary','checksums','human_decision']},'auto_execute':False,'start_file_count':1,'beginner_safe_language':True}
    out.append(('handoff_missing_rollback_rejected',not validate_handoff_kit(kit)['ok']))
    out.append(('archive_traversal_rejected',not inspect_zip_bytes(_zip([('../x','y')]))['ok']))
    out.append(('archive_ratio_rejected',not inspect_zip_bytes(_zip([('x',b'0'*100000)]),max_ratio=2)['ok']))
    evidence={k:'x' for k in ['decision_snapshot','receipt_auth','canonical_package','transaction_rehearsal','invariant_bundle','launch_selftest','human_handoff','archive_safety','lineage_audit','limitations','human_decision']}
    bad={'evidence':evidence,'runtime_proven':False,'canon':False,'auto_apply':True,'producer_id':'p','approval_actor':'h','approval_actor_kind':'HUMAN','unresolved_defects':False,'lineage_complete':True,'novelty_status':'NOVEL_DELTA'}
    out.append(('final_gate_auto_apply_rejected',not evaluate_final_gate(bad)['ok']))
    bad2={**bad,'auto_apply':False,'producer_id':'same','approval_actor':'same'}
    out.append(('final_gate_self_approval_rejected',not evaluate_final_gate(bad2)['ok']))
    return {'scenario_count':len(out),'passed':all(v for _,v in out),'scenarios':[{'name':n,'passed':v} for n,v in out]}
