from __future__ import annotations
from typing import Any


def compare_public_api(previous: list[dict[str, Any]], current: list[dict[str, Any]]) -> dict[str, Any]:
    old={x['name']:x for x in previous}; new={x['name']:x for x in current}
    removed=sorted(set(old)-set(new)); added=sorted(set(new)-set(old)); changed=sorted(k for k in set(old)&set(new) if old[k]!=new[k])
    verdict='BREAKING' if removed or changed else ('ADDITIVE' if added else 'IDENTICAL')
    return {'schema':'axm.translation.api-compatibility/v1','verdict':verdict,'removed':removed,'added':added,'changed':changed,'compatible':verdict in {'IDENTICAL','ADDITIVE'},'executed':False}


def compare_module_baseline(previous: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    api=compare_public_api(previous.get('public_api',[]),current.get('public_api',[]))
    identity_match=previous.get('id')==current.get('id') and previous.get('number')==current.get('number')
    authority_match=previous.get('authority_mode')==current.get('authority_mode')
    implementation_match=previous.get('implementation_sha256')==current.get('implementation_sha256')
    verdict='COMPATIBLE' if identity_match and authority_match and api['compatible'] else 'BREAKING_OR_ESCALATED'
    return {'schema':'axm.translation.module-compatibility/v1','module_number':current.get('number'),'module_id':current.get('id'),'verdict':verdict,'identity_match':identity_match,'authority_match':authority_match,'implementation_match':implementation_match,'api':api,'requires_human_review':not implementation_match or api['verdict']!='IDENTICAL','executed':False}


def summarize_baseline(previous_entries: list[dict[str, Any]], current_entries: list[dict[str, Any]]) -> dict[str, Any]:
    old={x['number']:x for x in previous_entries}; new={x['number']:x for x in current_entries}; reports=[]
    for number in sorted(set(old)|set(new)):
        if number not in old or number not in new:
            reports.append({'module_number':number,'verdict':'MISSING_ENTRY','executed':False})
        else: reports.append(compare_module_baseline(old[number],new[number]))
    incompatible=[x['module_number'] for x in reports if x['verdict'] not in {'COMPATIBLE'}]
    return {'schema':'axm.translation.baseline-summary/v1','verdict':'PASS' if not incompatible else 'FAIL','modules_compared':len(reports),'incompatible_modules':incompatible,'reports':reports,'executed':False}
