from __future__ import annotations
from typing import Any

def analyze_dependency_closure(manifests: list[dict[str, Any]], selected_ids: list[str]) -> dict[str, Any]:
    by_id={m['id']:m for m in manifests}; selected=list(dict.fromkeys(selected_ids)); missing=[]; shadow=[]; authority=[]; visiting=set(); visited=set(); order=[]; cycles=[]
    def visit(mid: str, path: list[str]):
        if mid in visiting:
            cycles.append(path[path.index(mid):]+[mid] if mid in path else path+[mid]); return
        if mid in visited: return
        m=by_id.get(mid)
        if m is None: missing.append(mid); return
        if m.get('authority_mode')=='shadow_only': shadow.append(mid)
        if m.get('default_enabled') is not False or m.get('implementation',{}).get('network_access') is not False or m.get('implementation',{}).get('native_writes') is not False: authority.append(mid)
        visiting.add(mid)
        for dep in m.get('hard_dependencies',[]): visit(dep,path+[mid])
        visiting.remove(mid); visited.add(mid); order.append(mid)
    for mid in selected: visit(mid,[])
    blockers={'missing':sorted(set(missing)),'cycles':cycles,'shadow':sorted(set(shadow)),'authority_conflicts':sorted(set(authority))}
    passed=not any(blockers.values())
    return {'schema':'axm.translation.dependency-closure/v1','verdict':'PASS' if passed else 'HOLD','selected':selected,'closure_order':order,'blockers':blockers,'automatic_install':False,'executed':False}

def compare_dependency_plans(previous: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    added=sorted(set(current.get('closure_order',[]))-set(previous.get('closure_order',[]))); removed=sorted(set(previous.get('closure_order',[]))-set(current.get('closure_order',[])))
    return {'schema':'axm.translation.dependency-plan-diff/v1','verdict':'REVIEW' if added or removed else 'IDENTICAL','added':added,'removed':removed,'executed':False}
