#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json
from pathlib import Path
from typing import Any
BASE=Path(__file__).resolve().parents[1]

def canon(x:Any)->bytes:return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def digest(x:Any)->str:return 'sha256:'+hashlib.sha256(canon(x)).hexdigest()
def load(folder): return [json.loads(p.read_text(encoding='utf-8')) for p in sorted(folder.glob('*.json'))]

def build():
    diagnosis=json.loads((BASE/'diagnosis_reports/phase3_diagnosis.json').read_text(encoding='utf-8'))
    existing={x['need_id']:x for x in load(BASE/'registry/needs')}
    findings=[f for d in diagnosis['detectors'] for f in d['findings']]
    matched=[]
    for f in findings:
        for nid in f['matched_need_ids']:
            matched.append({'finding_id':f['finding_id'],'need_id':nid,'need_exists':nid in existing})
    # One new candidate is justified by graph reach but stays outside canonical registry until steward review.
    spof=[f for f in findings if f['detector_id']=='high_reach_single_point_of_failure']
    candidates=[]
    if spof:
        evidence=sorted({e for f in spof for e in f['evidence_refs']})
        subjects=sorted({s for f in spof for s in f['subject_ids']})
        candidate={
          'need_id':'axm:need:verify-high-reach-single-provider-capabilities','contract_version':'0.1.0',
          'affected_scope':subjects,
          'observed_problem':f'{len(spof)} modeled high-reach capabilities have a single declared provider serving multiple modeled consumers; resilience and fallback behavior are not verified.',
          'evidence':evidence,
          'desired_outcome':'Verify provider failure behavior, fallback or graceful-degradation expectations, and dependency consequences for the highest-reach single-provider capability paths without assuming redundancy is always required.',
          'improvement_dimensions':['RELIABILITY','TESTABILITY','PROOF_MATURITY'],
          'severity':0.7,'ecosystem_reach':0.72,
          'blocked_work':['axm:module:grounded-evolution-intelligence'],
          'possible_responses':['TEST','RESEARCH','WAIT_FOR_EVIDENCE'],
          'required_knowledge':['Failure-mode expectations','Fallback or graceful-degradation contracts','Dependency reach'],
          'verification_method':'Select the highest-reach finding, simulate or reproduce provider unavailability within its bounded test environment, retain consumer outcomes and evidence, and decide whether fallback, redundancy, or explicit graceful degradation is appropriate.',
          'confidence':0.78,'truth_state':'INFERRED','status':'OPEN','assigned_direction_ids':[]
        }
        candidates.append(candidate)
    result={
      'schema':'axm.gei.need-generation-report/v1','package_version':'0.4.0','contract_version':'0.1.0',
      'generated_at':'2026-08-08T01:23:00Z','source_diagnosis_hash':diagnosis['diagnosis_hash'],
      'matched_existing':sorted(matched,key=lambda x:(x['finding_id'],x['need_id'])),
      'candidate_needs':candidates,
      'candidate_count':len(candidates),
      'truth_boundary':'Candidate needs are schema-valid proposals stored outside registry/needs. They do not become canonical, directions, or execution authority without explicit review.'
    }
    result['report_hash']=digest(result)
    return result

def main():
    x=build(); (BASE/'need_generator/candidate_needs.json').write_text(json.dumps(x,indent=2,sort_keys=True,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps({'status':'PASS','candidate_count':x['candidate_count'],'report_hash':x['report_hash']},indent=2))
if __name__=='__main__':main()
