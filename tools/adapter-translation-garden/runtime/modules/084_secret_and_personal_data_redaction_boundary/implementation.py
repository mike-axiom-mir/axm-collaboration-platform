from __future__ import annotations
import hashlib
import re
from copy import deepcopy
from typing import Any

_DEFAULT_SECRET_KEYS={'authorization','password','passwd','token','access_token','refresh_token','api_key','apikey','secret','client_secret','private_key','cookie','set-cookie'}
_PATTERNS={
    'bearer_token':re.compile(r'(?i)\bBearer\s+[A-Za-z0-9._~+\-/]+=*'),
    'email':re.compile(r'(?<![\w.+-])[\w.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![\w.-])'),
    'ipv4':re.compile(r'(?<!\d)(?:\d{1,3}\.){3}\d{1,3}(?!\d)'),
}


def run(value: Any, *, secret_keys: list[str]|None=None, personal_keys: list[str]|None=None, detect_patterns: list[str]|None=None, replacement: str='[REDACTED]', fingerprint_salt: str|None=None) -> dict[str, Any]:
    secret={k.casefold() for k in (secret_keys or _DEFAULT_SECRET_KEYS)}
    personal={k.casefold() for k in (personal_keys or [])}
    patterns=[]
    for name in detect_patterns or ['bearer_token']:
        if name not in _PATTERNS: raise ValueError(f'unsupported redaction pattern: {name}')
        patterns.append((name,_PATTERNS[name]))
    findings=[]
    def fingerprint(raw: Any) -> str|None:
        if fingerprint_salt is None: return None
        return hashlib.sha256((fingerprint_salt+repr(raw)).encode('utf-8')).hexdigest()
    def walk(current: Any, path: str, key_kind: str|None=None) -> Any:
        if key_kind:
            findings.append({'path':path,'kind':key_kind,'fingerprint':fingerprint(current)})
            return f'{replacement}:{key_kind}'
        if isinstance(current,dict):
            out={}
            for key,item in current.items():
                folded=str(key).casefold()
                kind='secret_field' if folded in secret else 'personal_field' if folded in personal else None
                out[key]=walk(item,f'{path}.{key}',kind)
            return out
        if isinstance(current,list):
            return [walk(item,f'{path}[{i}]') for i,item in enumerate(current)]
        if isinstance(current,str):
            result=current
            for name,pattern in patterns:
                def repl(match):
                    findings.append({'path':path,'kind':name,'fingerprint':fingerprint(match.group(0))})
                    return f'{replacement}:{name}'
                result=pattern.sub(repl,result)
            return result
        return deepcopy(current)
    redacted=walk(value,'$')
    return {'schema':'axm.translation.redaction-report/v1','redacted':redacted,'finding_count':len(findings),'findings':findings,'coverage':'declared keys and enabled patterns only','original_values_logged':False,'complete_detection_claimed':False}
