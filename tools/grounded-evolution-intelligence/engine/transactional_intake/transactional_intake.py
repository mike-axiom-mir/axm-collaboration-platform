#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, sys
from pathlib import Path
from typing import Any
from jsonschema import Draft202012Validator
BASE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE/'interop_preflight'))
sys.path.insert(0,str(BASE/'transactional_intake'))
from preflight_three_module_intake_v2 import run as preflight_v2
from package_probe import probe, sha256_file
EXPECTED=['axm:module:human-capability-atlas','axm:module:human-interface-intelligence','axm:module:grounded-evolution-intelligence']

def canon(x:Any)->bytes:return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def digest(x:Any)->str:return 'sha256:'+hashlib.sha256(canon(x)).hexdigest()
def tree_digest(path:Path)->str:
    h=hashlib.sha256()
    for p in sorted(path.rglob('*')):
        if p.is_file():
            h.update(p.relative_to(path).as_posix().encode());h.update(b'\0');h.update(hashlib.sha256(p.read_bytes()).digest())
    return 'sha256:'+h.hexdigest()

def compatibility(manifests:list[dict[str,Any]], artifact_checks:list[dict[str,Any]], pf:dict[str,Any])->dict[str,Any]:
    by={m['module_id']:m for m in manifests}; checks=[]; errors=[]; warnings=[]
    def add(cid,status,subject,details):
        checks.append({'check_id':cid,'status':status,'subject':subject,'details':details})
        if status=='FAIL':errors.append(f'{cid}: {subject}')
        elif status=='WARN':warnings.append(f'{cid}: {subject}')
    versions={m['shared_contract_version'] for m in manifests}; add('shared-contract','PASS' if versions=={'0.1.0'} else 'FAIL','All modules use supported shared contract 0.1.0',sorted(versions))
    for a in artifact_checks:
        add('artifact-bytes:'+a['module_id'],'PASS' if a['hash_matches_manifest'] and a['probe']['active_merge_safe'] else 'FAIL',f"Artifact bytes and archive probe for {a['module_id']}",{'hash_matches_manifest':a['hash_matches_manifest'],'probe_blockers':a['probe']['blockers']})
    atlas=by.get(EXPECTED[0]);hii=by.get(EXPECTED[1]);gei=by.get(EXPECTED[2])
    if atlas and hii:
        miss=sorted(set(hii['references']['capability_ids'])-set(atlas['exports']['capability_ids']));add('atlas-to-interface-capabilities','PASS' if not miss else 'FAIL','Module 2 capability references resolve against Module 1 exports',miss)
    if atlas and gei:
        miss=sorted(set(gei['references']['capability_ids'])-set(atlas['exports']['capability_ids']));add('atlas-to-evolution-capabilities','PASS' if not miss else 'WARN','Module 3 capability references resolve against Module 1 exports',miss)
    if hii and gei:
        miss=sorted(set(gei['references']['interface_ids'])-set(hii['exports']['interface_ids']));add('interface-to-evolution-interfaces','PASS' if not miss else 'WARN','Module 3 interface references resolve against Module 2 exports',miss)
    for m in manifests:
        missing_modules=sorted(set(m['references']['module_ids'])-set(by));add('module-refs:'+m['module_id'],'PASS' if not missing_modules else 'WARN',f"Module references present for {m['module_id']}",missing_modules)
    add('record-collisions','PASS' if not pf['record_collisions'] else 'FAIL','No conflicting record IDs across modules',pf['record_collisions'])
    matrix={'schema':'axm.intake.compatibility-matrix/v1','modules':sorted(by),'checks':checks,'errors':errors,'warnings':warnings,'compatible':not errors}
    matrix['matrix_hash']=digest(matrix);return matrix

def run(triplet:Path)->dict[str,Any]:
    baseline={'registry_digest':tree_digest(BASE/'registry'),'phase3_event_digest':sha256_file(BASE/'event_log'/'phase3_full_events.jsonl'),'graph_digest':sha256_file(BASE/'graphs'/'full_graph.json')}
    manifests=[]; paths=[]; artifact_checks=[]
    for name in ['module1','module2','module3']:
        mpath=triplet/name/'manifest.json'; zpath=triplet/name/'package.zip'; paths.append(mpath)
        m=json.loads(mpath.read_text(encoding='utf-8'));manifests.append(m)
        pr=probe(zpath);actual=sha256_file(zpath);artifact_checks.append({'module_id':m['module_id'],'manifest_artifact_hash':m['artifact_hash'],'actual_artifact_hash':actual,'hash_matches_manifest':actual==m['artifact_hash'],'probe':pr})
    pf=preflight_v2(paths); matrix=compatibility(manifests,artifact_checks,pf)
    artifact_fail=any((not a['hash_matches_manifest']) or (not a['probe']['active_merge_safe']) for a in artifact_checks)
    if artifact_fail or pf['merge_status']=='ACTIVE_MERGE_REJECTED':status='ACTIVE_MERGE_REJECTED'
    elif pf['merge_status']=='MERGE_HOLD' or not matrix['compatible']:status='MERGE_HOLD'
    else:status='REHEARSAL_PASS'
    after={'registry_digest':tree_digest(BASE/'registry'),'phase3_event_digest':sha256_file(BASE/'event_log'/'phase3_full_events.jsonl'),'graph_digest':sha256_file(BASE/'graphs'/'full_graph.json')}
    untouched=baseline==after
    receipt={'schema':'axm.intake.transaction-receipt/v1','transaction_id':'axm:intake-transaction:'+hashlib.sha256(canon({'triplet':str(triplet),'matrix':matrix['matrix_hash']})).hexdigest()[:24],'mode':'REHEARSAL_ONLY','baseline':{'before':baseline,'after':after,'canonical_unchanged':untouched},'artifacts':artifact_checks,'preflight':{'merge_status':pf['merge_status'],'active_merge_allowed':pf['active_merge_allowed'],'report_hash':pf['report_hash'],'signal_capture_status':pf['signal_capture_status']},'compatibility_matrix_hash':matrix['matrix_hash'],'status':status,'rehearsal_passed':status=='REHEARSAL_PASS' and untouched,'commit_eligible':False,'staged_actions':pf['dry_run_merge_plan'],'rollback':{'canonical_write_performed':False,'rollback_required':False,'restore_anchor':baseline,'meaning':'Rehearsal is read-only. Failure leaves the baseline unchanged rather than requiring repair.'},'truth_boundary':['Rehearsal PASS proves byte integrity, archive probe acceptance, structural compatibility and a non-mutating stage plan only.','No Module 1 or Module 2 payload record is imported by this checkpoint.','commit_eligible remains false until real record payloads are present, staged, validated and explicitly accepted.','Rejected and held artifacts may still be retained as non-executable signal.','No execution, promotion, overwrite or CANON authority is created by this transaction receipt.']}
    receipt['receipt_hash']=digest(receipt)
    Draft202012Validator(json.loads((BASE/'transactional_intake'/'compatibility_matrix.schema.json').read_text())).validate(matrix)
    Draft202012Validator(json.loads((BASE/'transactional_intake'/'transaction_receipt.schema.json').read_text())).validate(receipt)
    return {'matrix':matrix,'receipt':receipt}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('triplet',type=Path);ap.add_argument('--out-dir',type=Path);a=ap.parse_args();r=run(a.triplet)
    if a.out_dir:
        a.out_dir.mkdir(parents=True,exist_ok=True);(a.out_dir/'compatibility_matrix.json').write_text(json.dumps(r['matrix'],indent=2,sort_keys=True)+'\n');(a.out_dir/'transaction_receipt.json').write_text(json.dumps(r['receipt'],indent=2,sort_keys=True)+'\n')
    print(json.dumps({'status':r['receipt']['status'],'rehearsal_passed':r['receipt']['rehearsal_passed'],'commit_eligible':r['receipt']['commit_eligible'],'canonical_unchanged':r['receipt']['baseline']['canonical_unchanged'],'matrix_hash':r['matrix']['matrix_hash'],'receipt_hash':r['receipt']['receipt_hash']},indent=2))
    raise SystemExit(0 if r['receipt']['rehearsal_passed'] else 2)
if __name__=='__main__':main()
