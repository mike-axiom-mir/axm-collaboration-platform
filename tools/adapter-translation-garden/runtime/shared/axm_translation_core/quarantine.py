from __future__ import annotations
from typing import Any

def quarantine_decision(*, integrity_passed: bool, compatibility_passed: bool, authority_unchanged: bool, tests_passed: bool, provenance_present: bool, dependency_passed: bool=True) -> dict[str, Any]:
    checks={'integrity':bool(integrity_passed),'compatibility':bool(compatibility_passed),'authority':bool(authority_unchanged),'tests':bool(tests_passed),'provenance':bool(provenance_present),'dependencies':bool(dependency_passed)}
    failed=sorted(k for k,v in checks.items() if not v)
    verdict='READY_FOR_HUMAN_REVIEW' if not failed else 'QUARANTINE'
    return {'schema':'axm.translation.quarantine-decision/v1','verdict':verdict,'checks':checks,'failed_checks':failed,'automatic_release':False,'installed':False,'executed':False}

def human_release_gate(decision: dict[str, Any], *, human_approved: bool, approval_reference: str | None=None) -> dict[str, Any]:
    allowed=decision.get('verdict')=='READY_FOR_HUMAN_REVIEW' and bool(human_approved) and bool(approval_reference)
    return {'schema':'axm.translation.human-release-gate/v1','verdict':'APPROVED_FOR_MANUAL_INTAKE' if allowed else 'HOLD','approval_reference':approval_reference,'automatic_install':False,'installed':False,'executed':False}

def revoke_release(*, module_id: str, reason: str, prior_approval_reference: str) -> dict[str, Any]:
    return {'schema':'axm.translation.release-revocation/v1','module_id':module_id,'reason':reason,'prior_approval_reference':prior_approval_reference,'verdict':'REVOKED_FOR_REVIEW','automatic_uninstall':False,'executed':False}
