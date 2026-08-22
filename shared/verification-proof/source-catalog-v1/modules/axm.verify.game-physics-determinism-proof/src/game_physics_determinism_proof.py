"""Detached AXM Game and Physics Determinism Proof v0.1.0."""
from __future__ import annotations
import json
from typing import Any, Dict, Mapping, Sequence

STATES={"PASS","FAIL","UNKNOWN","NOT_RUN"}
class DeterminismProofError(ValueError):pass
def canonical(value:Any)->str:return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False)
class GamePhysicsDeterminismProof:
    def compare(self,runs:Sequence[Mapping[str,Any]])->Dict[str,Any]:
        if len(runs)<2:raise DeterminismProofError("at least two runs are required")
        normalized=[];seen=set();uncertain=[]
        for raw in runs:
            rid=raw.get("run_id") if isinstance(raw,Mapping) else None;status=raw.get("status") if isinstance(raw,Mapping) else None;step=raw.get("fixed_step_ms") if isinstance(raw,Mapping) else None
            if not isinstance(rid,str) or not rid or rid in seen or status not in STATES or not isinstance(step,(int,float)) or step<=0:raise DeterminismProofError("invalid or duplicate run")
            seen.add(rid);ticks=set()
            for cp in raw.get("checkpoints",[]):
                tick=cp.get("tick") if isinstance(cp,Mapping) else None
                if not isinstance(tick,int) or tick in ticks or not isinstance(cp.get("state_checksum"),str):raise DeterminismProofError("invalid or duplicate checkpoint")
                ticks.add(tick)
            row=dict(raw);normalized.append(row)
            if status in {"UNKNOWN","NOT_RUN"}:uncertain.append({"run_id":rid,"status":status})
        baseline=normalized[0];mismatches=[]
        config_fields=("fixed_step_ms","seed","input_order_digest")
        event_fields=("collision_events","authority_decisions")
        base_check={cp["tick"]:cp["state_checksum"] for cp in baseline.get("checkpoints",[])}
        for row in normalized[1:]:
            for field in config_fields:
                if canonical(row.get(field))!=canonical(baseline.get(field)):mismatches.append({"run_id":row["run_id"],"type":"configuration","field":field,"baseline":baseline.get(field),"observed":row.get(field)})
            current={cp["tick"]:cp["state_checksum"] for cp in row.get("checkpoints",[])}
            if current!=base_check:mismatches.append({"run_id":row["run_id"],"type":"state_checkpoints","baseline":base_check,"observed":current})
            for field in event_fields:
                if canonical(row.get(field,[]))!=canonical(baseline.get(field,[])):mismatches.append({"run_id":row["run_id"],"type":"event_sequence","field":field})
        if any(row["status"]=="FAIL" for row in normalized):mismatches.append({"type":"reported_run_failure"})
        verdict="FAIL" if mismatches else ("UNKNOWN" if uncertain else "PASS")
        return {"schema_version":"axm.verify.game-physics-determinism/0.1","verdict_state":verdict,"baseline_run_id":baseline["run_id"],"run_count":len(normalized),"mismatches":mismatches,"uncertain_runs":uncertain,"does_not_run_simulation":True,"receipts_are_caller_supplied":True,"determinism_scope_is_bounded":True,"correctness_proven":False,"authority":"NONE","canon":False}
