from __future__ import annotations
from typing import Any

def build_capability_coverage(modules: list[dict[str,Any]], requirements: list[dict[str,Any]]|None=None) -> dict[str,Any]:
    providers={}; module_rows=[]
    for module in modules:
        mid=str(module.get('id','')); caps=sorted(set(map(str,module.get('capabilities',module.get('provides',[]))))); status=str(module.get('status','')); authority=str(module.get('authority_mode','unknown'))
        row={'module_id':mid,'capabilities':caps,'status':status,'authority_mode':authority,'dependencies':sorted(set(map(str,module.get('dependencies',[]))))}
        module_rows.append(row)
        for cap in caps: providers.setdefault(cap,[]).append({'module_id':mid,'status':status,'authority_mode':authority})
    reqs=requirements or [{'capability':cap,'criticality':'normal'} for cap in sorted(providers)]
    coverage=[]
    for req in reqs:
        cap=str(req.get('capability','')); rows=sorted(providers.get(cap,[]),key=lambda x:x['module_id']); live=[r for r in rows if r['status'] in {'LOCAL_PROTOTYPE','AVAILABLE'} and r['authority_mode']!='shadow_only']
        coverage.append({'capability':cap,'criticality':str(req.get('criticality','normal')),'providers':rows,'reviewable_providers':live,'coverage':'COVERED' if live else ('SHADOW_ONLY' if rows else 'UNCOVERED')})
    return {'schema':'axm.translation.capability-coverage/v1','modules':sorted(module_rows,key=lambda x:x['module_id']),'coverage':coverage,'module_count':len(module_rows),'capability_count':len(coverage),'runtime_benchmark':False}

def identify_capability_gaps(coverage_report: dict[str,Any]) -> dict[str,Any]:
    uncovered=[]; shadow=[]; single=[]
    for row in coverage_report.get('coverage',[]):
        if row.get('coverage')=='UNCOVERED': uncovered.append(row['capability'])
        elif row.get('coverage')=='SHADOW_ONLY': shadow.append(row['capability'])
        elif len(row.get('reviewable_providers',[]))==1: single.append(row['capability'])
    return {'schema':'axm.translation.capability-gap-report/v1','uncovered':sorted(uncovered),'shadow_only':sorted(shadow),'single_provider':sorted(single),'gap_count':len(uncovered)+len(shadow),'automatic_growth':False}

def prioritize_gap_closure(gap_report: dict[str,Any], requirement_metadata: dict[str,dict[str,Any]]|None=None) -> dict[str,Any]:
    metadata=requirement_metadata or {}; candidates=[]
    for kind,base in (('uncovered',1.0),('shadow_only',0.8),('single_provider',0.4)):
        for cap in gap_report.get(kind,[]):
            meta=metadata.get(cap,{}); criticality=float(meta.get('criticality_score',0.5)); reuse=float(meta.get('reuse_score',0.5)); risk=float(meta.get('risk_score',0.5)); score=base+criticality*0.5+reuse*0.3-risk*0.2
            candidates.append({'capability':cap,'gap_type':kind,'priority_score':round(score,8),'human_review_required':True})
    candidates.sort(key=lambda x:(-x['priority_score'],x['capability']))
    return {'schema':'axm.translation.capability-gap-priority/v1','ranked':candidates,'automatic_implementation':False,'heuristic_only':True}
