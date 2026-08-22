"""Detached AXM Change-Impact Regression Selector v0.1.0."""
from __future__ import annotations
from collections import deque
from typing import Any, Dict, Mapping, Sequence

class ChangeImpactError(ValueError):pass
class ChangeImpactRegressionSelector:
    def select(self,changed:Sequence[str],edges:Sequence[Mapping[str,str]],tests:Sequence[Mapping[str,Any]],*,max_depth:int=8,max_nodes:int=1000)->Dict[str,Any]:
        if isinstance(changed,(str,bytes)) or not changed:raise ChangeImpactError("changed must be a non-empty sequence")
        if isinstance(max_depth,bool) or not isinstance(max_depth,int) or max_depth<0:raise ChangeImpactError("max_depth must be non-negative")
        if isinstance(max_nodes,bool) or not isinstance(max_nodes,int) or max_nodes<1:raise ChangeImpactError("max_nodes must be positive")
        graph={}
        for raw in edges:
            source=raw.get("source") if isinstance(raw,Mapping) else None;target=raw.get("target") if isinstance(raw,Mapping) else None
            if not all(isinstance(x,str) and x.strip() for x in (source,target)):raise ChangeImpactError("edges require non-empty source and target")
            graph.setdefault(source,set()).add(target)
        distances={str(node):0 for node in changed};queue=deque(sorted(distances));truncated=False
        while queue:
            node=queue.popleft();depth=distances[node]
            if depth>=max_depth:continue
            for target in sorted(graph.get(node,set())):
                if target in distances:continue
                if len(distances)>=max_nodes:truncated=True;queue.clear();break
                distances[target]=depth+1;queue.append(target)
        impacted=set(distances);selected=[];seen=set()
        for raw in tests:
            tid=raw.get("test_id") if isinstance(raw,Mapping) else None;covers=raw.get("covers",[]) if isinstance(raw,Mapping) else []
            if not isinstance(tid,str) or not tid.strip() or tid in seen:raise ChangeImpactError("test_id must be unique and non-empty")
            if isinstance(covers,(str,bytes)):raise ChangeImpactError("covers must be a sequence")
            intersection=sorted(impacted & {str(x) for x in covers})
            if intersection:selected.append({"test_id":tid,"covers_impacted":intersection})
            seen.add(tid)
        covered=set().union(*(set(x["covers_impacted"]) for x in selected)) if selected else set()
        return {"schema_version":"axm.verify.change-impact-selection/0.1","changed":sorted({str(x) for x in changed}),"impacted":[{"node":node,"distance":distances[node]} for node in sorted(distances,key=lambda x:(distances[x],x))],"selected_tests":selected,"uncovered_impacted":sorted(impacted-covered),"truncated":truncated,"tests_executed":False,"graph_is_caller_supplied":True,"authority":"NONE","canon":False}
