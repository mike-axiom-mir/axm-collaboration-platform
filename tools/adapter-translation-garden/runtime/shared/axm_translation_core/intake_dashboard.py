from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def build_intake_dashboard(test_report: dict[str,Any], authority_audit: dict[str,Any], pack_audit: dict[str,Any], readiness_items: list[dict[str,Any]], limitations: list[str]|None=None) -> dict[str,Any]:
    blockers=[]; warnings=[]
    if int(test_report.get('failures',0)) or int(test_report.get('tests_passed',0))!=int(test_report.get('tests_run',0)): blockers.append('test_suite')
    if authority_audit.get('issues') or authority_audit.get('shadow_implementations'): blockers.append('authority_audit')
    if pack_audit.get('failed') or pack_audit.get('zip_integrity') not in {'PASS',None}: blockers.append('selective_packs')
    for item in readiness_items:
        state=str(item.get('state','UNKNOWN')).upper(); name=str(item.get('name','unnamed'))
        if state in {'FAIL','HOLD','RED'}: blockers.append(name)
        elif state in {'PENDING','UNKNOWN','AMBER','WARNING'}: warnings.append(name)
    status='RED' if blockers else ('AMBER' if warnings or limitations else 'GREEN')
    body={'status':status,'blockers':sorted(set(blockers)),'warnings':sorted(set(warnings)),'tests':{'run':int(test_report.get('tests_run',0)),'passed':int(test_report.get('tests_passed',0))},'authority':{'files_scanned':int(authority_audit.get('files_scanned',0)),'issue_count':len(authority_audit.get('issues',[]))},'packs':{'count':int(pack_audit.get('packs',0)),'failed_count':len(pack_audit.get('failed',[]))},'readiness_items':readiness_items,'limitations':list(limitations or []),'automatic_approval':False}
    return {'schema':'axm.translation.intake-dashboard/v1',**body,'dashboard_sha256':_hash(body)}

def verify_intake_dashboard(dashboard: dict[str,Any]) -> dict[str,Any]:
    body={k:dashboard.get(k) for k in ('status','blockers','warnings','tests','authority','packs','readiness_items','limitations','automatic_approval')}; errors=[]
    if _hash(body)!=dashboard.get('dashboard_sha256'): errors.append('hash')
    expected='RED' if dashboard.get('blockers') else ('AMBER' if dashboard.get('warnings') or dashboard.get('limitations') else 'GREEN')
    if dashboard.get('status')!=expected: errors.append('status')
    if dashboard.get('automatic_approval') is not False: errors.append('authority')
    return {'schema':'axm.translation.intake-dashboard-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':errors}

def render_intake_dashboard(dashboard: dict[str,Any]) -> str:
    lines=[f"AXM intake dashboard: {dashboard.get('status','UNKNOWN')}",f"Tests: {dashboard.get('tests',{}).get('passed',0)}/{dashboard.get('tests',{}).get('run',0)}",f"Authority issues: {dashboard.get('authority',{}).get('issue_count',0)}",f"Pack failures: {dashboard.get('packs',{}).get('failed_count',0)}"]
    if dashboard.get('blockers'): lines.append('Blockers: '+', '.join(dashboard['blockers']))
    if dashboard.get('warnings'): lines.append('Warnings: '+', '.join(dashboard['warnings']))
    if dashboard.get('limitations'): lines.append('Limitations: '+'; '.join(dashboard['limitations']))
    return '\n'.join(lines)
