from __future__ import annotations
from collections import deque
from typing import Any


def run(graph: dict[str, Any], source: str, target: str, *, max_hops: int = 5, max_routes: int = 20, verified_only: bool = True, allowed_authority: list[str] | None = None, required_capabilities: list[str] | None = None) -> dict[str, Any]:
    nodes=graph.get('nodes',{}); edges=graph.get('edges',{}); allowed=set(allowed_authority or ['read_only','decision_only']); req=set(required_capabilities or [])
    if source not in nodes or target not in nodes: return {'verdict':'REFUSE','reason':'source or target missing','routes':[],'executed':False}
    adjacency={}
    for edge_id,edge in edges.items():
        if not edge.get('enabled',True): continue
        if verified_only and not edge.get('verified',False): continue
        if edge.get('authority_mode','decision_only') not in allowed: continue
        if not req<=set(edge.get('capabilities',[])): continue
        adjacency.setdefault(edge.get('source'),[]).append((edge_id,edge))
    for value in adjacency.values(): value.sort(key=lambda x:x[0])
    queue=deque([(source,[source],[])]); routes=[]
    while queue and len(routes)<max_routes:
        node,path,edge_path=queue.popleft()
        if len(edge_path)>=max_hops: continue
        for edge_id,edge in adjacency.get(node,[]):
            nxt=edge.get('target')
            if nxt in path: continue
            new_path=path+[nxt]; new_edges=edge_path+[edge_id]
            if nxt==target: routes.append({'nodes':new_path,'edges':new_edges,'hops':len(new_edges),'intermediates':new_path[1:-1]})
            else: queue.append((nxt,new_path,new_edges))
    routes.sort(key=lambda x:(x['hops'],x['edges']))
    return {'schema':'axm.translation.route-plan/v1','verdict':'ROUTES_FOUND' if routes else 'NO_ROUTE','source':source,'target':target,'routes':routes,'executed':False,'composed':False}
