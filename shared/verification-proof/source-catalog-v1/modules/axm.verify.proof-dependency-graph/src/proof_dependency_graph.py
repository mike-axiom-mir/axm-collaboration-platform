"""Detached AXM Proof Dependency Graph v0.1.0."""
from __future__ import annotations
from typing import Any,Dict,Mapping,Sequence
NODE_TYPES={"claim","artifact","environment","source","receipt","human_judgment"}
RELATIONS={"depends_on","supported_by","produced_in","derived_from","reviewed_by"}
class ProofDependencyGraphError(ValueError):pass
class ProofDependencyGraph:
    def build(self,nodes:Sequence[Mapping[str,Any]],edges:Sequence[Mapping[str,Any]])->Dict[str,Any]:
        if not isinstance(nodes,list) or not isinstance(edges,list):raise ProofDependencyGraphError("node and edge lists required")
        normalized=[];ids=set()
        for raw in nodes:
            if not isinstance(raw,Mapping) or not isinstance(raw.get("id"),str) or not raw["id"] or raw.get("type") not in NODE_TYPES:raise ProofDependencyGraphError("invalid node")
            if raw["id"] in ids:raise ProofDependencyGraphError("duplicate node id")
            ids.add(raw["id"]);normalized.append({"id":raw["id"],"type":raw["type"],"label":raw.get("label",raw["id"])})
        norm_edges=[];adj={i:[] for i in ids};incoming={i:0 for i in ids}
        for raw in edges:
            if not isinstance(raw,Mapping) or raw.get("relation") not in RELATIONS:raise ProofDependencyGraphError("invalid edge")
            a,b=raw.get("from"),raw.get("to")
            if a not in ids or b not in ids:raise ProofDependencyGraphError("missing edge endpoint")
            if a==b:raise ProofDependencyGraphError("self dependency refused")
            item={"from":a,"to":b,"relation":raw["relation"]}
            if item not in norm_edges:norm_edges.append(item);adj[a].append(b);incoming[b]+=1
        color={i:0 for i in ids};stack=[];cycles=[]
        def visit(n):
            color[n]=1;stack.append(n)
            for nxt in sorted(adj[n]):
                if color[nxt]==0:visit(nxt)
                elif color[nxt]==1:
                    cycle=stack[stack.index(nxt):]+[nxt]
                    if cycle not in cycles:cycles.append(cycle)
            stack.pop();color[n]=2
        for n in sorted(ids):
            if color[n]==0:visit(n)
        order=[]
        if not cycles:
            inc=dict(incoming);ready=sorted(k for k,v in inc.items() if v==0)
            while ready:
                n=ready.pop(0);order.append(n)
                for nxt in sorted(adj[n]):
                    inc[nxt]-=1
                    if inc[nxt]==0:ready.append(nxt);ready.sort()
        roots=sorted(k for k,v in incoming.items() if v==0)
        return {"schema_version":"axm.verify.proof-dependency-graph/0.1","nodes":sorted(normalized,key=lambda x:x["id"]),"edges":sorted(norm_edges,key=lambda x:(x["from"],x["to"],x["relation"])),"roots":roots,"cycles":cycles,"topological_order":order,"verdict_state":"HUMAN_REVIEW" if cycles else "PASS","cycle_resolved":False,"authority":"NONE","canon":False}
