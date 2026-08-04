from __future__ import annotations
import copy
from typing import Any


def run(host: dict[str, Any], recipe: dict[str, Any], *, approved_entrypoints: list[str], approved_operations: list[str]) -> dict[str, Any]:
    errors=[]; entry=host.get('entrypoint')
    if entry not in approved_entrypoints: errors.append({'reason':'entrypoint not approved','entrypoint':entry})
    available=set(host.get('capabilities',[])); required=set(recipe.get('required_capabilities',[])); missing=sorted(required-available)
    if missing: errors.append({'reason':'missing host capabilities','capabilities':missing})
    operations=[]
    for index, op in enumerate(recipe.get('operations',[]) if isinstance(recipe.get('operations',[]),list) else []):
        if not isinstance(op,dict) or op.get('operation') not in approved_operations:
            errors.append({'index':index,'reason':'operation not approved','operation':op.get('operation') if isinstance(op,dict) else None}); continue
        operations.append({'index':index,'operation':op['operation'],'parameters':copy.deepcopy(op.get('parameters',{})),'performed':False})
    plan={'host_id':host.get('id'),'host_version':host.get('version'),'entrypoint':entry,'snapshot':{'before':True,'label':recipe.get('id')},'operations':operations,'verify':copy.deepcopy(recipe.get('verification',[])),'rollback':{'on_failure':'restore_snapshot'},'executed':False}
    return {'schema':'axm.translation.dcc-recipe-plan/v1','verdict':'PLAN_READY' if not errors else 'REFUSE','plan':plan if not errors else None,'errors':errors,'host_launched':False,'files_written':False}
