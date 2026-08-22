from __future__ import annotations
import ntpath
import posixpath
from pathlib import PureWindowsPath
from typing import Any
from urllib.parse import unquote, urlsplit

_WINDOWS_RESERVED={'CON','PRN','AUX','NUL',*(f'COM{i}' for i in range(1,10)),*(f'LPT{i}' for i in range(1,10))}


def _decode_repeated(value: str, rounds: int = 3) -> str:
    current=value
    for _ in range(rounds):
        decoded=unquote(current)
        if decoded==current: break
        current=decoded
    return current


def evaluate_path(requested_path: str, *, allowed_roots: list[str], platform: str='posix', resolved_path: str|None=None, require_resolved: bool=True) -> dict[str, Any]:
    if not requested_path or '\x00' in requested_path:
        return {'allowed':False,'reason':'empty or NUL-containing path','checks':{}}
    decoded=_decode_repeated(requested_path)
    module=ntpath if platform=='windows' else posixpath
    separators=('\\','/') if platform=='windows' else ('/',)
    raw_parts=[p for p in decoded.replace('\\','/').split('/') if p not in ('','.')] 
    traversal='..' in raw_parts
    roots=[module.abspath(r) for r in allowed_roots]
    if not roots:
        return {'allowed':False,'reason':'no confined root declared','checks':{'root_declared':False}}
    if platform=='windows':
        parts=PureWindowsPath(decoded).parts
        reserved=any(p.rstrip(' .').split('.')[0].upper() in _WINDOWS_RESERVED for p in parts)
    else:
        reserved=False
    requested_abs=module.abspath(decoded if module.isabs(decoded) else module.join(roots[0],decoded))
    def within(path: str) -> bool:
        try:
            return any(module.commonpath([path,root])==root for root in roots)
        except ValueError:
            return False
    lexical=within(requested_abs)
    resolved_ok=None if resolved_path is None else within(module.abspath(resolved_path))
    checks={'root_declared':True,'no_traversal':not traversal,'lexically_confined':lexical,'no_reserved_device_name':not reserved,'resolved_confined':resolved_ok}
    if require_resolved and resolved_path is None:
        checks['resolution_supplied']=False
        return {'allowed':False,'reason':'resolved path required to prove no symlink escape','normalized':requested_abs,'checks':checks,'status':'RESOLUTION_REQUIRED'}
    checks['resolution_supplied']=resolved_path is not None
    allowed=(not traversal and lexical and not reserved and (resolved_ok is not False) and (not require_resolved or resolved_ok is True))
    return {'schema':'axm.translation.path-confinement-decision/v1','allowed':allowed,'reason':'confined' if allowed else 'path confinement failed','normalized':requested_abs,'checks':checks,'status':'PASS' if allowed else 'DENY'}


def _url_once(url: str, *, allowed_schemes: list[str], allowed_hosts: list[str], allowed_ports: list[int]|None, allowed_path_prefixes: list[str]|None) -> dict[str, Any]:
    decoded=_decode_repeated(url)
    parsed=urlsplit(decoded)
    host=(parsed.hostname or '').lower()
    default_port=443 if parsed.scheme=='https' else 80 if parsed.scheme=='http' else None
    port=parsed.port or default_port
    path=posixpath.normpath(parsed.path or '/')
    traversal='..' in [p for p in _decode_repeated(parsed.path).split('/') if p]
    checks={
        'scheme':parsed.scheme in allowed_schemes,
        'host':host in {h.lower() for h in allowed_hosts},
        'port':allowed_ports is None or port in allowed_ports,
        'no_userinfo':parsed.username is None and parsed.password is None,
        'no_traversal':not traversal,
        'path_prefix':allowed_path_prefixes is None or any(path==prefix or path.startswith(prefix.rstrip('/')+'/') for prefix in allowed_path_prefixes),
    }
    return {'url':url,'normalized':parsed._replace(path=path).geturl(),'allowed':all(checks.values()),'checks':checks,'host':host,'port':port}


def evaluate_url(url: str, *, allowed_schemes: list[str], allowed_hosts: list[str], allowed_ports: list[int]|None=None, allowed_path_prefixes: list[str]|None=None, redirects: list[str]|None=None) -> dict[str, Any]:
    chain=[url]+list(redirects or [])
    hops=[_url_once(item,allowed_schemes=allowed_schemes,allowed_hosts=allowed_hosts,allowed_ports=allowed_ports,allowed_path_prefixes=allowed_path_prefixes) for item in chain]
    allowed=all(h['allowed'] for h in hops)
    return {'schema':'axm.translation.url-confinement-decision/v1','allowed':allowed,'reason':'all URL hops confined' if allowed else 'one or more URL hops escaped policy','hops':hops,'network_request_performed':False}


def run(kind: str, **kwargs: Any) -> dict[str, Any]:
    if kind=='path': return evaluate_path(**kwargs)
    if kind=='url': return evaluate_url(**kwargs)
    raise ValueError('kind must be path or url')
