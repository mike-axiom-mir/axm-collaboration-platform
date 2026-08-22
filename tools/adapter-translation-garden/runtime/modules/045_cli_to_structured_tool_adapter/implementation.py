from __future__ import annotations
from typing import Any


def _coerce(name: str, value: Any, spec: dict[str, Any]) -> tuple[bool,Any,str|None]:
    kind=spec.get('type','string')
    if kind=='string': return (isinstance(value,str),value,None if isinstance(value,str) else 'expected string')
    if kind=='integer':
        if isinstance(value,bool): return False,None,'expected integer'
        try: iv=int(value)
        except (ValueError,TypeError): return False,None,'expected integer'
        if spec.get('minimum') is not None and iv<spec['minimum']: return False,None,'below minimum'
        if spec.get('maximum') is not None and iv>spec['maximum']: return False,None,'above maximum'
        return True,iv,None
    if kind=='boolean': return (isinstance(value,bool),value,None if isinstance(value,bool) else 'expected boolean')
    if kind=='enum': return (value in spec.get('values',[]),value,None if value in spec.get('values',[]) else 'not in enum')
    if kind=='string_list': return (isinstance(value,list) and all(isinstance(x,str) for x in value),value,None if isinstance(value,list) and all(isinstance(x,str) for x in value) else 'expected string list')
    return False,None,'unsupported type'


def run(tool_spec: dict[str, Any], inputs: dict[str, Any]) -> dict[str, Any]:
    executable=tool_spec.get('executable'); specs=tool_spec.get('arguments',[]); errors=[]; argv=[executable] if isinstance(executable,str) and executable else []
    known={s.get('name') for s in specs if isinstance(s,dict)}
    unknown=sorted(set(inputs)-known)
    if unknown: errors.append({'reason':'unknown inputs','names':unknown})
    if not argv: errors.append({'reason':'missing executable'})
    positionals=[]; options=[]
    for spec in specs:
        if not isinstance(spec,dict) or not spec.get('name'): errors.append({'reason':'invalid argument spec'}); continue
        name=spec['name']; present=name in inputs
        if not present:
            if spec.get('required'): errors.append({'argument':name,'reason':'required'})
            continue
        ok,value,error=_coerce(name,inputs[name],spec)
        if not ok: errors.append({'argument':name,'reason':error}); continue
        style=spec.get('style','option')
        if style=='positional': positionals.append((int(spec.get('position',0)),str(value)))
        elif style=='flag':
            if value: options.append(str(spec.get('flag') or f'--{name}'))
        elif style=='option': options.extend([str(spec.get('flag') or f'--{name}'),str(value)])
        elif style=='repeat':
            flag=str(spec.get('flag') or f'--{name}')
            for item in value: options.extend([flag,item])
        else: errors.append({'argument':name,'reason':'unsupported style'})
    for _,value in sorted(positionals): argv.append(value)
    argv.extend(options)
    return {'schema':'axm.translation.cli-plan/v1','verdict':'PLAN_READY' if not errors else 'REFUSE','argv':argv if not errors else None,'cwd':tool_spec.get('cwd'),'shell':False,'capture':{'stdout':True,'stderr':True,'exit_code':True},'errors':errors,'executed':False}
