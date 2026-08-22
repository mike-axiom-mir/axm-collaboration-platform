from __future__ import annotations
import configparser, copy, io
from typing import Any


def _flatten(value: Any, prefix: str = '') -> dict[str, Any]:
    out={}
    if isinstance(value,dict):
        for key,child in value.items(): out.update(_flatten(child,f'{prefix}.{key}' if prefix else str(key)))
    else: out[prefix]=value
    return out


def _set(target: dict[str,Any], path: str, value: Any) -> None:
    parts=path.split('.'); cur=target
    for part in parts[:-1]: cur=cur.setdefault(part,{})
    cur[parts[-1]]=value


def _source(source: Any, source_format: str) -> dict[str, Any]:
    if source_format=='ini':
        parser=configparser.ConfigParser(interpolation=None); parser.optionxform=str; parser.read_file(io.StringIO(str(source)))
        return {f'{section}.{key}':value for section in parser.sections() for key,value in parser.items(section)}
    if source_format in {'registry','environment','preferences'} and isinstance(source,dict): return _flatten(source)
    raise ValueError('unsupported source format or source type')


def _coerce(value: Any, kind: str) -> Any:
    if kind=='string': return str(value)
    if kind=='integer': return int(value)
    if kind=='number': return float(value)
    if kind=='boolean':
        if isinstance(value,bool): return value
        lowered=str(value).strip().lower()
        if lowered in {'1','true','yes','on'}: return True
        if lowered in {'0','false','no','off'}: return False
        raise ValueError('invalid boolean')
    if kind=='json': return copy.deepcopy(value)
    raise ValueError('unsupported target type')


def run(source: Any, *, source_format: str, mappings: list[dict[str, Any]], defaults: dict[str, Any] | None = None) -> dict[str, Any]:
    try: flat=_source(source,source_format)
    except ValueError as exc: return {'verdict':'REFUSE','reason':str(exc),'written':False}
    target=copy.deepcopy(defaults or {}); used=set(); errors=[]; applied=[]
    for rule in mappings:
        src=rule.get('source'); dst=rule.get('target')
        if not src or not dst: errors.append({'reason':'invalid mapping rule'}); continue
        if src not in flat:
            if rule.get('required'): errors.append({'source':src,'reason':'required value missing'})
            continue
        try: value=_coerce(flat[src],rule.get('type','string'))
        except (ValueError,TypeError) as exc: errors.append({'source':src,'reason':str(exc)}); continue
        _set(target,dst,value); used.add(src); applied.append({'source':src,'target':dst,'type':rule.get('type','string')})
    sidecar={k:copy.deepcopy(v) for k,v in flat.items() if k not in used}
    return {'schema':'axm.translation.legacy-config/v1','verdict':'TRANSLATED' if not errors else ('PARTIAL' if applied else 'REFUSE'),'target':target,'applied':applied,'unmapped_sidecar':sidecar,'errors':errors,'written':False}
