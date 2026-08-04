from __future__ import annotations
from copy import deepcopy
from typing import Any


def _types(value: Any) -> set[str]:
    if value is None: return set()
    return set(value if isinstance(value,list) else [value])

def run(old: dict[str,Any], new: dict[str,Any], *, rename_hints: dict[str,str]|None=None) -> dict[str,Any]:
    rename_hints=rename_hints or {}; op=old.get('properties',{}); np=new.get('properties',{})
    old_keys=set(op); new_keys=set(np); renamed=[]
    for before,after in rename_hints.items():
        if before in old_keys and after in new_keys:
            renamed.append({'from':before,'to':after}); old_keys.remove(before); new_keys.remove(after)
    added=sorted(new_keys-old_keys); removed=sorted(old_keys-new_keys); shared=sorted(old_keys&new_keys)
    changes=[]; breaking=[]
    old_req=set(old.get('required',[])); new_req=set(new.get('required',[]))
    for name in added:
        item={'kind':'added','field':name,'required':name in new_req,'default':np[name].get('default')}
        changes.append(item)
        if name in new_req and 'default' not in np[name]: breaking.append(item)
    for name in removed:
        item={'kind':'removed','field':name,'was_required':name in old_req}; changes.append(item); breaking.append(item)
    for item in renamed: changes.append({'kind':'renamed',**item,'explicit_hint':True})
    for name in shared:
        a,b=op[name],np[name]; at,bt=_types(a.get('type')),_types(b.get('type'))
        if at!=bt:
            kind='widened' if at and at<=bt else 'narrowed' if bt and bt<at else 'type_changed'
            item={'kind':kind,'field':name,'from':sorted(at),'to':sorted(bt)}; changes.append(item)
            if kind!='widened': breaking.append(item)
        ae=set(a.get('enum',[])); be=set(b.get('enum',[]))
        if ae or be:
            if ae<be: changes.append({'kind':'enum_widened','field':name,'added':sorted(be-ae,key=str)})
            elif be<ae:
                item={'kind':'enum_narrowed','field':name,'removed':sorted(ae-be,key=str)}; changes.append(item); breaking.append(item)
        if a.get('default')!=b.get('default'): changes.append({'kind':'default_changed','field':name,'from':deepcopy(a.get('default')),'to':deepcopy(b.get('default'))})
        if (a.get('title'),a.get('description'))!=(b.get('title'),b.get('description')): changes.append({'kind':'semantic_annotation_changed','field':name})
        if (name in old_req)!=(name in new_req):
            item={'kind':'requiredness_increased' if name in new_req else 'requiredness_decreased','field':name}; changes.append(item)
            if name in new_req: breaking.append(item)
    if list(op)!=list(np): changes.append({'kind':'reordered','old_order':list(op),'new_order':list(np)})
    return {'schema':'axm.translation.schema-delta/v1','verdict':'POTENTIALLY_BREAKING' if breaking else 'NON_BREAKING_CANDIDATE','changes':changes,'breaking_candidates':breaking,'rename_hints_used':renamed,'compatibility_proven':False,'limitations':['Semantic renames require explicit hints. Actual reader/writer compatibility needs module 029 fixtures.']}
