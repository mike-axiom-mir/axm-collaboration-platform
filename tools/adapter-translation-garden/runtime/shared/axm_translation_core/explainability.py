from __future__ import annotations
from typing import Any


def build_decision_trace(*, decision: str, factors: list[dict[str, Any]], evidence_refs: list[str] | None=None, limitations: list[str] | None=None, human_review_required: bool=False) -> dict[str, Any]:
    clean=[]
    for item in factors:
        clean.append({'name':str(item.get('name','unnamed')),'effect':str(item.get('effect','neutral')),'value':item.get('value'),'reason':str(item.get('reason',''))})
    return {'schema':'axm.translation.decision-trace/v1','decision':decision,'factors':clean,'evidence_refs':sorted(set(evidence_refs or [])),'limitations':list(limitations or []),'human_review_required':bool(human_review_required),'executed':False}


def validate_decision_trace(trace: dict[str, Any]) -> dict[str, Any]:
    missing=[k for k in ('decision','factors','evidence_refs','limitations','human_review_required') if k not in trace]
    empty_reasons=[x.get('name') for x in trace.get('factors',[]) if not x.get('reason')]
    verdict='PASS' if not missing and not empty_reasons else 'INCOMPLETE'
    return {'schema':'axm.translation.decision-trace-validation/v1','verdict':verdict,'missing':missing,'empty_reason_factors':empty_reasons,'executed':False}


def explain_decision_trace(trace: dict[str, Any]) -> str:
    lines=[f"Decision: {trace.get('decision','UNKNOWN')}."]
    for factor in trace.get('factors',[]): lines.append(f"- {factor.get('name')}: {factor.get('effect')} because {factor.get('reason')}.")
    if trace.get('limitations'): lines.append('Limits: '+'; '.join(str(x) for x in trace['limitations'])+'.')
    lines.append('Human review is required.' if trace.get('human_review_required') else 'No automatic action was performed.')
    return '\n'.join(lines)
