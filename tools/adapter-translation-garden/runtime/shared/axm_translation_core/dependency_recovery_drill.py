from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def _closure(selected: list[str], graph: dict[str,list[str]]) -> tuple[list[str],list[str]]:
    seen=set(); visiting=set(); cycles=[]
    def visit(n: str):
        if n in visiting: cycles.append(n); return
        if n in seen: return
        visiting.add(n)
        for d in graph.get(n,[]): visit(str(d))
        visiting.remove(n); seen.add(n)
    for n in selected: visit(str(n))
    return sorted(seen),sorted(set(cycles))

def simulate_dependency_recovery_drill(selected_modules: list[str], dependency_graph: dict[str,list[str]], pack_inventory: list[dict[str,Any]], damaged_modules: list[str]) -> dict[str,Any]:
    closure,cycles=_closure(list(map(str,selected_modules)),dependency_graph); inv={}
    for p in pack_inventory:
        inv.setdefault(str(p.get('module_id','')),[]).append(p)
    choices=[]; unrecoverable=[]
    for mid in sorted(set(map(str,damaged_modules)) & set(closure)):
        candidates=sorted([p for p in inv.get(mid,[]) if p.get('verified') is True and p.get('compatible') is True],key=lambda p:(int(p.get('pack_revision',0)),str(p.get('pack_id',''))),reverse=True)
        if candidates: choices.append({'module_id':mid,'pack_id':str(candidates[0].get('pack_id')),'pack_revision':int(candidates[0].get('pack_revision',0))})
        else: unrecoverable.append(mid)
    missing=[mid for mid in closure if mid not in inv]
    body={'selected_modules':sorted(set(map(str,selected_modules))),'dependency_closure':closure,'cycles':cycles,'damaged_modules':sorted(set(map(str,damaged_modules))),'recovery_choices':choices,'unrecoverable_modules':sorted(set(unrecoverable+missing)),'steps':[{'action':'PLAN_RESTORE_PACK','module_id':x['module_id'],'pack_id':x['pack_id']} for x in choices],'decision':'DRILL_REVIEWABLE' if not cycles and not unrecoverable and not missing else 'HOLD','archive_extraction':False,'restore_executed':False,'filesystem_writes':False}
    return {'schema':'axm.translation.dependency-recovery-drill/v1',**body,'drill_sha256':_hash(body)}

def verify_dependency_recovery_drill(drill: dict[str,Any]) -> dict[str,Any]:
    body={k:drill.get(k) for k in ('selected_modules','dependency_closure','cycles','damaged_modules','recovery_choices','unrecoverable_modules','steps','decision','archive_extraction','restore_executed','filesystem_writes')}; errors=[]
    if _hash(body)!=drill.get('drill_sha256'): errors.append('hash')
    if any(drill.get(k) is not False for k in ('archive_extraction','restore_executed','filesystem_writes')): errors.append('side_effect')
    if drill.get('decision')=='DRILL_REVIEWABLE' and (drill.get('cycles') or drill.get('unrecoverable_modules')): errors.append('decision')
    return {'schema':'axm.translation.dependency-recovery-drill-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':errors,'planned_restores':len(drill.get('recovery_choices',[]))}
