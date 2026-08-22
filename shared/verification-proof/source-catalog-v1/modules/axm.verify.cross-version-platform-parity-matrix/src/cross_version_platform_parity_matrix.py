"""Detached AXM Cross-Version and Platform Parity Matrix v0.1.0."""
from __future__ import annotations
import json
from typing import Any, Dict, Mapping, Sequence

STATUSES={"PASS","FAIL","ERROR","NOT_RUN"}
class ParityMatrixError(ValueError):pass
def canonical(value:Any)->str:return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False)
class CrossVersionPlatformParityMatrix:
    def compare(self,profiles:Sequence[Mapping[str,Any]],behaviors:Sequence[str],observations:Sequence[Mapping[str,Any]])->Dict[str,Any]:
        if not profiles or not behaviors:raise ParityMatrixError("profiles and behaviors must not be empty")
        profile_map={};
        for raw in profiles:
            pid=raw.get("profile_id") if isinstance(raw,Mapping) else None
            if not isinstance(pid,str) or not pid.strip() or pid in profile_map:raise ParityMatrixError("profile_id must be unique and non-empty")
            profile_map[pid]=dict(raw)
        behavior_ids=[str(x) for x in behaviors]
        if len(set(behavior_ids))!=len(behavior_ids):raise ParityMatrixError("behavior ids must be unique")
        cells={};seen=set()
        for raw in observations:
            pid=raw.get("profile_id") if isinstance(raw,Mapping) else None;bid=raw.get("behavior_id") if isinstance(raw,Mapping) else None;status=raw.get("status") if isinstance(raw,Mapping) else None
            key=(pid,bid)
            if pid not in profile_map or bid not in behavior_ids or status not in STATUSES or key in seen:raise ParityMatrixError("invalid or duplicate observation")
            equivalence=raw.get("equivalence_key",canonical(raw.get("output"))) if status=="PASS" else None
            cells[key]={"status":status,"equivalence_key":equivalence,"output":raw.get("output"),"detail":raw.get("detail")};seen.add(key)
        rows={};missing=[];failures=[];unknown=[];divergent=[]
        for bid in behavior_ids:
            outputs={};row={}
            for pid in sorted(profile_map):
                cell=cells.get((pid,bid))
                if cell is None:row[pid]={"status":"MISSING"};missing.append({"profile_id":pid,"behavior_id":bid});continue
                row[pid]=cell
                if cell["status"]=="FAIL":failures.append({"profile_id":pid,"behavior_id":bid})
                elif cell["status"] in {"ERROR","NOT_RUN"}:unknown.append({"profile_id":pid,"behavior_id":bid,"status":cell["status"]})
                elif cell["status"]=="PASS":outputs.setdefault(cell["equivalence_key"],[]).append(pid)
            if len(outputs)>1:divergent.append({"behavior_id":bid,"equivalence_groups":outputs})
            rows[bid]=row
        if failures or divergent:verdict="FAIL"
        elif missing or unknown:verdict="UNKNOWN"
        else:verdict="PASS"
        return {"schema_version":"axm.verify.platform-parity/0.1","verdict_state":verdict,"profiles":profile_map,"matrix":rows,"missing":missing,"execution_failures":failures,"unknown_observations":unknown,"divergences":divergent,"observations_are_caller_supplied":True,"parity_is_not_general_correctness":True,"authority":"NONE","canon":False}
