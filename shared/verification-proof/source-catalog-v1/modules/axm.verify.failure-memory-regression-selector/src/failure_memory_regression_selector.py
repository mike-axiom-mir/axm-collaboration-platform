"""Detached AXM Failure-Memory Regression Selector v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping, Sequence

STATUSES={"VERIFIED","FLAKY","REJECTED","UNREVIEWED"}
class FailureMemoryError(ValueError):pass
class FailureMemoryRegressionSelector:
    def select(self,failures:Sequence[Mapping[str,Any]],tests:Sequence[Mapping[str,Any]],*,max_tests:int=100)->Dict[str,Any]:
        if isinstance(max_tests,bool) or not isinstance(max_tests,int) or max_tests<1:raise FailureMemoryError("max_tests must be positive")
        normalized=[];seen=set()
        for raw in failures:
            fid=raw.get("failure_id") if isinstance(raw,Mapping) else None;status=raw.get("status") if isinstance(raw,Mapping) else None;keys=raw.get("regression_keys",[]) if isinstance(raw,Mapping) else []
            if not isinstance(fid,str) or not fid.strip() or fid in seen:raise FailureMemoryError("failure_id must be unique and non-empty")
            if status not in STATUSES or isinstance(keys,(str,bytes)):raise FailureMemoryError("invalid failure status or keys")
            normalized.append({"failure_id":fid,"status":status,"regression_keys":{str(x) for x in keys},"severity":raw.get("severity")});seen.add(fid)
        test_items=[];seen_tests=set()
        for raw in tests:
            tid=raw.get("test_id") if isinstance(raw,Mapping) else None
            if not isinstance(tid,str) or not tid.strip() or tid in seen_tests:raise FailureMemoryError("test_id must be unique and non-empty")
            ids=raw.get("covers_failure_ids",[]);keys=raw.get("regression_keys",[])
            if isinstance(ids,(str,bytes)) or isinstance(keys,(str,bytes)):raise FailureMemoryError("test coverage must be sequences")
            test_items.append({"test_id":tid,"covers_failure_ids":{str(x) for x in ids},"regression_keys":{str(x) for x in keys}});seen_tests.add(tid)
        verified=[x for x in normalized if x["status"]=="VERIFIED"]
        matches=[]
        for test in test_items:
            covered=[]
            for failure in verified:
                if failure["failure_id"] in test["covers_failure_ids"] or failure["regression_keys"] & test["regression_keys"]:covered.append(failure["failure_id"])
            if covered:matches.append({"test_id":test["test_id"],"covers_verified_failures":sorted(covered)})
        matches.sort(key=lambda x:(-len(x["covers_verified_failures"]),x["test_id"]))
        selected=matches[:max_tests];covered=set().union(*(set(x["covers_verified_failures"]) for x in selected)) if selected else set()
        missing=sorted(x["failure_id"] for x in verified if x["failure_id"] not in covered)
        verdict="UNKNOWN" if not verified else ("FAIL" if missing else "PASS")
        held={status:sorted(x["failure_id"] for x in normalized if x["status"]==status) for status in ("FLAKY","REJECTED","UNREVIEWED")}
        return {"schema_version":"axm.verify.failure-memory-selection/0.1","verdict_state":verdict,"selected_tests":selected,"uncovered_verified_failures":missing,"held_out_failures":held,"only_verified_failures_auto_selected":True,"tests_executed":False,"canon":False,"authority":"NONE"}
