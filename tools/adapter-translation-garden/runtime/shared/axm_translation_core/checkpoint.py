from __future__ import annotations
import hashlib, json
from typing import Any

def _h(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()


def build_checkpoint_evidence(*, run: int, source_sha256: str, assurance_index_sha256: str, tests_passed: int, tests_run: int, shadow_locks: int, previous_tip: str | None=None) -> dict[str, Any]:
    body={'run':int(run),'source_sha256':source_sha256,'assurance_index_sha256':assurance_index_sha256,'tests_passed':int(tests_passed),'tests_run':int(tests_run),'shadow_locks':int(shadow_locks),'previous_tip':previous_tip}
    return {'schema':'axm.translation.checkpoint-evidence/v1',**body,'verdict':'PASS' if tests_passed==tests_run and shadow_locks==10 else 'REVIEW','tip':_h(body),'executed':False}


def verify_checkpoint_lineage(previous: dict[str, Any] | None, current: dict[str, Any]) -> dict[str, Any]:
    expected=None if previous is None else previous.get('tip')
    linked=current.get('previous_tip')==expected
    monotonic=previous is None or int(current.get('run',0))>int(previous.get('run',0))
    return {'schema':'axm.translation.checkpoint-lineage-verification/v1','verdict':'PASS' if linked and monotonic else 'FAIL','linked':linked,'monotonic':monotonic,'executed':False}


def resilience_summary(*, compatibility: dict[str, Any], failure_summary: dict[str, Any], rollback_plan: dict[str, Any], trace_validation: dict[str, Any]) -> dict[str, Any]:
    blockers=[]
    if compatibility.get('verdict')!='PASS': blockers.append('compatibility')
    if failure_summary.get('verdict')=='QUARANTINE': blockers.append('failures')
    if rollback_plan.get('verdict')=='BLOCKED_BY_DRIFT': blockers.append('rollback_drift')
    if trace_validation.get('verdict')!='PASS': blockers.append('explainability')
    return {'schema':'axm.translation.resilience-summary/v1','verdict':'READY_FOR_HUMAN_REVIEW' if not blockers else 'HOLD','blockers':blockers,'automatic_action':False,'executed':False}
