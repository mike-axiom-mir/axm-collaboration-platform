from __future__ import annotations
from typing import Any

def fixture_coverage_report(requirements: list[dict[str, Any]], fixtures: list[dict[str, Any]]) -> dict[str, Any]:
    covered={str(tag) for fixture in fixtures for tag in fixture.get('covers',[])}
    rows=[]
    for req in requirements:
        rid=str(req['id']); critical=bool(req.get('critical',False)); hit=rid in covered
        rows.append({'requirement_id':rid,'critical':critical,'covered':hit})
    missing=[x['requirement_id'] for x in rows if not x['covered']]
    critical_missing=[x['requirement_id'] for x in rows if x['critical'] and not x['covered']]
    ratio=(sum(x['covered'] for x in rows)/len(rows)) if rows else 0.0
    return {'schema':'axm.translation.fixture-coverage/v1','requirements':rows,'coverage_ratio':ratio,'missing':missing,'critical_missing':critical_missing,'verdict':'PASS' if rows and not critical_missing else 'HOLD'}

def mutation_adequacy_report(expected_mutations: list[str], observations: list[dict[str, str]]) -> dict[str, Any]:
    seen={str(x.get('mutation_id')):str(x.get('outcome','NOT_RUN')).upper() for x in observations}
    rows=[{'mutation_id':str(mid),'outcome':seen.get(str(mid),'NOT_RUN')} for mid in expected_mutations]
    killed=[x['mutation_id'] for x in rows if x['outcome']=='KILLED']; survived=[x['mutation_id'] for x in rows if x['outcome']=='SURVIVED']; not_run=[x['mutation_id'] for x in rows if x['outcome']=='NOT_RUN']
    score=len(killed)/len(rows) if rows else 0.0
    return {'schema':'axm.translation.mutation-adequacy/v1','rows':rows,'score':score,'killed':killed,'survived':survived,'not_run':not_run,'verdict':'PASS' if rows and not survived and not not_run else 'HOLD'}

def fixture_adequacy_gate(coverage: dict[str, Any], mutation: dict[str, Any], minimum_coverage: float=1.0, minimum_mutation_score: float=1.0) -> dict[str, Any]:
    ready=coverage.get('coverage_ratio',0)>=minimum_coverage and not coverage.get('critical_missing') and mutation.get('score',0)>=minimum_mutation_score and not mutation.get('survived') and not mutation.get('not_run')
    return {'decision':'REVIEWABLE' if ready else 'HOLD','coverage_ratio':coverage.get('coverage_ratio',0),'mutation_score':mutation.get('score',0),'critical_missing':coverage.get('critical_missing',[]),'survived':mutation.get('survived',[]),'not_run':mutation.get('not_run',[]),'automatic_promotion':False}
