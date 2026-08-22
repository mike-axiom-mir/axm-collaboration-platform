#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, subprocess, sys
from pathlib import Path
from typing import Any
from jsonschema import Draft202012Validator

BASE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE/'scripts'))
from rebuild_state import rebuild

EXPECTED_DETECTORS={
'declared_but_unproven','missing_tests','stale_evidence','orphan_module','orphan_capability',
'dependency_without_provider','duplicated_capability','conflicting_versions','missing_human_interface',
'missing_beginner_layer','high_reach_single_point_of_failure','repeated_failure_pattern',
'undocumented_input_output','excessive_resource_cost','unverified_build_claim','unused_reusable_component',
'unresolved_research_blocker','regression_without_follow_up'
}

def canon(x:Any)->bytes:return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def digest(x:Any)->str:return 'sha256:'+hashlib.sha256(canon(x)).hexdigest()
def loadj(p):return json.loads(Path(p).read_text(encoding='utf-8'))

def validate():
    errors=[]
    diagnosis=loadj(BASE/'diagnosis_reports/phase3_diagnosis.json')
    graph=loadj(BASE/'graphs/full_graph.json')
    config=loadj(BASE/'graph_builder/build_config.json')
    needgen=loadj(BASE/'need_generator/candidate_needs.json')
    evidence={x['evidence_id'] for p in sorted((BASE/'registry/evidence').glob('*.json')) for x in [loadj(p)]}
    needs={x['need_id'] for p in sorted((BASE/'registry/needs').glob('*.json')) for x in [loadj(p)]}
    directions=[loadj(p) for p in sorted((BASE/'registry/directions').glob('*.json'))]

    copy=dict(diagnosis); stored=copy.pop('diagnosis_hash',None)
    if stored!=digest(copy): errors.append('diagnosis_hash mismatch')
    if diagnosis['source_graph_hash']!=graph['graph_hash']: errors.append('diagnosis source_graph_hash mismatch')
    detector_ids={d['detector_id'] for d in diagnosis['detectors']}
    if detector_ids!=EXPECTED_DETECTORS: errors.append(f'detector set mismatch: {sorted(detector_ids^EXPECTED_DETECTORS)}')
    if diagnosis['totals']['detectors']!=18: errors.append('detector total is not 18')
    for d in diagnosis['detectors']:
        if d['status'] not in {'FINDINGS','CLEAR','INSUFFICIENT_DATA','NOT_APPLICABLE'}: errors.append(f"bad detector status {d['detector_id']}")
        if d['finding_count']!=len(d['findings']): errors.append(f"finding count mismatch {d['detector_id']}")
        for f in d['findings']:
            missing=[x for x in f['evidence_refs'] if x not in evidence]
            if missing: errors.append(f"{f['finding_id']} missing evidence {missing}")
            bad=[x for x in f['matched_need_ids'] if x not in needs]
            if bad: errors.append(f"{f['finding_id']} missing matched need {bad}")

    # Candidate needs must conform to the shared contract but remain outside canonical registry.
    iv=Draft202012Validator(loadj(BASE/'schemas/improvement_need.schema.json'))
    for c in needgen['candidate_needs']:
        try: iv.validate(c)
        except Exception as exc: errors.append(f"candidate need schema: {exc}")
        if c['need_id'] in needs: errors.append(f"candidate silently entered canonical registry: {c['need_id']}")
        missing=[x for x in c['evidence'] if x not in evidence]
        if missing: errors.append(f"candidate missing evidence: {missing}")
    for m in needgen['matched_existing']:
        if not m['need_exists'] or m['need_id'] not in needs: errors.append(f"bad need match {m}")

    # Phase 3 event chain must extend Phase 2 byte-for-record and rebuild deterministically.
    phase2=[json.loads(x) for x in (BASE/'event_log/phase2_full_events.jsonl').read_text().splitlines() if x.strip()]
    phase3=[json.loads(x) for x in (BASE/'event_log/phase3_full_events.jsonl').read_text().splitlines() if x.strip()]
    if phase3[:len(phase2)]!=phase2: errors.append('phase3 event prefix differs from phase2')
    if len(phase3)<=len(phase2): errors.append('phase3 event chain did not extend phase2')
    ev=Draft202012Validator(loadj(BASE/'schemas/event_envelope.schema.json'))
    for i,e in enumerate(phase3,1):
        try: ev.validate(e)
        except Exception as exc: errors.append(f'event {i} schema: {exc}')
    try:
        s1=rebuild(BASE/'event_log/phase3_full_events.jsonl'); s2=rebuild(BASE/'event_log/phase3_full_events.jsonl')
        if s1['state_hash']!=s2['state_hash']: errors.append('phase3 rebuild nondeterministic')
        if s1['state_hash']!=config['source_state_hash']: errors.append('graph source_state_hash does not equal phase3 state hash')
    except Exception as exc:
        s1={'state_hash':'sha256:'+'0'*64,'event_count':0}; errors.append(f'phase3 rebuild failed: {exc}')

    # Dry-run preflight fixture truth.
    compat=loadj(BASE/'interop_preflight/generated/compatible_preflight_report.json')
    conflict=loadj(BASE/'interop_preflight/generated/conflict_preflight_report.json')
    if not compat['acceptance_passed']: errors.append('compatible preflight fixture did not pass')
    if conflict['acceptance_passed']: errors.append('conflict preflight fixture unexpectedly passed')
    if not conflict['record_collisions']: errors.append('conflict fixture did not preserve record collision')

    # No auto-authority in new checkpoint.
    if any(d['steward_status']!='PENDING' or d['execution_status']!='NOT_STARTED' for d in directions):
        errors.append('an evolution direction gained authority or execution state')
    placeholder_need=loadj(BASE/'registry/needs/import-real-module1-module2-artifacts.json')
    if placeholder_need['status']!='OPEN' or placeholder_need['truth_state']!='OBSERVED': errors.append('placeholder intake need state changed unexpectedly')

    # Phase 2 graph structure must still validate after the new records are included.
    p2=subprocess.run([sys.executable,str(BASE/'graph_validation/validate_graph.py')],capture_output=True,text=True)
    if p2.returncode!=0: errors.append('phase2 graph regression failed: '+p2.stdout+p2.stderr)

    report={
      'schema':'axm.gei.phase3-validation-report/v1','package_version':'0.4.0','contract_version':'0.1.0',
      'generated_at':'2026-08-08T01:28:00Z','source_graph_hash':graph['graph_hash'],
      'diagnosis_hash':diagnosis['diagnosis_hash'],'detectors':diagnosis['totals'],
      'candidate_need_count':needgen['candidate_count'],'phase3_event_count':s1['event_count'],
      'phase3_state_hash':s1['state_hash'],'compatible_preflight_passed':compat['acceptance_passed'],
      'conflict_preflight_rejected':not conflict['acceptance_passed'],'errors':errors,
      'acceptance_passed':not errors,
      'truth_boundary':[
        'Phase 3 validation proves deterministic diagnosis and structural intake preflight over the retained sampled kernel.',
        'It does not prove the real Module 1 or Module 2 packages, which are not ingested yet.',
        'Candidate needs remain outside canonical registry and no direction receives execution or CANON authority.'
      ]
    }
    return report

def main():
    r=validate(); (BASE/'generated/phase3_validation_report.json').write_text(json.dumps(r,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    print(json.dumps({'status':'PASS' if r['acceptance_passed'] else 'FAIL','errors':r['errors'],'phase3_event_count':r['phase3_event_count'],'phase3_state_hash':r['phase3_state_hash'],'source_graph_hash':r['source_graph_hash'],'diagnosis_hash':r['diagnosis_hash']},indent=2))
    raise SystemExit(0 if r['acceptance_passed'] else 1)
if __name__=='__main__':main()
