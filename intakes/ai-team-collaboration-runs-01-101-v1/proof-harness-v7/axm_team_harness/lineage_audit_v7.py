from __future__ import annotations
import json, re
from pathlib import Path

def _load_jsonl(path:Path)->list[dict]:
    out=[]
    for line in path.read_text(encoding='utf-8').splitlines():
        if line.strip(): out.append(json.loads(line))
    return out
def audit_lineage(root:Path,*,expected_ids:set[str],start_run:int=1,end_run:int=101)->dict:
    errors=[]; run_paths={}
    r1=list(root.rglob('AXM_AI_TEAM_COLLABORATION_STEWARD_RUN_01_LOCAL_INTAKE.jsonl'))
    if len(r1)==1: run_paths[1]=r1[0]
    elif not r1: errors.append('RUN_1_MISSING')
    else: errors.append('RUN_1_DUPLICATE')
    for p in root.rglob('AXM_AI_TEAM_COLLABORATION_STEWARD_RUN_*_LOCAL_INTAKE.jsonl'):
        m=re.search(r'RUN_(\d+)_LOCAL_INTAKE',p.name)
        if not m: continue
        n=int(m.group(1))
        if n==1: continue
        if n in run_paths: errors.append(f'RUN_{n}_DUPLICATE')
        run_paths[n]=p
    missing=[n for n in range(start_run,end_run+1) if n not in run_paths]
    if missing: errors.append('MISSING_RUNS:'+','.join(map(str,missing)))
    bad_counts=[]; bad_ids=[]; total=0
    for n,p in sorted(run_paths.items()):
        if not(start_run<=n<=end_run): continue
        rows=_load_jsonl(p); total+=len(rows)
        if len(rows)!=len(expected_ids): bad_counts.append(n)
        ids={r.get('module_id') for r in rows}
        if ids!=expected_ids: bad_ids.append(n)
    if bad_counts: errors.append('BAD_SEED_COUNTS:'+','.join(map(str,bad_counts)))
    if bad_ids: errors.append('BAD_MODULE_IDS:'+','.join(map(str,bad_ids)))
    return {'ok':not errors,'errors':errors,'runs_found':sorted(run_paths),'run_count':len([n for n in run_paths if start_run<=n<=end_run]),'records':total}
