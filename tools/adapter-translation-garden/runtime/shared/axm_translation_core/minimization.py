from __future__ import annotations
from typing import Any

def purpose_bound_selection(record: dict[str, Any], *, purpose: str, required_fields: list[str], optional_fields: list[str] | None=None, consented_fields: list[str] | None=None) -> dict[str, Any]:
    required=list(dict.fromkeys(required_fields)); optional=list(dict.fromkeys(optional_fields or [])); consent=set(consented_fields or [])
    missing=[k for k in required if k not in record]; undeclared=[k for k in required+optional if consent and k not in consent]
    allowed=[k for k in required+optional if k in record and (not consent or k in consent)]
    selected={k:record[k] for k in allowed}
    dropped=sorted(set(record)-set(selected))
    verdict='REFUSE' if missing or undeclared else 'MINIMIZED'
    return {'schema':'axm.translation.minimization-report/v1','purpose':purpose,'verdict':verdict,'selected':selected,'selected_fields':allowed,'dropped_fields':dropped,'missing_required':missing,'not_consented':undeclared,'input_field_count':len(record),'output_field_count':len(selected),'executed':False}

def verify_minimization(report: dict[str, Any], *, max_fields: int | None=None) -> dict[str, Any]:
    selected=report.get('selected_fields',[]); leaked=set(report.get('selected',{}))-set(selected); too_many=max_fields is not None and len(selected)>int(max_fields)
    return {'schema':'axm.translation.minimization-verification/v1','verdict':'PASS' if report.get('verdict')=='MINIMIZED' and not leaked and not too_many else 'FAIL','leaked_fields':sorted(leaked),'too_many_fields':too_many,'executed':False}

def compose_purpose_chain(reports: list[dict[str, Any]]) -> dict[str, Any]:
    purposes=[r.get('purpose') for r in reports]; failures=[i for i,r in enumerate(reports) if r.get('verdict')!='MINIMIZED']
    return {'schema':'axm.translation.purpose-chain/v1','purposes':purposes,'verdict':'PASS' if not failures else 'FAIL','failed_steps':failures,'executed':False}
