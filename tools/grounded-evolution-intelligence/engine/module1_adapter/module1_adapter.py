#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, sys
from pathlib import Path
from typing import Any
from jsonschema import Draft202012Validator

BASE=Path(__file__).resolve().parent
sys.path.insert(0,str(BASE))
from materialization_state import IntakeGates, evaluate


def sha256_file(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return 'sha256:'+h.hexdigest()


def assess(profile_path: Path = BASE/'MODULE1_INTAKE_PROFILE.json', handoff_path: Path = BASE/'source/MODULE1_STABLE_INTAKE_HANDOFF.txt', bundle_path: Path|None=None) -> dict[str,Any]:
    profile=json.loads(profile_path.read_text(encoding='utf-8'))
    schema=json.loads((BASE/'schemas/module1_intake_profile.schema.json').read_text(encoding='utf-8'))
    Draft202012Validator(schema).validate(profile)
    actual_handoff_hash=sha256_file(handoff_path)
    handoff_hash_matches=actual_handoff_hash==profile['source_handoff']['sha256']

    bundle_present=bool(bundle_path and bundle_path.exists())
    state=evaluate(IntakeGates(artifact_bytes_present=bundle_present))
    result={
      'schema':'axm.gei.module1-handoff-assessment/v1',
      'profile_valid':True,
      'handoff':{
        'path':str(handoff_path),'expected_sha256':profile['source_handoff']['sha256'],
        'actual_sha256':actual_handoff_hash,'hash_matches':handoff_hash_matches,
        'authority':'Descriptive stable handoff; actual package bytes remain separately verifiable.'
      },
      'identity':profile['module'],
      'contract':profile['contract'],
      'source_snapshot':profile['source_snapshot'],
      'current_materialization_state':state,
      'corrections':[
        {'claim':'342 provider-backed targets','status':'DISCONFIRMED_AS_SEALED_PACKAGE_FACT'},
        {'claim':'689 consumer-only dependency references','status':'DISCONFIRMED_AS_SEALED_PACKAGE_FACT'},
        {'claim':'CONFIRMED is a canonical Module 1 truth token','status':'DISCONFIRMED'},
        {'claim':'The real 1,769-row registry corpus is bundled','status':'DISCONFIRMED'},
      ],
      'required_module3_adapters':[
        'external canonical ID binding without rewriting Module 1 identity',
        'two-stage package admission then local corpus materialization',
        'Module 1 truth-state namespace preservation',
        'composite evidence indexing instead of a fictional Evidence Tuple record',
        'semantic digest versus run/artifact digest separation',
        'nested ZIP payload hash and path verification',
        'receipt history preservation as Module 3-owned immutable observations',
        'provider/consumer edges kept separate from capability-to-capability edges',
        'consumer-only dependency nodes kept visibly typed as dependency references',
      ],
      'merge_claim':False,
      'runtime_proof_claim':False,
      'next_safe_action':'Verify the actual outer ZIP and nested payload bytes, then run package-only rehearsal. Do not start local materialization without explicit authorization.',
    }
    result['assessment_hash']='sha256:'+hashlib.sha256(json.dumps(result,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
    return result


def main() -> None:
    ap=argparse.ArgumentParser();ap.add_argument('--profile',type=Path,default=BASE/'MODULE1_INTAKE_PROFILE.json');ap.add_argument('--handoff',type=Path,default=BASE/'source/MODULE1_STABLE_INTAKE_HANDOFF.txt');ap.add_argument('--bundle',type=Path);ap.add_argument('--out',type=Path)
    a=ap.parse_args();r=assess(a.profile,a.handoff,a.bundle)
    if a.out:a.out.write_text(json.dumps(r,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    print(json.dumps({'profile_valid':r['profile_valid'],'handoff_hash_matches':r['handoff']['hash_matches'],'state':r['current_materialization_state']['state'],'assessment_hash':r['assessment_hash']},indent=2))
    raise SystemExit(0 if r['profile_valid'] and r['handoff']['hash_matches'] else 2)

if __name__=='__main__':main()
