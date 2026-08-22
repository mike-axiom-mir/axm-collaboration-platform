from __future__ import annotations
from typing import Any

def build_intake_decision(*, compatibility: dict[str, Any], payload_verification: dict[str, Any], minimization: dict[str, Any], dependencies: dict[str, Any], quarantine: dict[str, Any], upgrade_plan: dict[str, Any], explanation: dict[str, Any]) -> dict[str, Any]:
    checks={'compatibility':compatibility.get('verdict') in {'COMPATIBLE','PASS','REVIEWABLE_COMPATIBLE_PACKAGE_REVISION'},'integrity':payload_verification.get('verdict')=='PASS','minimization':minimization.get('verdict') in {'MINIMIZED','PASS'},'dependencies':dependencies.get('verdict')=='PASS','quarantine':quarantine.get('verdict')=='READY_FOR_HUMAN_REVIEW','upgrade':upgrade_plan.get('verdict') in {'REVIEWABLE_COMPATIBLE_PACKAGE_REVISION','REVIEWABLE'},'explanation':explanation.get('verdict')=='PASS'}
    failed=sorted(k for k,v in checks.items() if not v)
    return {'schema':'axm.translation.intake-decision/v1','verdict':'READY_FOR_HUMAN_DECISION' if not failed else 'HOLD','checks':checks,'failed_checks':failed,'automatic_install':False,'automatic_merge':False,'canon':False,'executed':False}

def intake_action_report(decision: dict[str, Any]) -> str:
    lines=[f"Intake verdict: {decision.get('verdict','UNKNOWN')}",f"Automatic install: {decision.get('automatic_install',False)}",f"Automatic merge: {decision.get('automatic_merge',False)}"]
    if decision.get('failed_checks'): lines.append('Failed checks: '+', '.join(decision['failed_checks']))
    else: lines.append('All declared checks passed; a human decision is still required.')
    return '\n'.join(lines)
