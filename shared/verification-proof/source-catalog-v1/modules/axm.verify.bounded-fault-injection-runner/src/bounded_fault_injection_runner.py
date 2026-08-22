"""Detached AXM Bounded Fault-Injection Runner v0.1.0."""
from __future__ import annotations
from collections import Counter
from typing import Any, Callable, Dict, Mapping, Sequence

FAULT_TYPES = {"PROCESS", "NETWORK", "STORAGE", "RESOURCE", "CLOCK", "DEPENDENCY"}
OUTCOMES = {"PASS", "FAIL", "ERROR", "NOT_RUN"}

class FaultInjectionError(ValueError):
    pass

class BoundedFaultInjectionRunner:
    def run(self, faults: Sequence[Mapping[str, Any]], executor: Callable[[Dict[str, Any]], Mapping[str, Any]], *, max_cases: int = 32, abort_after_failures: int = 3) -> Dict[str, Any]:
        if not callable(executor):
            raise FaultInjectionError("executor must be callable")
        if isinstance(max_cases, bool) or not isinstance(max_cases, int) or not 1 <= max_cases <= 1000:
            raise FaultInjectionError("max_cases must be an integer from 1 to 1000")
        if isinstance(abort_after_failures, bool) or not isinstance(abort_after_failures, int) or abort_after_failures < 1:
            raise FaultInjectionError("abort_after_failures must be positive")
        if not faults:
            raise FaultInjectionError("faults must not be empty")
        normalized = []
        seen = set()
        for raw in faults:
            if not isinstance(raw, Mapping):
                raise FaultInjectionError("each fault must be a mapping")
            fault_id = raw.get("fault_id")
            fault_type = raw.get("fault_type")
            if not isinstance(fault_id, str) or not fault_id.strip() or fault_id in seen:
                raise FaultInjectionError("fault_id must be unique and non-empty")
            if fault_type not in FAULT_TYPES:
                raise FaultInjectionError("unsupported fault_type")
            parameters = raw.get("parameters", {})
            if not isinstance(parameters, Mapping):
                raise FaultInjectionError("parameters must be a mapping")
            seen.add(fault_id)
            normalized.append({"fault_id": fault_id, "fault_type": fault_type, "parameters": dict(parameters)})
        results = []
        consecutive_failures = 0
        aborted = False
        for fault in normalized[:max_cases]:
            try:
                supplied = executor(dict(fault))
                if not isinstance(supplied, Mapping):
                    raise TypeError("executor result must be a mapping")
                outcome = supplied.get("outcome")
                if outcome not in OUTCOMES:
                    raise TypeError("unsupported executor outcome")
                recovery = supplied.get("recovery_observed")
                if recovery is not None and not isinstance(recovery, bool):
                    raise TypeError("recovery_observed must be bool or null")
                result = {**fault, "outcome": outcome, "recovery_observed": recovery, "detail": supplied.get("detail")}
            except Exception as exc:
                result = {**fault, "outcome": "ERROR", "recovery_observed": None, "detail": f"{type(exc).__name__}: {exc}"}
            results.append(result)
            failed = result["outcome"] in {"FAIL", "ERROR"} or result["recovery_observed"] is False
            consecutive_failures = consecutive_failures + 1 if failed else 0
            if consecutive_failures >= abort_after_failures:
                aborted = True
                break
        truncated = len(normalized) > len(results)
        counts = dict(Counter(item["outcome"] for item in results))
        recovery_failures = [item["fault_id"] for item in results if item["recovery_observed"] is False]
        if any(item["outcome"] == "FAIL" for item in results) or recovery_failures:
            verdict = "FAIL"
        elif aborted or truncated or any(item["outcome"] in {"ERROR", "NOT_RUN"} for item in results):
            verdict = "UNKNOWN"
        else:
            verdict = "PASS"
        return {
            "schema_version": "axm.verify.bounded-fault-injection/0.1",
            "verdict_state": verdict,
            "results": results,
            "counts": counts,
            "recovery_failures": recovery_failures,
            "aborted": aborted,
            "truncated": truncated,
            "declared_case_count": len(normalized),
            "executed_case_count": len(results),
            "executor_is_caller_supplied": True,
            "host_level_faults_injected_by_module": False,
            "authority": "NONE",
            "canon": False,
        }
