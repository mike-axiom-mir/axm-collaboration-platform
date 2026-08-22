#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, sys
from collections import defaultdict
from pathlib import Path
from typing import Any
from jsonschema import Draft202012Validator

BASE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE/'module1_adapter'))
from semantic_identity import classify_pair

ROLES={'HUMAN_CAPABILITY_ATLAS','HUMAN_INTERFACE_INTELLIGENCE','GROUNDED_EVOLUTION_INTELLIGENCE'}
EXPECTED_M1='axm.module.human_capability_atlas'
CAP_SCHEMA='sha256:c63d2c5d4b0ae7aeb8754a5a006a1efd2364c330ad18b74064d74ec7428a71b3'
IFACE_SCHEMA='sha256:b85e9916f599d2c469b00ea91b12bc3de1e7cd3cceedcd226340fad6dd636e4f'

def canon(x:Any)->bytes:return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def digest(x:Any)->str:return 'sha256:'+hashlib.sha256(canon(x)).hexdigest()

def load(path:Path,schema:dict)->tuple[dict[str,Any]|None,list[str]]:
    try:obj=json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc:return None,[f'{path.name}: unreadable JSON: {exc}']
    errs=[f'{path.name}: {e.message}' for e in Draft202012Validator(schema).iter_errors(obj)]
    return obj,errs

def run(paths:list[Path])->dict[str,Any]:
    schema=json.loads((BASE/'interop_preflight/intake_manifest_v2.schema.json').read_text(encoding='utf-8'))
    errors=[];warnings=[];checks=[];manifests=[]
    def add(cid,status,subject,details):
        checks.append({'check_id':cid,'status':status,'subject':subject,'details':details})
        if status=='FAIL':errors.append(f'{cid}: {subject}')
        elif status in {'WARN','DEFERRED'}:warnings.append(f'{cid}: {subject}')
    for p in paths:
        obj,errs=load(p,schema);errors+=errs
        if obj:manifests.append(obj)
    by_role={m['module_role']:m for m in manifests}
    if len(by_role)!=len(manifests):errors.append('Duplicate module_role across intake manifests.')
    missing=sorted(ROLES-set(by_role));extra=sorted(set(by_role)-ROLES)
    if missing:errors.append(f'Missing module roles: {missing}')
    if extra:errors.append(f'Unexpected module roles: {extra}')
    add('role-set','PASS' if not missing and not extra else 'FAIL','Exactly one manifest for each three-module role',{'missing':missing,'extra':extra})

    m1=by_role.get('HUMAN_CAPABILITY_ATLAS');m2=by_role.get('HUMAN_INTERFACE_INTELLIGENCE');m3=by_role.get('GROUNDED_EVOLUTION_INTELLIGENCE')
    if m1:
        add('module1-canonical-id','PASS' if m1['canonical_module_id']==EXPECTED_M1 else 'FAIL','Module 1 canonical ID matches the stable handoff',m1['canonical_module_id'])
    contracts={(m['shared_contract']['id'],m['shared_contract']['version'],m['shared_contract']['compatibility']) for m in manifests}
    add('shared-contract','PASS' if contracts=={('axm.capability-interface-contract','0.1.0','EXACT_ONLY')} else 'FAIL','Shared contract is exact-only 0.1.0',sorted(contracts))
    cap_hashes={m['shared_contract']['capability_record_schema_sha256'] for m in manifests}
    iface_hashes={m['shared_contract']['interface_recommendation_schema_sha256'] for m in manifests}
    add('shared-capability-schema','PASS' if cap_hashes=={CAP_SCHEMA} else 'FAIL','Capability Record schema hash matches the stable anchor',sorted(cap_hashes))
    add('interface-recommendation-schema','PASS' if iface_hashes=={IFACE_SCHEMA} else 'FAIL','Interface Recommendation schema hash matches the stable anchor',sorted(iface_hashes))
    for m in manifests:
        if any(m['authority'].values()):errors.append(f"{m['module_role']}: forbidden authority requested")
        add('authority:'+m['module_role'],'PASS' if not any(m['authority'].values()) else 'FAIL',f"No automatic authority requested by {m['module_role']}",m['authority'])

    materialization_required=False
    if m1:
        materialization_required=(m1['payload_mode']=='PREINTAKE_SOFTWARE' or not m1['materialization']['real_registry_run'] or not m1['materialization']['corpus_bundled'])
        add('module1-materialization','DEFERRED' if materialization_required else 'PASS',
            'Module 1 corpus materialization state',m1['materialization'])
        if not m1['materialization']['source_commit_captured']:
            add('module1-source-commit','WARN','Module 1 source commit is unknown and must not be invented',m1['materialization']['source_commit'])

    if m1 and m2:
        if m1['exports']['deferred_until_materialization']:
            add('atlas-to-interface-capabilities','DEFERRED','Module 2 capability resolution waits for real Module 1 materialization',m2['references']['capability_ids'])
        else:
            miss=sorted(set(m2['references']['capability_ids'])-set(m1['exports']['capability_ids']))
            add('atlas-to-interface-capabilities','PASS' if not miss else 'FAIL','Module 2 capability references resolve against Module 1 exports',miss)
    if m1 and m3:
        if m1['exports']['deferred_until_materialization']:
            add('atlas-to-evolution-capabilities','DEFERRED','Module 3 capability resolution waits for real Module 1 materialization',m3['references']['capability_ids'])
        else:
            miss=sorted(set(m3['references']['capability_ids'])-set(m1['exports']['capability_ids']))
            add('atlas-to-evolution-capabilities','PASS' if not miss else 'WARN','Module 3 capability references resolve against Module 1 exports',miss)
    if m2 and m3:
        if m2['exports']['deferred_until_materialization']:
            add('interface-to-evolution-interfaces','DEFERRED','Module 3 interface resolution waits for Module 2 materialization',m3['references']['interface_ids'])
        else:
            miss=sorted(set(m3['references']['interface_ids'])-set(m2['exports']['interface_ids']))
            add('interface-to-evolution-interfaces','PASS' if not miss else 'WARN','Module 3 interface references resolve against Module 2 exports',miss)

    known_ids={m['canonical_module_id'] for m in manifests}|{m['local_reference_id'] for m in manifests if m['local_reference_id']}
    for m in manifests:
        missing_refs=sorted(set(m['references']['module_ids'])-known_ids)
        add('module-refs:'+m['module_role'],'PASS' if not missing_refs else 'WARN',f"Module references resolve for {m['module_role']}",missing_refs)

    generic=defaultdict(list);caps=defaultdict(list)
    for m in manifests:
        for r in m['record_inventory']:
            item={**r,'module_role':m['module_role']}
            if r['kind']=='capability-record' and r['capability_id']:caps[r['capability_id']].append(item)
            else:generic[r['record_id']].append(item)
    collisions=[];plan=[]
    for rid,items in sorted(generic.items()):
        ds={x['artifact_digest'] for x in items};ks={x['kind'] for x in items}
        if len(items)>1 and (len(ds)>1 or len(ks)>1):
            collisions.append({'record_id':rid,'classification':'generic_conflict','items':items});plan.append({'record_id':rid,'action':'CONFLICT_HOLD'})
        elif len(items)>1:plan.append({'record_id':rid,'action':'IDENTICAL_SHARED'})
        else:plan.append({'record_id':rid,'action':'ADD'})
    for cid,items in sorted(caps.items()):
        if len(items)==1:plan.append({'record_id':items[0]['record_id'],'action':'ADD'});continue
        for i in range(len(items)):
            for k in range(i+1,len(items)):
                a={'capability_id':items[i]['capability_id'],'capability_revision':items[i]['capability_revision'],'normalized_source_semantic_sha256':items[i]['semantic_digest'],'capability_card_canonical_sha256':items[i]['artifact_digest']}
                b={'capability_id':items[k]['capability_id'],'capability_revision':items[k]['capability_revision'],'normalized_source_semantic_sha256':items[k]['semantic_digest'],'capability_card_canonical_sha256':items[k]['artifact_digest']}
                c=classify_pair(a,b)
                if c['merge_hold']:collisions.append({'record_id':cid,'classification':c['classification'],'items':[items[i],items[k]]})
                plan.append({'record_id':cid,'action':c['recommended_action'],'classification':c['classification']})
    add('record-collisions','PASS' if not collisions else 'FAIL','No unresolved record collisions',collisions)

    non_collision_errors=[e for e in errors if not e.startswith('record-collisions:')]
    if non_collision_errors:status='ACTIVE_INTAKE_REJECTED'
    elif collisions:status='MERGE_HOLD'
    elif materialization_required:status='PACKAGE_REHEARSAL_PASS_MATERIALIZATION_REQUIRED'
    else:status='CORPUS_REHEARSAL_PASS'
    result={
      'schema':'axm.three-module-intake-preflight-report/v3','status':status,
      'package_admission_allowed':status!='ACTIVE_INTAKE_REJECTED',
      'materialization_required':materialization_required,
      'merge_review_allowed':status=='CORPUS_REHEARSAL_PASS',
      'active_merge_allowed':False,
      'checks':checks,'errors':errors,'warnings':warnings,'record_collisions':collisions,'staged_plan':plan,
      'module_roles':sorted(by_role),'canonical_module_ids':sorted(m['canonical_module_id'] for m in manifests),
      'truth_boundary':[
        'Package admission is not corpus materialization.',
        'Deferred cross-module checks are not silently counted as PASS.',
        'A full-card digest difference is not a semantic conflict when the semantic digest is unchanged.',
        'No preflight result executes Module 1, promotes proof, merges state or grants CANON authority.'
      ]
    }
    result['report_hash']=digest(result);return result

def main():
    ap=argparse.ArgumentParser();ap.add_argument('manifests',nargs=3,type=Path);ap.add_argument('--out',type=Path);a=ap.parse_args();r=run(a.manifests)
    if a.out:a.out.write_text(json.dumps(r,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    print(json.dumps({'status':r['status'],'package_admission_allowed':r['package_admission_allowed'],'materialization_required':r['materialization_required'],'merge_review_allowed':r['merge_review_allowed'],'report_hash':r['report_hash']},indent=2))
    code=0 if r['status'] in {'PACKAGE_REHEARSAL_PASS_MATERIALIZATION_REQUIRED','CORPUS_REHEARSAL_PASS'} else (3 if r['status']=='MERGE_HOLD' else 2)
    raise SystemExit(code)

if __name__=='__main__':main()
