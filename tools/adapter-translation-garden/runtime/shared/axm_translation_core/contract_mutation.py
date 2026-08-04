from __future__ import annotations
import copy,hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def generate_contract_mutations(contract: dict[str,Any], max_cases: int=64) -> dict[str,Any]:
    if max_cases<1 or max_cases>256: raise ValueError('max_cases')
    props=contract.get('properties',{}) if isinstance(contract.get('properties',{}),dict) else {}; required=set(map(str,contract.get('required',[]))); cases=[]
    def add(kind: str, path: list[str], mutated: dict[str,Any], expected: str):
        body={'kind':kind,'path':path,'contract':mutated,'expected':expected}; cases.append({'id':'mutation-'+_hash(body)[:12],**body})
    for name in sorted(props):
        if name not in required:
            m=copy.deepcopy(contract); m.get('properties',{}).pop(name,None); add('remove_optional_property',['properties',name],m,'COMPATIBILITY_REVIEW')
        m=copy.deepcopy(contract); m.setdefault('properties',{})[name]={**copy.deepcopy(props[name]),'type':'null'}; add('replace_type_with_null',['properties',name],m,'LIKELY_BREAKING')
    m=copy.deepcopy(contract); m.setdefault('properties',{})['axm_unknown_field']={'type':'string'}; add('add_unknown_property',['properties','axm_unknown_field'],m,'TOLERANCE_REVIEW')
    if required:
        name=sorted(required)[0]; m=copy.deepcopy(contract); m['required']=[x for x in m.get('required',[]) if x!=name]; add('relax_required',['required',name],m,'BACKWARD_REVIEW')
    if props:
        name=sorted(props)[0]; m=copy.deepcopy(contract); value=m['properties'].pop(name); m['properties'][name+'_renamed']=value; add('rename_property',['properties',name],m,'BREAKING_WITH_MAPPING_OPTION')
    ordered=sorted(cases,key=lambda x:(x['kind'],x['id'])); truncated=len(ordered)>max_cases; selected=ordered[:max_cases]
    body={'source_contract_sha256':_hash(contract),'mutations':selected,'candidate_count':len(ordered),'truncated':truncated,'max_cases':max_cases,'executable_payloads_generated':False,'executed':False}
    return {'schema':'axm.translation.contract-mutation-set/v1',**body,'set_sha256':_hash(body)}

def mutation_coverage_report(mutation_set: dict[str,Any], required_kinds: list[str]|None=None) -> dict[str,Any]:
    required=set(required_kinds or ['add_unknown_property','rename_property','replace_type_with_null']); present={m.get('kind') for m in mutation_set.get('mutations',[])}; missing=sorted(required-present)
    return {'schema':'axm.translation.contract-mutation-coverage/v1','present_kinds':sorted(x for x in present if x),'missing_required_kinds':missing,'mutation_count':len(mutation_set.get('mutations',[])),'truncated':bool(mutation_set.get('truncated')),'complete':not missing,'executed':False}

def contract_mutation_gate(mutation_set: dict[str,Any], coverage: dict[str,Any]) -> dict[str,Any]:
    body={k:mutation_set.get(k) for k in ('source_contract_sha256','mutations','candidate_count','truncated','max_cases','executable_payloads_generated','executed')}; hash_valid=_hash(body)==mutation_set.get('set_sha256'); holds=[]
    if not hash_valid: holds.append('hash_invalid')
    if coverage.get('missing_required_kinds'): holds.append('coverage_missing')
    if mutation_set.get('executable_payloads_generated') is not False or mutation_set.get('executed') is not False: holds.append('authority_boundary')
    return {'schema':'axm.translation.contract-mutation-gate/v1','decision':'REVIEWABLE' if not holds else 'HOLD','holds':holds,'automatic_test_execution':False}
