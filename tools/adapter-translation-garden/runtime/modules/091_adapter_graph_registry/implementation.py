from __future__ import annotations
import copy
from typing import Any


def empty_graph() -> dict[str, Any]: return {'schema':'axm.translation.adapter-graph/v1','version':1,'nodes':{},'edges':{}}


def register_node(graph: dict[str, Any], node: dict[str, Any]) -> dict[str, Any]:
    out=copy.deepcopy(graph); node_id=node.get('id')
    if not node_id: return {'verdict':'REFUSE','reason':'node id required','graph':out}
    existing=out.setdefault('nodes',{}).get(node_id)
    if existing is not None and existing!=node: return {'verdict':'REFUSE','reason':'conflicting node id','graph':out}
    out['nodes'][node_id]=copy.deepcopy(node); out['version']=int(out.get('version',0))+1
    return {'verdict':'REGISTERED','graph':out}


def register_adapter(graph: dict[str, Any], edge: dict[str, Any]) -> dict[str, Any]:
    out=copy.deepcopy(graph); edge_id=edge.get('id'); source=edge.get('source'); target=edge.get('target')
    if not edge_id or source not in out.get('nodes',{}) or target not in out.get('nodes',{}): return {'verdict':'REFUSE','reason':'edge id and existing source/target required','graph':out}
    existing=out.setdefault('edges',{}).get(edge_id)
    if existing is not None and existing!=edge: return {'verdict':'REFUSE','reason':'conflicting edge id','graph':out}
    out['edges'][edge_id]=copy.deepcopy(edge); out['version']=int(out.get('version',0))+1
    return {'verdict':'REGISTERED','graph':out}


def run(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> dict[str, Any]:
    graph=empty_graph(); errors=[]
    for node in nodes:
        result=register_node(graph,node)
        if result['verdict']=='REFUSE': errors.append(result['reason'])
        else: graph=result['graph']
    for edge in edges:
        result=register_adapter(graph,edge)
        if result['verdict']=='REFUSE': errors.append(result['reason'])
        else: graph=result['graph']
    return {'verdict':'GRAPH_READY' if not errors else ('PARTIAL' if graph['nodes'] else 'REFUSE'),'graph':graph,'errors':errors,'executed':False}
