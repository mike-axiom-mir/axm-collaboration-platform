#!/usr/bin/env python3
from __future__ import annotations
import argparse,hashlib,json,sys
from pathlib import Path
from typing import Any
BASE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE/'interop_preflight'))
from preflight_three_module_intake import preflight as v1_preflight

def canon(x:Any)->bytes:return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def digest(x:Any)->str:return 'sha256:'+hashlib.sha256(canon(x)).hexdigest()
def file_digest(p:Path)->str:return 'sha256:'+hashlib.sha256(p.read_bytes()).hexdigest()

def run(paths:list[Path])->dict[str,Any]:
    v1=v1_preflight(paths)
    captures=[]
    for p in paths:
        raw=p.read_bytes(); readable=True; module_id=None
        try: module_id=json.loads(raw.decode('utf-8')).get('module_id')
        except Exception: readable=False
        captures.append({'path':p.name,'artifact_digest':file_digest(p),'readable_json':readable,'module_id':module_id,'active_merge_authority':False,'signal_only':True})
    errs=v1['errors']
    collision_only=bool(v1['record_collisions']) and all(('collision' in e.lower() or 'silent overwrite' in e.lower()) for e in errs)
    if v1['acceptance_passed']: merge_status='MERGE_READY'
    elif collision_only: merge_status='MERGE_HOLD'
    else: merge_status='ACTIVE_MERGE_REJECTED'
    result={'schema':'axm.three-module-intake-preflight-report/v2','generated_at':'2026-08-08T01:36:00Z','v1_report_hash':v1['report_hash'],'merge_status':merge_status,'active_merge_allowed':merge_status=='MERGE_READY','signal_capture_status':'CAPTURED_PRECANONICAL','signal_sidecar':captures,'errors':errs,'warnings':v1['warnings'],'record_collisions':v1['record_collisions'],'dry_run_merge_plan':v1['dry_run_merge_plan'],'truth_boundary':['Active merge and signal capture are separate outcomes.','A rejected or held package can still contribute non-executable intake metadata as signal.','Signal capture never grants execution, evidence promotion, overwrite, or CANON authority.','The v1 structural report remains intact and is referenced by digest.']}
    result['report_hash']=digest(result);return result

def main():
    ap=argparse.ArgumentParser();ap.add_argument('manifests',nargs=3,type=Path);ap.add_argument('--out',type=Path);a=ap.parse_args();r=run(a.manifests)
    if a.out:a.out.write_text(json.dumps(r,indent=2,sort_keys=True)+'\n')
    print(json.dumps({'merge_status':r['merge_status'],'active_merge_allowed':r['active_merge_allowed'],'signal_capture_status':r['signal_capture_status'],'report_hash':r['report_hash']},indent=2))
    raise SystemExit(0 if r['active_merge_allowed'] else 2)
if __name__=='__main__':main()
