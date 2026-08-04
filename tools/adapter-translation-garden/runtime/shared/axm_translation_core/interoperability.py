from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def build_interoperability_matrix(producers: list[dict[str,Any]], consumers: list[dict[str,Any]], dimensions: list[str]|None=None, max_pairs: int=256) -> dict[str,Any]:
    if max_pairs<1 or max_pairs>2048: raise ValueError('max_pairs')
    dims=sorted(set(dimensions or ['format','version','encoding','schema']))
    pairs=[]; truncated=False
    for p in sorted(producers,key=lambda x:str(x.get('id'))):
        for c in sorted(consumers,key=lambda x:str(x.get('id'))):
            shared={d:sorted(set(map(str,p.get(d,[]))) & set(map(str,c.get(d,[])))) for d in dims}
            compatible=all(shared[d] for d in dims if p.get(d) or c.get(d))
            pair={'id':f"{p.get('id')}->{c.get('id')}",'producer_id':p.get('id'),'consumer_id':c.get('id'),'shared':shared,'declared_compatible':compatible,'observed':False}
            if len(pairs)>=max_pairs: truncated=True; break
            pairs.append(pair)
        if truncated: break
    body={'dimensions':dims,'pairs':pairs,'max_pairs':max_pairs,'truncated':truncated,'executed_conversions':False,'network_access':False}
    return {'schema':'axm.translation.interoperability-matrix/v1',**body,'matrix_sha256':_hash(body)}

def evaluate_interop_observations(matrix: dict[str,Any], observations: list[dict[str,Any]]) -> dict[str,Any]:
    expected={x['id']:x for x in matrix.get('pairs',[])}; results=[]; missing=[]
    for pid,pair in expected.items():
        matching=[o for o in observations if str(o.get('pair_id'))==pid]
        if not matching: missing.append(pid); continue
        o=matching[-1]; status=str(o.get('status','UNKNOWN'))
        results.append({'pair_id':pid,'declared_compatible':pair.get('declared_compatible'),'status':status,'evidence_id':o.get('evidence_id'),'contradiction':(status=='PASS')!=bool(pair.get('declared_compatible'))})
    contradictions=[r for r in results if r['contradiction']]
    return {'schema':'axm.translation.interoperability-observation-report/v1','results':results,'missing_observations':missing,'contradictions':contradictions,'complete':not missing,'executed_by_this_module':False}

def interoperability_gate(report: dict[str,Any], require_complete: bool=True) -> dict[str,Any]:
    holds=[]
    if report.get('contradictions'): holds.append('declared_observed_contradiction')
    if require_complete and report.get('missing_observations'): holds.append('observations_incomplete')
    return {'schema':'axm.translation.interoperability-gate/v1','decision':'REVIEWABLE' if not holds else 'HOLD','holds':holds,'automatic_activation':False}
