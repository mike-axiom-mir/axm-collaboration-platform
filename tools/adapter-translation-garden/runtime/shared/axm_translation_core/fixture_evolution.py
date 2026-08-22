from __future__ import annotations
import hashlib,json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def compare_fixture_contracts(before: dict[str,Any], after: dict[str,Any]) -> dict[str,Any]:
    bp=before.get('properties',{}); ap=after.get('properties',{}); br=set(before.get('required',[])); ar=set(after.get('required',[])); changes=[]
    for name in sorted(set(bp)|set(ap)):
        if name not in bp: changes.append({'field':name,'kind':'ADDED','breaking':name in ar})
        elif name not in ap: changes.append({'field':name,'kind':'REMOVED','breaking':name in br})
        elif bp[name].get('type')!=ap[name].get('type'): changes.append({'field':name,'kind':'TYPE_CHANGED','before_type':bp[name].get('type'),'after_type':ap[name].get('type'),'breaking':True})
    for name in sorted(ar-br):
        if name in bp and name in ap: changes.append({'field':name,'kind':'BECAME_REQUIRED','breaking':True})
    body={'before_sha256':_hash(before),'after_sha256':_hash(after),'changes':changes,'breaking_changes':[c for c in changes if c.get('breaking')],'automatic_migration':False}
    return {'schema':'axm.translation.fixture-contract-compatibility/v1',**body,'report_sha256':_hash(body)}

def build_fixture_evolution_plan(report: dict[str,Any], fixtures: list[dict[str,Any]]) -> dict[str,Any]:
    breaking=bool(report.get('breaking_changes')); rows=[]
    for f in fixtures:
        rows.append({'fixture_id':str(f.get('fixture_id')),'current_contract_sha256':report.get('before_sha256'),'target_contract_sha256':report.get('after_sha256'),'action':'HOLD_AND_REVIEW' if breaking else 'REVALIDATE','source_rewrite':False})
    return {'schema':'axm.translation.fixture-evolution-plan/v1','compatibility':'BREAKING' if breaking else 'REVIEWABLE_COMPATIBLE','fixtures':rows,'migration_executed':False,'source_rewrite':False,'human_review_required':True}

def verify_fixture_evolution_plan(report: dict[str,Any], plan: dict[str,Any]) -> dict[str,Any]:
    body={k:report.get(k) for k in ('before_sha256','after_sha256','changes','breaking_changes','automatic_migration')}; errors=[]
    if _hash(body)!=report.get('report_sha256'): errors.append('hash')
    if plan.get('migration_executed') is not False or plan.get('source_rewrite') is not False: errors.append('authority')
    if report.get('breaking_changes') and plan.get('compatibility')!='BREAKING': errors.append('compatibility')
    return {'schema':'axm.translation.fixture-evolution-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':errors,'bounded':True}
