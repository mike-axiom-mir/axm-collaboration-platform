#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json
from collections import defaultdict
from pathlib import Path
from typing import Any
from jsonschema import Draft202012Validator

BASE=Path(__file__).resolve().parents[1]
EXPECTED={
 'axm:module:human-capability-atlas',
 'axm:module:human-interface-intelligence',
 'axm:module:grounded-evolution-intelligence'
}
SUPPORTED_CONTRACT='0.1.0'

def canon(x:Any)->bytes:return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def digest(x:Any)->str:return 'sha256:'+hashlib.sha256(canon(x)).hexdigest()

def load_manifest(path:Path,schema:dict)->tuple[dict|None,list[str]]:
    try: obj=json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:return None,[f'{path.name}: unreadable JSON: {exc}']
    errs=[f"{path.name}: {e.message}" for e in Draft202012Validator(schema).iter_errors(obj)]
    return obj,errs

def preflight(paths:list[Path])->dict[str,Any]:
    schema=json.loads((BASE/'interop_preflight/intake_manifest.schema.json').read_text())
    errors=[]; warnings=[]; manifests=[]
    for p in paths:
        obj,errs=load_manifest(p,schema); errors+=errs
        if obj: manifests.append(obj)
    by_id={m['module_id']:m for m in manifests}
    if len(by_id)!=len(manifests): errors.append('Duplicate module_id across intake manifests.')
    missing=sorted(EXPECTED-set(by_id)); extra=sorted(set(by_id)-EXPECTED)
    if missing: errors.append(f'Missing required modules: {missing}')
    if extra: errors.append(f'Unexpected module identities in three-module intake: {extra}')
    for m in manifests:
        if m['shared_contract_version']!=SUPPORTED_CONTRACT:
            errors.append(f"{m['module_id']}: shared contract {m['shared_contract_version']} is unsupported; migration required.")
        if m['source_kind']!='REAL_PACKAGE':
            errors.append(f"{m['module_id']}: source_kind {m['source_kind']} is not an implementation import.")
        if any(m['authority'].values()):
            errors.append(f"{m['module_id']}: intake manifest requests forbidden authority.")
    if len({m['artifact_hash'] for m in manifests}) != len(manifests):
        errors.append('Two or more module packages expose the same package artifact hash; confirm this is not accidental aliasing.')

    # Contract-specific cross-module references.
    atlas=by_id.get('axm:module:human-capability-atlas')
    hii=by_id.get('axm:module:human-interface-intelligence')
    gei=by_id.get('axm:module:grounded-evolution-intelligence')
    if atlas and hii:
        unresolved=sorted(set(hii['references']['capability_ids'])-set(atlas['exports']['capability_ids']))
        if unresolved: errors.append(f'Module 2 references capability IDs not exported by Module 1: {unresolved}')
    if atlas and gei:
        unknown=sorted(set(gei['references']['capability_ids'])-set(atlas['exports']['capability_ids']))
        if unknown: warnings.append(f'Module 3 references capability IDs not present in this Module 1 intake manifest: {unknown}')
    if hii and gei:
        known_interfaces=set(hii['exports']['interface_ids'])
        unresolved=sorted(set(gei['references']['interface_ids'])-known_interfaces)
        if unresolved: warnings.append(f'Module 3 interface references not exported by Module 2 yet: {unresolved}')

    # No silent overwrite: same record id is allowed only when all digests are identical.
    inventory=defaultdict(list)
    for m in manifests:
        for r in m['record_inventory']:
            inventory[r['record_id']].append({'module_id':m['module_id'],'kind':r['kind'],'digest':r['digest']})
    collisions=[]; shared_identical=[]; plan=[]
    for rid,items in sorted(inventory.items()):
        digests={x['digest'] for x in items}; kinds={x['kind'] for x in items}
        if len(items)>1 and (len(digests)>1 or len(kinds)>1):
            collisions.append({'record_id':rid,'items':items,'resolution':'HOLD_FOR_EXPLICIT_CONFLICT_REVIEW'})
            plan.append({'record_id':rid,'action':'CONFLICT_HOLD','sources':[x['module_id'] for x in items]})
        elif len(items)>1:
            shared_identical.append({'record_id':rid,'digest':items[0]['digest'],'sources':[x['module_id'] for x in items]})
            plan.append({'record_id':rid,'action':'IDENTICAL_SHARED','sources':[x['module_id'] for x in items]})
        else:
            plan.append({'record_id':rid,'action':'ADD','sources':[items[0]['module_id']]})
    if collisions: errors.append(f'{len(collisions)} record ID collision(s) require explicit conflict review; silent overwrite is forbidden.')

    result={
      'schema':'axm.three-module-intake-preflight-report/v1','generated_at':'2026-08-08T01:24:00Z',
      'supported_contract_version':SUPPORTED_CONTRACT,'manifests_checked':len(manifests),
      'module_ids':sorted(by_id),'errors':errors,'warnings':warnings,
      'record_collisions':collisions,'identical_shared_records':shared_identical,
      'dry_run_merge_plan':plan,
      'acceptance_passed':not errors,
      'truth_boundary':[
        'Preflight never writes canonical registry state.',
        'Acceptance proves structural intake compatibility only, not runtime correctness or semantic completeness.',
        'Warnings remain visible; conflicts never resolve by last-writer-wins.',
        'Execution and CANON authority remain false for every intake package.'
      ]
    }
    result['report_hash']=digest(result)
    return result

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('manifests',nargs=3,type=Path); ap.add_argument('--out',type=Path)
    a=ap.parse_args(); r=preflight(a.manifests)
    if a.out: a.out.write_text(json.dumps(r,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    print(json.dumps({'status':'PASS' if r['acceptance_passed'] else 'FAIL','errors':r['errors'],'warnings':r['warnings'],'report_hash':r['report_hash']},indent=2))
    raise SystemExit(0 if r['acceptance_passed'] else 2)
if __name__=='__main__':main()
