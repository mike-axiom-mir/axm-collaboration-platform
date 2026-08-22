#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, sys
from pathlib import Path
from jsonschema import Draft202012Validator

BASE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE/'module1_adapter'));sys.path.insert(0,str(BASE/'interop_preflight'))
from module1_adapter import assess
from nested_bundle_probe import probe_module1_bundle
from semantic_identity import classify_pair
from preflight_three_module_intake_v3 import run as preflight_v3

EXPECTED={
 'registry':'sha256:47ca9512ced3d25be1de8a89e22f00a19ae92c5875a06b03628303336ae5d22c',
 'phase3_events':'sha256:f48d9328c3b38b74e90577bf6c3a9b1bd726a4a5727b2621fedc734d98c94415',
 'graph':'sha256:8b1c74c2c4ef49623f0972f68e5a3fadb40b94dacba201af0d929cb51b7e4850'
}

def fhash(p:Path)->str:return 'sha256:'+hashlib.sha256(p.read_bytes()).hexdigest()
def thash(p:Path)->str:
 h=hashlib.sha256()
 for f in sorted(p.rglob('*')):
  if f.is_file():h.update(f.relative_to(p).as_posix().encode());h.update(b'\0');h.update(hashlib.sha256(f.read_bytes()).digest())
 return 'sha256:'+h.hexdigest()

def run()->dict:
 profile=json.loads((BASE/'module1_adapter/MODULE1_INTAKE_PROFILE.json').read_text())
 schema=json.loads((BASE/'module1_adapter/schemas/module1_intake_profile.schema.json').read_text())
 Draft202012Validator.check_schema(schema);Draft202012Validator(schema).validate(profile)
 a=assess()
 good_profile=json.loads((BASE/'module1_adapter/fixtures/nested_fixture_profile.json').read_text())
 unsafe_profile=json.loads((BASE/'module1_adapter/fixtures/nested_unsafe_profile.json').read_text())
 good=probe_module1_bundle(BASE/'module1_adapter/fixtures/nested_good.zip',good_profile)
 tampered=probe_module1_bundle(BASE/'module1_adapter/fixtures/nested_tampered.zip',good_profile)
 unsafe=probe_module1_bundle(BASE/'module1_adapter/fixtures/nested_unsafe.zip',unsafe_profile)
 pre=BASE/'module1_adapter/fixtures/preintake_triplet';com=BASE/'module1_adapter/fixtures/complete_triplet';con=BASE/'module1_adapter/fixtures/conflict_triplet'
 p1=preflight_v3([pre/'module1.json',pre/'module2.json',pre/'module3.json'])
 p2=preflight_v3([com/'module1.json',com/'module2.json',com/'module3.json'])
 p3=preflight_v3([con/'module1.json',con/'module2.json',con/'module3.json'])
 base={'capability_id':'axm.file.rename','capability_revision':'1.0.0','normalized_source_semantic_sha256':'sha256:'+'1'*64,'capability_card_canonical_sha256':'sha256:'+'a'*64}
 sem=classify_pair(base,{**base,'capability_card_canonical_sha256':'sha256:'+'b'*64})
 digests={'registry':thash(BASE/'registry'),'phase3_events':fhash(BASE/'event_log/phase3_full_events.jsonl'),'graph':fhash(BASE/'graphs/full_graph.json')}
 checks={
  'profile_schema_valid':True,'handoff_hash_matches':a['handoff']['hash_matches'],
  'initial_state_waits_for_artifact_bytes':a['current_materialization_state']['state']=='WAITING_FOR_ARTIFACT_BYTES',
  'nested_good_passes':good['active_package_admission_safe'],
  'nested_tamper_holds':not tampered['active_package_admission_safe'],
  'nested_traversal_holds':not unsafe['active_package_admission_safe'],
  'preintake_requires_materialization':p1['status']=='PACKAGE_REHEARSAL_PASS_MATERIALIZATION_REQUIRED',
  'complete_corpus_reaches_review_only':p2['status']=='CORPUS_REHEARSAL_PASS' and p2['merge_review_allowed'] and not p2['active_merge_allowed'],
  'semantic_conflict_holds':p3['status']=='MERGE_HOLD',
  'run_metadata_variant_not_conflict':sem['classification']=='run_metadata_variant' and not sem['merge_hold'],
  'canonical_body_unchanged':digests==EXPECTED
 }
 passed=all(checks.values())
 report={'schema':'axm.gei.module1-adapter-validation-report/v1','package_version':'0.7.0','checks':checks,'acceptance_passed':passed,'canonical_digests':digests,
         'profile_assessment_hash':a['assessment_hash'],'preintake_report_hash':p1['report_hash'],'complete_report_hash':p2['report_hash'],'conflict_report_hash':p3['report_hash'],
         'limitations':['Actual Module 1 outer bundle bytes are not present in this package.','The real registry run remains NOT_RUN.','Module 2 real package structure remains uninspected.','No execution, merge, proof promotion or CANON authority is granted.']}
 report['report_hash']='sha256:'+hashlib.sha256(json.dumps(report,sort_keys=True,separators=(',',':')).encode()).hexdigest()
 return report

if __name__=='__main__':
 r=run();out=BASE/'module1_adapter/generated/module1_adapter_validation_report.json';out.write_text(json.dumps(r,indent=2,sort_keys=True)+'\n')
 print(json.dumps({'status':'PASS' if r['acceptance_passed'] else 'FAIL','checks':r['checks'],'report_hash':r['report_hash']},indent=2))
 raise SystemExit(0 if r['acceptance_passed'] else 2)
