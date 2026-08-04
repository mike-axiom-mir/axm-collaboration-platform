from __future__ import annotations
import hashlib, json

def build_bundle(bundle_class:str,members:list[dict])->dict:
    ordered=sorted([{'module_id':m['module_id'],'invariant':m['invariant'],'witness':m['witness']} for m in members],key=lambda x:x['module_id'])
    member_digests={m['module_id']:hashlib.sha256(json.dumps(m,sort_keys=True,separators=(',',':')).encode()).hexdigest() for m in ordered}
    root=hashlib.sha256(json.dumps({'class':bundle_class,'members':member_digests},sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return {'bundle_class':bundle_class,'member_digests':member_digests,'bundle_digest':root,'count':len(ordered)}
def verify_member(bundle:dict,member:dict)->dict:
    d=hashlib.sha256(json.dumps({'module_id':member['module_id'],'invariant':member['invariant'],'witness':member['witness']},sort_keys=True,separators=(',',':')).encode()).hexdigest()
    ok=bundle.get('member_digests',{}).get(member['module_id'])==d
    return {'ok':ok,'error':None if ok else 'MEMBER_WITNESS_MISMATCH'}
def select_tests(*,changed_members:set[str],dependency_map:dict[str,list[str]],root_risk:bool,all_modules:list[str])->list[str]:
    if root_risk: return sorted(all_modules)
    selected=set(changed_members); frontier=list(changed_members)
    while frontier:
        cur=frontier.pop()
        for nxt in dependency_map.get(cur,[]):
            if nxt not in selected: selected.add(nxt); frontier.append(nxt)
    return sorted(selected)
