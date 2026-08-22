from __future__ import annotations
import hashlib,json,re
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def _version(value: Any) -> list[int]|None:
    if isinstance(value,(list,tuple)) and len(value)>=2:
        try: return [int(value[0]),int(value[1]),int(value[2]) if len(value)>2 else 0]
        except Exception: return None
    m=re.match(r'^(\d+)\.(\d+)(?:\.(\d+))?',str(value or ''))
    return [int(m.group(1)),int(m.group(2)),int(m.group(3) or 0)] if m else None

def normalize_host_profile(profile: dict[str,Any]) -> dict[str,Any]:
    os_family=str(profile.get('os_family','unknown')).strip().lower(); aliases={'win32':'windows','win':'windows','darwin':'macos','osx':'macos','gnu/linux':'linux'}; os_family=aliases.get(os_family,os_family)
    body={'os_family':os_family if os_family in {'windows','linux','macos'} else 'unknown','architecture':str(profile.get('architecture','unknown')).lower(),'python_version':_version(profile.get('python_version')),'free_space_mb':max(0,int(profile.get('free_space_mb',0) or 0)),'writable_staging':profile.get('writable_staging') if isinstance(profile.get('writable_staging'),bool) else None,'standard_library_available':profile.get('standard_library_available') if isinstance(profile.get('standard_library_available'),bool) else None,'network_available':profile.get('network_available') if isinstance(profile.get('network_available'),bool) else None,'probe_executed':bool(profile.get('probe_executed',False))}
    return {'schema':'axm.translation.local-host-profile/v1',**body,'profile_sha256':_hash(body)}

def reference_host_requirements() -> dict[str,Any]:
    return {'schema':'axm.translation.local-host-requirements/v1','supported_os':['windows','linux','macos'],'python_minimum':[3,10,0],'minimum_free_space_mb':100,'writable_staging_required':True,'standard_library_required':True,'network_required':False,'native_compiler_required':False,'external_packages_required':False}

def evaluate_host_compatibility(profile: dict[str,Any], requirements: dict[str,Any]|None=None) -> dict[str,Any]:
    p=normalize_host_profile(profile); r=requirements or reference_host_requirements(); checks=[]
    def add(name,state,observed,required): checks.append({'name':name,'state':state,'observed':observed,'required':required})
    add('os','PASS' if p['os_family'] in r['supported_os'] else ('UNKNOWN' if p['os_family']=='unknown' else 'HOLD'),p['os_family'],r['supported_os'])
    add('python','PASS' if p['python_version'] and tuple(p['python_version'])>=tuple(r['python_minimum']) else ('UNKNOWN' if p['python_version'] is None else 'HOLD'),p['python_version'],r['python_minimum'])
    add('free_space','PASS' if p['free_space_mb']>=int(r['minimum_free_space_mb']) else 'HOLD',p['free_space_mb'],r['minimum_free_space_mb'])
    add('writable_staging','PASS' if p['writable_staging'] is True else ('UNKNOWN' if p['writable_staging'] is None else 'HOLD'),p['writable_staging'],True)
    add('standard_library','PASS' if p['standard_library_available'] is True else ('UNKNOWN' if p['standard_library_available'] is None else 'HOLD'),p['standard_library_available'],True)
    states={c['state'] for c in checks}; verdict='HOLD' if 'HOLD' in states else ('HOST_CHECK_REQUIRED' if 'UNKNOWN' in states or not p['probe_executed'] else 'PASS')
    return {'schema':'axm.translation.local-host-compatibility/v1','profile':p,'requirements':r,'checks':checks,'verdict':verdict,'network_required':False,'automatic_install':False}

def verify_host_compatibility(review: dict[str,Any]) -> dict[str,Any]:
    states={x.get('state') for x in review.get('checks',[])}; expected='HOLD' if 'HOLD' in states else ('HOST_CHECK_REQUIRED' if 'UNKNOWN' in states or not review.get('profile',{}).get('probe_executed') else 'PASS'); errors=[]
    if review.get('verdict')!=expected: errors.append('verdict')
    if review.get('network_required') is not False or review.get('automatic_install') is not False: errors.append('authority')
    return {'schema':'axm.translation.local-host-compatibility-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':errors}
