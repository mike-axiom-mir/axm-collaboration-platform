from __future__ import annotations
from typing import Any

REQUIRED_EVENT_FIELDS = {'event_id', 'module_id', 'event_type', 'timestamp', 'actor_ref', 'new_state', 'evidence_refs'}

def validate_event(event: dict[str, Any]) -> dict[str, Any]:
    missing = sorted(REQUIRED_EVENT_FIELDS - set(event))
    return {'ok': not missing, 'missing_fields': missing, 'code': 'TRACE_COMPLETE' if not missing else 'TRACE_INCOMPLETE'}

def evaluate_service(latency_ms: int, latency_budget_ms: int, correctness_proven: bool, evidence_refs: list[str]) -> dict[str, Any]:
    slo_met = latency_ms <= latency_budget_ms
    accepted = bool(slo_met and correctness_proven and evidence_refs)
    return {'slo_met': slo_met, 'correctness_proven': correctness_proven, 'evidence_present': bool(evidence_refs),
            'accepted': accepted, 'code': 'SERVICE_ACCEPTED' if accepted else 'SLO_NOT_SUFFICIENT_PROOF'}
