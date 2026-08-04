from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def _valid(case: dict[str,Any], constraints: list[dict[str,Any]]) -> bool:
    for rule in constraints:
        when=rule.get('when',{}); forbid=rule.get('forbid',{})
        if all(case.get(k)==v for k,v in when.items()) and all(case.get(k)==v for k,v in forbid.items()):
            return False
    return True

def build_scenario_matrix(dimensions: dict[str,list[Any]], constraints: list[dict[str,Any]]|None=None, max_cases: int=64) -> dict[str,Any]:
    if not isinstance(max_cases,int) or max_cases<1 or max_cases>512: raise ValueError('max_cases')
    names=sorted(dimensions)
    if not names or any(not isinstance(dimensions[n],list) or not dimensions[n] for n in names): raise ValueError('dimensions')
    if len(names)>12 or any(len(dimensions[n])>16 for n in names): raise ValueError('dimension_bounds')
    constraints=list(constraints or []); base={n:dimensions[n][0] for n in names}; candidates=[base]
    for n in names:
        for value in dimensions[n][1:]: candidates.append({**base,n:value})
    for i,a in enumerate(names):
        for b in names[i+1:]:
            for av in dimensions[a][1:]:
                for bv in dimensions[b][1:]: candidates.append({**base,a:av,b:bv})
    unique=[]; seen=set(); rejected=0
    for case in candidates:
        key=_hash(case)
        if key in seen: continue
        seen.add(key)
        if not _valid(case,constraints): rejected+=1; continue
        unique.append({'id':'scenario-'+key[:12],'values':case})
    total=len(unique); selected=unique[:max_cases]
    body={'dimensions':{n:list(dimensions[n]) for n in names},'constraints':constraints,'scenarios':selected,'candidate_count':len(candidates),'valid_unique_count':total,'rejected_by_constraints':rejected,'truncated':total>max_cases,'max_cases':max_cases,'executed':False}
    return {'schema':'axm.translation.scenario-matrix/v1',**body,'matrix_sha256':_hash(body)}

def scenario_coverage_report(matrix: dict[str,Any]) -> dict[str,Any]:
    dims=matrix.get('dimensions',{}); scenarios=matrix.get('scenarios',[]); covered={n:[] for n in dims}
    pairs=set()
    for s in scenarios:
        values=s.get('values',{})
        for n in dims:
            if n in values and values[n] not in covered[n]: covered[n].append(values[n])
        names=sorted(values)
        for i,a in enumerate(names):
            for b in names[i+1:]: pairs.add((a,json.dumps(values[a],sort_keys=True),b,json.dumps(values[b],sort_keys=True)))
    missing={n:[v for v in vals if v not in covered[n]] for n,vals in dims.items()}
    missing={k:v for k,v in missing.items() if v}
    return {'schema':'axm.translation.scenario-coverage/v1','dimension_value_coverage':covered,'missing_dimension_values':missing,'covered_pair_count':len(pairs),'scenario_count':len(scenarios),'truncated':bool(matrix.get('truncated')),'complete_dimension_value_coverage':not missing,'executed':False}

def verify_scenario_matrix(matrix: dict[str,Any]) -> dict[str,Any]:
    body={k:matrix.get(k) for k in ('dimensions','constraints','scenarios','candidate_count','valid_unique_count','rejected_by_constraints','truncated','max_cases','executed')}
    hash_valid=_hash(body)==matrix.get('matrix_sha256'); ids=[s.get('id') for s in matrix.get('scenarios',[])]; unique=len(ids)==len(set(ids)); bounded=len(ids)<=int(matrix.get('max_cases',0)); no_execute=matrix.get('executed') is False
    valid=hash_valid and unique and bounded and no_execute
    return {'valid':valid,'hash_valid':hash_valid,'unique_ids':unique,'bounded':bounded,'no_execute':no_execute,'verdict':'PASS' if valid else 'HOLD'}
