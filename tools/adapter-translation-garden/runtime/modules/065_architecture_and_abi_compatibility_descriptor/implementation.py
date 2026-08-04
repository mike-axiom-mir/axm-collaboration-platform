from __future__ import annotations
import platform
import struct
import sys
from typing import Any

_ARCH={'amd64':'x86_64','x64':'x86_64','x86-64':'x86_64','aarch64':'arm64'}

def _arch(value: str) -> str: return _ARCH.get(value.casefold(),value.casefold())
def _version(value: str) -> tuple[int,...]:
    out=[]
    for part in value.split('.'):
        digits=''.join(ch for ch in part if ch.isdigit())
        if not digits: break
        out.append(int(digits))
    return tuple(out)

def local_descriptor() -> dict[str,Any]:
    machine=platform.machine() or 'unknown'
    return {'schema':'axm.translation.abi-descriptor/v1','architecture':_arch(machine),'word_size':struct.calcsize('P')*8,'endianness':sys.byteorder,'os':platform.system().lower(),'calling_convention':'unknown','runtime_libraries':{'python':platform.python_version()},'cpu_features':[],'source':'local_read_only_inspection'}

def compare(requirements: dict[str,Any], host: dict[str,Any]) -> dict[str,Any]:
    checks={}; details=[]
    for field in ['architecture','word_size','endianness','os','calling_convention']:
        if field not in requirements: continue
        required=requirements[field]; actual=host.get(field)
        if field=='architecture' and actual is not None: actual=_arch(str(actual))
        allowed=required if isinstance(required,list) else [required]
        if field=='architecture': allowed=[_arch(str(v)) for v in allowed]
        ok=actual in allowed; checks[field]=ok
        if not ok: details.append({'field':field,'required':allowed,'actual':actual})
    required_features=set(requirements.get('cpu_features',[])); host_features=set(host.get('cpu_features',[]))
    if required_features:
        checks['cpu_features']=required_features<=host_features
        if not checks['cpu_features']: details.append({'field':'cpu_features','missing':sorted(required_features-host_features)})
    for name,min_version in requirements.get('runtime_libraries',{}).items():
        actual=host.get('runtime_libraries',{}).get(name); ok=actual is not None and _version(actual)>=_version(str(min_version)); checks[f'runtime:{name}']=ok
        if not ok: details.append({'field':f'runtime:{name}','minimum':min_version,'actual':actual})
    return {'schema':'axm.translation.abi-compatibility/v1','verdict':'COMPATIBLE' if checks and all(checks.values()) else 'INCOMPATIBLE' if any(v is False for v in checks.values()) else 'UNPROVEN','checks':checks,'details':details,'launch_performed':False}

def run(requirements: dict[str,Any], host: dict[str,Any]|None=None) -> dict[str,Any]: return compare(requirements,host or local_descriptor())
