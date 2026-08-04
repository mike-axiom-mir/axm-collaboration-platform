from __future__ import annotations
import copy, os
from pathlib import Path
from typing import Any


def _within(path: str, root: str) -> bool:
    try:
        p=Path(path).expanduser().resolve(strict=False); r=Path(root).expanduser().resolve(strict=False)
        return p==r or r in p.parents
    except Exception: return False


def run(executable: str, args: list[str], request: dict[str, Any], *, executable_allowlist: list[str], cwd: str, cwd_root: str, environment: dict[str,str] | None = None, allowed_environment_keys: list[str] | None = None) -> dict[str, Any]:
    errors=[]
    if executable not in executable_allowlist: errors.append('executable_not_allowlisted')
    if not isinstance(args,list) or not all(isinstance(x,str) for x in args): errors.append('args_must_be_string_list')
    if not _within(cwd,cwd_root): errors.append('cwd_outside_root')
    if not isinstance(request,dict) or 'method' not in request: errors.append('invalid_jsonrpc_request')
    env={}
    source_env=environment or {}
    for key in allowed_environment_keys or []:
        if key in source_env: env[key]=source_env[key]
    envelope={'jsonrpc':'2.0','id':request.get('id'),'method':request.get('method'),'params':copy.deepcopy(request.get('params'))}
    plan={'argv':[executable]+list(args) if isinstance(args,list) else [executable],'cwd':cwd,'environment':env,'stdin_message':envelope,'shell':False,'capture_stdout':True,'capture_stderr':True,'spawned':False}
    return {'schema':'axm.translation.subprocess-jsonrpc-plan/v1','verdict':'PLAN_READY' if not errors else 'REFUSE','plan':plan if not errors else None,'errors':errors,'cancel_envelope':{'jsonrpc':'2.0','method':'$/cancelRequest','params':{'id':request.get('id')}},'executed':False}
