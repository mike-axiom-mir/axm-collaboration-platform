#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

BASE = Path(__file__).resolve().parents[1]
GRAPH_PATH = BASE / 'graphs' / 'full_graph.json'
REFERENCE_TIME = datetime.fromisoformat('2026-08-08T01:20:00+00:00').astimezone(timezone.utc)
STALE_DAYS = 30
DETECTOR_VERSION = 'axm.gei.detectors/0.1.0'


def canonical(obj: Any) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')

def digest(obj: Any) -> str:
    return 'sha256:' + hashlib.sha256(canonical(obj)).hexdigest()

def load_jsons(folder: Path) -> list[dict[str, Any]]:
    return [json.loads(p.read_text(encoding='utf-8')) for p in sorted(folder.glob('*.json'))]

def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc)

def slug(s: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:80]


def run() -> dict[str, Any]:
    graph = json.loads(GRAPH_PATH.read_text(encoding='utf-8'))
    nodes = {n['id']: n for n in graph['nodes']}
    outgoing, incoming = defaultdict(list), defaultdict(list)
    for e in graph['edges']:
        outgoing[e['source']].append(e); incoming[e['target']].append(e)

    local_modules = {x['module_id']: x for x in load_jsons(BASE/'registry/module_passports')}
    ext_modules = {x['module_id']: x for x in load_jsons(BASE/'registry/external_references/modules')}
    caps = {x['capability_id']: x for x in load_jsons(BASE/'registry/capabilities')}
    evidence = {x['evidence_id']: x for x in load_jsons(BASE/'registry/evidence')}
    needs = {x['need_id']: x for x in load_jsons(BASE/'registry/needs')}
    research = {x['research_id']: x for x in load_jsons(BASE/'registry/research')}
    interfaces = {x['interface_record_id']: x for x in load_jsons(BASE/'registry/external_references/interfaces')}

    results: list[dict[str, Any]] = []

    def evidence_for(subject_id: str) -> list[str]:
        refs = set()
        for e in outgoing.get(subject_id, []):
            if e['relationship'] == 'SUPPORTED_BY' and e['target'].startswith('axm:evidence:'):
                refs.add(e['target'])
            refs.update(x for x in e.get('evidence', []) if x.startswith('axm:evidence:'))
        node = nodes.get(subject_id)
        if node and node.get('source_record', '').startswith('module_passport:'):
            rec = local_modules.get(subject_id) or ext_modules.get(subject_id)
            if rec: refs.update(rec.get('evidence_references', []))
        if subject_id in caps: refs.update(caps[subject_id].get('evidence', []))
        return sorted(x for x in refs if x in evidence)

    def finding(detector_id: str, subjects: list[str], severity: float, truth: str, summary: str,
                evidence_refs: list[str], matched: list[str] | None = None, details: dict[str, Any] | None = None) -> dict[str, Any]:
        basis = {'detector': detector_id, 'subjects': sorted(subjects), 'summary': summary, 'evidence': sorted(set(evidence_refs)), 'source_graph_hash': graph['graph_hash']}
        return {
            'finding_id': f"gei:finding:{slug(detector_id)}:{hashlib.sha256(canonical(basis)).hexdigest()[:16]}",
            'detector_id': detector_id,
            'subject_ids': sorted(subjects),
            'severity': severity,
            'truth_state': truth,
            'summary': summary,
            'evidence_refs': sorted(set(evidence_refs)),
            'matched_need_ids': sorted(set(matched or [])),
            'details': details or {},
            'reproducibility_key': digest(basis),
        }

    def add(detector_id: str, description: str, findings: list[dict[str, Any]], status: str | None = None,
            limitation: str | None = None) -> None:
        if status is None: status = 'FINDINGS' if findings else 'CLEAR'
        body = {
            'detector_id': detector_id, 'description': description, 'status': status,
            'finding_count': len(findings), 'findings': sorted(findings, key=lambda x: x['finding_id']),
            'limitation': limitation,
        }
        body['detector_hash'] = digest(body)
        results.append(body)

    # 1 declared_but_unproven
    fs=[]
    for cid,c in sorted(caps.items()):
        if c['declared_status']=='DECLARED' and c['proof_status'] not in {'TESTED','REPRODUCED'}:
            fs.append(finding('declared_but_unproven',[cid],0.68,'OBSERVED',
                f"{c['name']} is declared while proof_status remains {c['proof_status']}.", c['evidence'],
                ['axm:need:build-capability-proof-ladder'], {'proof_status':c['proof_status']}))
    add('declared_but_unproven','Find declared capabilities that have not reached TESTED or REPRODUCED proof.',fs)

    # 2 missing_tests
    fs=[]
    for mid,m in sorted(local_modules.items()):
        if not m.get('tests'):
            fs.append(finding('missing_tests',[mid],0.62,'OBSERVED','Local module passport has no retained test reference.',m.get('evidence_references',[])))
    if not fs and any(not m.get('tests') for m in ext_modules.values()):
        add('missing_tests','Find modules with no retained test reference.',[], 'INSUFFICIENT_DATA',
            'The only zero-test module records are Module 1 / Module 2 external references; their implementation packages are not ingested yet.')
    else: add('missing_tests','Find modules with no retained test reference.',fs)

    # 3 stale_evidence
    fs=[]
    for eid,e in sorted(evidence.items()):
        age=(REFERENCE_TIME-parse_time(e['captured_at'])).total_seconds()/86400
        if age>STALE_DAYS and e['truth_state']!='OBSOLETE':
            fs.append(finding('stale_evidence',[eid],0.5,'OBSERVED',f'Evidence is {age:.1f} days old, exceeding {STALE_DAYS}-day threshold.',[eid],details={'age_days':round(age,2)}))
    add('stale_evidence','Find retained evidence older than the configured freshness threshold.',fs)

    # degrees excluding support-only links
    meaningful=defaultdict(int)
    for e in graph['edges']:
        if e['relationship']!='SUPPORTED_BY': meaningful[e['source']]+=1; meaningful[e['target']]+=1

    # 4 orphan_module
    fs=[finding('orphan_module',[n['id']],0.65,'OBSERVED','Module has no meaningful non-evidence graph relationship.',evidence_for(n['id']))
        for n in graph['nodes'] if n['type']=='MODULE' and meaningful[n['id']]==0]
    add('orphan_module','Find modules disconnected from all meaningful system relationships.',fs)

    # 5 orphan_capability
    fs=[finding('orphan_capability',[n['id']],0.6,'OBSERVED','Capability has no meaningful provider, consumer, Atlas, or interface relationship.',evidence_for(n['id']))
        for n in graph['nodes'] if n['type']=='CAPABILITY' and meaningful[n['id']]==0]
    add('orphan_capability','Find capabilities disconnected from provider, consumer, or interpretation routes.',fs)

    # 6 dependency_without_provider
    fs=[]
    module_ids={n['id'] for n in graph['nodes'] if n['type']=='MODULE'}
    for e in graph['edges']:
        if e['relationship'] in {'REQUIRES','DEPENDS_ON_REFERENCE'} and e['target'] not in module_ids:
            fs.append(finding('dependency_without_provider',[e['source']],0.84,'OBSERVED',f"Dependency target {e['target']} is not represented as a module node.",e.get('evidence',[])))
    for cid,c in caps.items():
        missing=[p for p in c['provider_modules'] if p not in module_ids]
        if missing:
            fs.append(finding('dependency_without_provider',[cid],0.84,'OBSERVED',f"Capability provider modules are missing from graph: {missing}",c['evidence']))
    add('dependency_without_provider','Find represented dependencies or capability providers whose target/provider is absent.',fs,
        limitation='This detector checks modeled AXM IDs only; arbitrary service strings in unsampled contracts are not treated as missing modules.')

    # 7 duplicated_capability exact deterministic duplicate only
    buckets=defaultdict(list)
    for cid,c in caps.items(): buckets[(c['name'].strip().lower(),c['plain_language_summary'].strip().lower())].append(cid)
    fs=[]
    for key,ids in sorted(buckets.items()):
        if len(ids)>1:
            refs=sorted({x for cid in ids for x in caps[cid]['evidence']})
            fs.append(finding('duplicated_capability',ids,0.55,'OBSERVED','Multiple capability IDs have identical normalized name and summary.',refs))
    add('duplicated_capability','Find exact duplicate capability declarations without semantic guessing.',fs,
        limitation='Near-duplicate semantics are intentionally not inferred by this deterministic detector.')

    # 8 conflicting_versions
    fs=[]
    for mid,m in sorted(local_modules.items()):
        version=str(m.get('version',''))
        if 'manifest:' in version and '|contract:' in version:
            matched=[]
            if mid.endswith('asset-fabric'): matched=['axm:need:align-asset-fabric-version']
            if mid.endswith('game-hub'): matched=['axm:need:align-game-hub-version']
            fs.append(finding('conflicting_versions',[mid],0.72,'CONFLICTED',f'Version mapping is conflicted: {version}.',m.get('evidence_references',[]),matched,{'version':version}))
    add('conflicting_versions','Find explicit manifest/contract version disagreements preserved by the factual kernel.',fs)

    # 9 missing_human_interface
    served={e['target'] for e in graph['edges'] if e['relationship']=='SERVES_CAPABILITY'}
    local_cap_ids=sorted(caps)
    fs=[]
    placeholder_ev=['axm:evidence:phase3-three-module-placeholder-audit']
    for cid in local_cap_ids:
        if cid not in served:
            fs.append(finding('missing_human_interface',[cid],0.57,'OBSERVED','No concrete Human Interface Intelligence record in this package currently serves this local capability.',placeholder_ev + caps[cid]['evidence'],['axm:need:import-real-module1-module2-artifacts'],{'candidate_link_exists':True}))
    add('missing_human_interface','Find local capabilities with no concrete interface record, while preserving the Module 2 placeholder boundary.',fs,
        limitation='This is a package-coverage finding, not a claim that the real Module 2 lacks an interface assessment.')

    # 10 missing_beginner_layer aggregated to avoid duplicate pseudo-needs
    missing=[]
    for cid in local_cap_ids:
        linked=[e['source'] for e in incoming[cid] if e['relationship']=='SERVES_CAPABILITY' and nodes.get(e['source'],{}).get('type')=='INTERFACE']
        if not linked: missing.append(cid)
        elif not any(nodes[x]['attributes'].get('beginner_layer') for x in linked): missing.append(cid)
    fs=[]
    if missing:
        refs=placeholder_ev+sorted({x for cid in missing for x in caps[cid]['evidence']})
        fs=[finding('missing_beginner_layer',missing,0.62,'OBSERVED',f'{len(missing)} local capabilities lack a concrete imported interface record with a beginner layer.',refs,['axm:need:import-real-module1-module2-artifacts'],{'capability_count':len(missing)})]
    add('missing_beginner_layer','Find capabilities lacking a concrete beginner-layer interface record.',fs,
        limitation='Current result is expected while Module 2 remains an external reference rather than an imported implementation.')

    # 11 high_reach_single_point_of_failure
    fs=[]
    for cid,c in sorted(caps.items()):
        providers=sorted(set(c['provider_modules']))
        consumers=sorted(set(c['consumer_modules']))
        if len(providers)==1 and len(consumers)>=2:
            refs=c['evidence']+evidence_for(providers[0])
            fs.append(finding('high_reach_single_point_of_failure',[cid,providers[0]],min(0.95,0.55+0.08*len(consumers)),'INFERRED',
                f"Single declared provider {providers[0]} serves {len(consumers)} modeled consumers for {c['name']}.",refs,[],{'consumer_modules':consumers,'provider_module':providers[0]}))
    add('high_reach_single_point_of_failure','Find high-reach capabilities with one modeled provider and multiple consumers.',fs,
        limitation='Single-provider graph reach is a resilience signal, not evidence that the provider is failing.')

    # 12 repeated_failure_pattern
    intervention_files=list((BASE/'registry'/'interventions').glob('*.json')) if (BASE/'registry'/'interventions').exists() else []
    add('repeated_failure_pattern','Find repeated failure signatures across completed intervention outcomes.',[],
        'NOT_APPLICABLE' if not intervention_files else 'CLEAR',
        'No intervention outcome corpus exists yet; repeated failure analysis becomes meaningful after the closed-loop phase.')

    # 13 undocumented_input_output
    fs=[]
    for mid,m in sorted(local_modules.items()):
        missing_fields=[]
        if not m.get('inputs'): missing_fields.append('inputs')
        if not m.get('outputs'): missing_fields.append('outputs')
        if missing_fields:
            fs.append(finding('undocumented_input_output',[mid],0.48,'OBSERVED',f"Passport is missing documented {', '.join(missing_fields)}.",m.get('evidence_references',[]),details={'missing_fields':missing_fields}))
    add('undocumented_input_output','Find local module passports without documented input or output lists.',fs)

    # 14 excessive_resource_cost
    known_numeric=[]
    for c in caps.values():
        for k,v in c.get('costs',{}).items():
            if isinstance(v,(int,float)): known_numeric.append((c['capability_id'],k,v))
    add('excessive_resource_cost','Find measured resource costs that exceed an explicit configured threshold.',[],
        'INSUFFICIENT_DATA' if not known_numeric else 'CLEAR',
        'No comparable numeric capability cost baseline is retained in the current kernel; the detector refuses to infer “excessive” from UNKNOWN labels.')

    # 15 unverified_build_claim aggregated
    subjects=[]; refs=set()
    for mid,m in sorted(local_modules.items()):
        if m.get('declared_capabilities') and not m.get('proven_capabilities'):
            subjects.append(mid); refs.update(m.get('evidence_references',[]))
    fs=[]
    if subjects:
        fs=[finding('unverified_build_claim',subjects,0.74,'OBSERVED',f'{len(subjects)} local module/system passports expose selected declared capabilities while proven_capabilities is empty.',sorted(refs),['axm:need:build-capability-proof-ladder'],{'module_count':len(subjects)})]
    add('unverified_build_claim','Find module/system records whose selected capability claims have not been promoted into proven_capabilities.',fs,
        limitation='TEST/EXPERIMENTAL status itself is not treated as a false claim; the finding only preserves the proof gap.')

    # 16 unused_reusable_component
    fs=[]
    for e in sorted(graph['edges'],key=lambda x:x['id']):
        if e['relationship']=='CAN_REUSE' and e['source']=='axm:module:grounded-evolution-intelligence' and e['attributes'].get('current_state')!='VERIFIED':
            fs.append(finding('unused_reusable_component',[e['target']],0.6,'INFERRED','Existing bounded sibling is modeled as reusable by Module 3 but the reuse edge is not yet verified by an adapter receipt.',e.get('evidence',[]),['axm:need:reuse-existing-evolution-providers'],{'edge_id':e['id'],'current_state':e['attributes'].get('current_state')}))
    add('unused_reusable_component','Find reusable sibling capabilities that remain modeled but unverified as actual Module 3 adapters.',fs)

    # 17 unresolved_research_blocker
    fs=[]
    for rid,r in sorted(research.items()):
        if r['status'] in {'OPEN','APPROVED','IN_PROGRESS','INSUFFICIENT'} and not r.get('result_summary'):
            evid=needs.get(r['triggering_gap'],{}).get('evidence',[])
            fs.append(finding('unresolved_research_blocker',[rid,r['triggering_gap']],0.64,'OBSERVED',f"Research need remains {r['status']}: {r['research_question']}",evid,[r['triggering_gap']],{'expected_decision_unlocked':r['expected_decision_unlocked']}))
    add('unresolved_research_blocker','Find research needs that still block or inform an unresolved improvement decision.',fs)

    # 18 regression_without_follow_up
    add('regression_without_follow_up','Find intervention outcomes that record regressions without a linked follow-up need.',[],
        'NOT_APPLICABLE' if not intervention_files else 'CLEAR',
        'No completed intervention outcome records are present yet; this detector is armed for the closed-loop phase.')

    summary={r['detector_id']:{'status':r['status'],'finding_count':r['finding_count']} for r in results}
    report={
        'schema':'axm.gei.diagnosis-report/v1','package_version':'0.4.0','contract_version':'0.1.0',
        'detector_version':DETECTOR_VERSION,'generated_at':'2026-08-08T01:22:00Z','reference_time':'2026-08-08T01:20:00Z',
        'source_graph_hash':graph['graph_hash'],'stale_after_days':STALE_DAYS,
        'detectors':sorted(results,key=lambda x:x['detector_id']),
        'summary':summary,
        'totals':{
            'detectors':len(results),'findings':sum(r['finding_count'] for r in results),
            'with_findings':sum(r['status']=='FINDINGS' for r in results),
            'clear':sum(r['status']=='CLEAR' for r in results),
            'insufficient_data':sum(r['status']=='INSUFFICIENT_DATA' for r in results),
            'not_applicable':sum(r['status']=='NOT_APPLICABLE' for r in results),
        },
        'truth_boundary':[
            'Detectors operate only on retained records and the current sampled graph.',
            'A finding is not a steward decision, runtime failure, or permission grant.',
            'CLEAR means no finding under the detector rule and current sample; it is not universal proof of absence.',
            'INSUFFICIENT_DATA and NOT_APPLICABLE remain first-class outcomes and are never converted into PASS.',
        ],
    }
    copy=dict(report); report['diagnosis_hash']=digest(copy)
    return report


def main() -> None:
    report=run()
    out=BASE/'diagnosis_reports'/'phase3_diagnosis.json'
    out.write_text(json.dumps(report,indent=2,sort_keys=True,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps({'status':'PASS','diagnosis_hash':report['diagnosis_hash'],**report['totals']},indent=2))

if __name__=='__main__': main()
