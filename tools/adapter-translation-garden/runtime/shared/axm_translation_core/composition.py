from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def _cycle(nodes: set[str], edges: list[tuple[str,str]]) -> list[str]:
    outgoing={n:[] for n in nodes}; indegree={n:0 for n in nodes}
    for a,b in edges:
        if a in nodes and b in nodes:
            outgoing[a].append(b); indegree[b]+=1
    ready=sorted(n for n,d in indegree.items() if d==0); order=[]
    while ready:
        n=ready.pop(0); order.append(n)
        for nxt in sorted(outgoing[n]):
            indegree[nxt]-=1
            if indegree[nxt]==0: ready.append(nxt); ready.sort()
    return [] if len(order)==len(nodes) else sorted(n for n,d in indegree.items() if d>0)

def build_capability_composition_plan(request: dict[str,Any], modules: list[dict[str,Any]]) -> dict[str,Any]:
    required=sorted(set(map(str,request.get('required_capabilities',[]))))
    forbidden=set(map(str,request.get('forbidden_authorities',['shadow_only'])))
    max_loss=float(request.get('max_loss_score',1.0)); by_id={str(m.get('id')):m for m in modules if m.get('id')}
    providers={cap:[] for cap in required}; rejected=[]
    for m in modules:
        mid=str(m.get('id','')); authority=str(m.get('authority_mode','unknown')); loss=float(m.get('loss_score',0.0)); status=str(m.get('status',''))
        reasons=[]
        if authority in forbidden: reasons.append('forbidden_authority')
        if status not in {'LOCAL_PROTOTYPE','AVAILABLE'}: reasons.append('not_available')
        if loss>max_loss: reasons.append('loss_limit')
        if reasons: rejected.append({'module_id':mid,'reasons':reasons}); continue
        for cap in required:
            if cap in set(map(str,m.get('provides',[]))): providers[cap].append(m)
    selected=set(); alternatives={}; missing=[]
    for cap in required:
        choices=sorted(providers[cap],key=lambda m:(float(m.get('risk_score',0))+float(m.get('loss_score',0)),-float(m.get('reuse_score',0)),str(m.get('id'))))
        alternatives[cap]=[str(m['id']) for m in choices]
        if not choices: missing.append(cap)
        else: selected.add(str(choices[0]['id']))
    dependency_missing=[]; changed=True
    while changed:
        changed=False
        for mid in list(selected):
            for dep in map(str,by_id.get(mid,{}).get('dependencies',[])):
                d=by_id.get(dep)
                if d is None: dependency_missing.append({'module_id':mid,'dependency':dep}); continue
                if str(d.get('authority_mode')) in forbidden or str(d.get('status')) not in {'LOCAL_PROTOTYPE','AVAILABLE'}:
                    dependency_missing.append({'module_id':mid,'dependency':dep,'reason':'dependency_not_admissible'}); continue
                if dep not in selected: selected.add(dep); changed=True
    edges=[]
    for mid in sorted(selected):
        for dep in map(str,by_id.get(mid,{}).get('dependencies',[])):
            if dep in selected: edges.append((dep,mid))
    cycle_nodes=_cycle(selected,edges)
    indegree={n:0 for n in selected}; outgoing={n:[] for n in selected}
    for a,b in edges: indegree[b]+=1; outgoing[a].append(b)
    ready=sorted(n for n,d in indegree.items() if d==0); order=[]
    while ready:
        n=ready.pop(0); order.append(n)
        for nxt in sorted(outgoing[n]):
            indegree[nxt]-=1
            if indegree[nxt]==0: ready.append(nxt); ready.sort()
    holds=[]
    if missing: holds.append('missing_capabilities')
    if dependency_missing: holds.append('missing_or_blocked_dependencies')
    if cycle_nodes: holds.append('dependency_cycle')
    body={'request':request,'required_capabilities':required,'selected_modules':sorted(selected),'ordered_modules':order if not cycle_nodes else [],'edges':[list(x) for x in sorted(edges)],'alternatives':alternatives,'missing_capabilities':missing,'dependency_issues':dependency_missing,'cycle_nodes':cycle_nodes,'rejected':rejected,'holds':holds,'automatic_execution':False}
    return {'schema':'axm.translation.capability-composition-plan/v1',**body,'plan_sha256':_hash(body),'decision':'REVIEWABLE_PLAN' if not holds else 'HOLD'}

def verify_composition_plan(plan: dict[str,Any]) -> dict[str,Any]:
    body={k:plan.get(k) for k in ('request','required_capabilities','selected_modules','ordered_modules','edges','alternatives','missing_capabilities','dependency_issues','cycle_nodes','rejected','holds','automatic_execution')}
    valid=_hash(body)==plan.get('plan_sha256')
    coherent=(plan.get('decision')=='REVIEWABLE_PLAN')==(not plan.get('holds'))
    no_execute=plan.get('automatic_execution') is False
    return {'valid':valid and coherent and no_execute,'hash_valid':valid,'coherent':coherent,'no_execute':no_execute,'verdict':'PASS' if valid and coherent and no_execute else 'HOLD'}

def compare_composition_plans(left: dict[str,Any], right: dict[str,Any]) -> dict[str,Any]:
    l=set(left.get('selected_modules',[])); r=set(right.get('selected_modules',[]))
    return {'schema':'axm.translation.composition-plan-comparison/v1','added':sorted(r-l),'removed':sorted(l-r),'common':sorted(l&r),'left_holds':list(left.get('holds',[])),'right_holds':list(right.get('holds',[])),'executed':False}
