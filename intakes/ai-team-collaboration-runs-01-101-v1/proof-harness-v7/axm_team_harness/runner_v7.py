from __future__ import annotations
import copy, hashlib, io, json, zipfile
from pathlib import Path
from .registry_v7 import load_registry_v7
from .runner_v6 import run_all_v6
from .decision_snapshot_v7 import DecisionSnapshot,seal_decision,validate_decision
from .receipt_auth_v7 import sign_receipt,verify_receipt
from .canonical_package_v7 import canonical_manifest,verify_manifest
from .transaction_rehearsal_v7 import prepare_transaction,commit_rehearsal,abort_rehearsal
from .invariant_bundle_v7 import build_bundle,verify_member,select_tests
from .launch_selftest_v7 import run_launch_selftest,environment_fingerprint
from .human_handoff_v7 import validate_handoff_kit
from .archive_safety_v7 import inspect_zip_bytes
from .lineage_audit_v7 import audit_lineage
from .final_gate_v7 import evaluate_final_gate,MAX_STATUS
from .scenarios_v7 import run_scenarios_v7

def _zip(entries):
    b=io.BytesIO()
    with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:
        for n,d in entries:z.writestr(n,d)
    return b.getvalue()
def _synthetic_lineage(ids:set[str],bad_run:int|None=None)->Path:
    import tempfile
    root=Path(tempfile.mkdtemp(prefix='axm_lineage_'))
    r1=root/'RUN_01_AND_SOURCE';r1.mkdir()
    for n in range(1,4):
        d=r1 if n==1 else root/f'RUNS_{n:02d}_{n:02d}'/f'RUN_{n:02d}'; d.mkdir(parents=True,exist_ok=True)
        p=d/f'AXM_AI_TEAM_COLLABORATION_STEWARD_RUN_{n:02d}_LOCAL_INTAKE.jsonl'
        use=list(ids)[:-1] if bad_run==n else list(ids)
        p.write_text(''.join(json.dumps({'module_id':m})+'\n' for m in use),encoding='utf-8')
    return root

def run_all_v7()->dict:
    reg=load_registry_v7(); entries=reg['entries']; ids=[e['module_id'] for e in entries]; counts={}
    names=['decision_valid','decision_drift_rejected','decision_self_approval_rejected','receipt_valid','receipt_tamper_rejected','receipt_revoked_rejected','canonical_valid','canonical_tamper_rejected','canonical_collision_rejected','transaction_prepared','transaction_committed','transaction_mismatch_rejected','transaction_aborted','bundle_valid','bundle_tamper_rejected','sparse_selection','root_full_selection','launch_selftest','launch_fingerprint_stable','handoff_valid','handoff_missing_rejected','handoff_auto_execute_rejected','archive_valid','archive_traversal_rejected','archive_collision_rejected','archive_ratio_rejected','lineage_complete','lineage_bad_count_rejected','lineage_missing_run_rejected','final_gate_valid','final_runtime_rejected','final_canon_rejected','final_auto_apply_rejected','final_self_approval_rejected','final_missing_evidence_rejected','final_unresolved_rejected','final_lineage_rejected','final_novelty_rejected','status_bounded','canon_false','runtime_false','more_time_false']
    counts={k:0 for k in names}; rows=[]
    cur={k:hashlib.sha256(k.encode()).hexdigest() for k in ['source','contract','policy','task','options']}
    launch=run_launch_selftest(); launch2=environment_fingerprint()
    safe_zip=_zip([('safe/file.txt','ok')]); traversal_zip=_zip([('../bad','x')]); ratio_zip=_zip([('big',b'0'*100000)])
    for e in entries:
        mid=e['module_id']; n=e['seed_number']; proof=e['proof_slice_id']; local={}
        s=DecisionSnapshot(f'd{n}','human','HUMAN','builder','accept',cur['source'],cur['contract'],cur['policy'],cur['task'],cur['options'],True); env=seal_decision(s)
        local['decision_valid']=validate_decision(env,current=cur)['ok']
        local['decision_drift_rejected']=not validate_decision(env,current={**cur,'task':'changed'})['ok']
        bad=copy.deepcopy(env);bad['snapshot']['actor_id']='builder';local['decision_self_approval_rejected']=not validate_decision(bad,current=cur)['ok']
        key=f'key-{n}'.encode(); rec=sign_receipt({'module_id':mid},key_id=f'k{n}',key=key,epoch=7000+n)
        local['receipt_valid']=verify_receipt(rec,keyring={f'k{n}':key},current_epoch=7000+n,revoked_keys=set())['ok']
        tam=copy.deepcopy(rec);tam['payload']['module_id']='x';local['receipt_tamper_rejected']=not verify_receipt(tam,keyring={f'k{n}':key},current_epoch=7000+n,revoked_keys=set())['ok']
        local['receipt_revoked_rejected']=not verify_receipt(rec,keyring={f'k{n}':key},current_epoch=7000+n,revoked_keys={f'k{n}'})['ok']
        entries_m=[{'path':f'seeds/{n:03d}.json','sha256':hashlib.sha256(mid.encode()).hexdigest(),'bytes':len(mid),'semantic_kind':'seed'}]; man=canonical_manifest(entries_m)
        local['canonical_valid']=man['ok'] and verify_manifest(man,entries_m)['ok']
        local['canonical_tamper_rejected']=not verify_manifest(man,[{**entries_m[0],'sha256':'0'*64}])['ok']
        local['canonical_collision_rejected']=not canonical_manifest([entries_m[0],{**entries_m[0],'path':entries_m[0]['path'].upper()}])['ok']
        prep=prepare_transaction([{'phase':'PROPOSE','target':mid,'irreversible':False}],manifest_digest=man['manifest_digest'],human_prepare_receipt='human-prep')
        local['transaction_prepared']=prep['ok']; local['transaction_committed']=commit_rehearsal(prep,presented_digest=prep['prepared_digest'],human_commit_receipt='human-commit')['ok']
        local['transaction_mismatch_rejected']=not commit_rehearsal(prep,presented_digest='bad',human_commit_receipt='human-commit')['ok'];local['transaction_aborted']=abort_rehearsal(prep)['ok']
        member={'module_id':mid,'invariant':e['critical_invariant'],'witness':proof}; bundle=build_bundle('authority',[member])
        local['bundle_valid']=verify_member(bundle,member)['ok'];local['bundle_tamper_rejected']=not verify_member(bundle,{**member,'witness':'tampered'})['ok']
        local['sparse_selection']=select_tests(changed_members={mid},dependency_map={mid:[]},root_risk=False,all_modules=ids)==[mid]
        local['root_full_selection']=len(select_tests(changed_members={mid},dependency_map={},root_risk=True,all_modules=ids))==100
        local['launch_selftest']=launch['ok'];local['launch_fingerprint_stable']=launch['fingerprint']==launch2
        sections={k:'x' for k in ['purpose','start','stop','rollback','truth_boundary','checksums','human_decision']}; kit={'sections':sections,'auto_execute':False,'start_file_count':1,'beginner_safe_language':True}
        local['handoff_valid']=validate_handoff_kit(kit)['ok'];badkit=copy.deepcopy(kit);badkit['sections'].pop('rollback');local['handoff_missing_rejected']=not validate_handoff_kit(badkit)['ok'];badkit2={**kit,'auto_execute':True};local['handoff_auto_execute_rejected']=not validate_handoff_kit(badkit2)['ok']
        local['archive_valid']=inspect_zip_bytes(safe_zip)['ok'];local['archive_traversal_rejected']=not inspect_zip_bytes(traversal_zip)['ok']
        coll=_zip([(f'{mid}.txt','a'),(f'{mid}.TXT','b')]);local['archive_collision_rejected']=not inspect_zip_bytes(coll)['ok'];local['archive_ratio_rejected']=not inspect_zip_bytes(ratio_zip,max_ratio=2)['ok']
        expected={mid}; goodroot=_synthetic_lineage(expected); badroot=_synthetic_lineage(expected,bad_run=2); missroot=_synthetic_lineage(expected); import shutil as _shutil; _shutil.rmtree(missroot/'RUNS_03_03')
        local['lineage_complete']=audit_lineage(goodroot,expected_ids=expected,start_run=1,end_run=3)['ok'];local['lineage_bad_count_rejected']=not audit_lineage(badroot,expected_ids=expected,start_run=1,end_run=3)['ok'];local['lineage_missing_run_rejected']=not audit_lineage(missroot,expected_ids=expected,start_run=1,end_run=3)['ok']
        import shutil;shutil.rmtree(goodroot);shutil.rmtree(badroot);shutil.rmtree(missroot)
        evidence={k:proof for k in ['decision_snapshot','receipt_auth','canonical_package','transaction_rehearsal','invariant_bundle','launch_selftest','human_handoff','archive_safety','lineage_audit','limitations','human_decision']}
        gate={'evidence':evidence,'runtime_proven':False,'canon':False,'auto_apply':False,'producer_id':'builder','approval_actor':'human','approval_actor_kind':'HUMAN','unresolved_defects':False,'lineage_complete':True,'novelty_status':'NOVEL_DELTA'}
        g=evaluate_final_gate(gate);local['final_gate_valid']=g['ok'];local['status_bounded']=g['status']==MAX_STATUS;local['canon_false']=g['canon'] is False;local['runtime_false']=g['runtime_integrated'] is False;local['more_time_false']=g['more_specification_time_needed'] is False
        for k,change in [('final_runtime_rejected',{'runtime_proven':True}),('final_canon_rejected',{'canon':True}),('final_auto_apply_rejected',{'auto_apply':True}),('final_self_approval_rejected',{'producer_id':'same','approval_actor':'same'}),('final_unresolved_rejected',{'unresolved_defects':True}),('final_lineage_rejected',{'lineage_complete':False}),('final_novelty_rejected',{'novelty_status':'NO-NOVEL-DELTA'})]: local[k]=not evaluate_final_gate({**gate,**change})['ok']
        missing=copy.deepcopy(gate);missing['evidence'].pop('archive_safety');local['final_missing_evidence_rejected']=not evaluate_final_gate(missing)['ok']
        for k,v in local.items(): counts[k]+=int(bool(v))
        rows.append({'seed_number':n,'module_id':mid,'proof_slice_id':proof,'checks':local,'passed':all(local.values()),'max_status':g['status']})
    v6=run_all_v6(); scenarios=run_scenarios_v7(); passed=all(v==100 for v in counts.values()) and all(r['passed'] for r in rows) and v6['passed'] and scenarios['passed']
    return {'harness_version':'7.0.0','passed':passed,'seed_count':100,'counts':counts,'per_seed':rows,'v6_regression_passed':v6['passed'],'scenario_suite_v7':scenarios,'max_status':MAX_STATUS,'canon':False,'axm_runtime_integrated':False}
