from __future__ import annotations
import copy, re
from typing import Any


def _version(value: str) -> tuple[int,...]:
    match=re.match(r'^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?',str(value))
    if not match: raise ValueError('invalid version')
    return tuple(int(x or 0) for x in match.groups())


def validate_package(package: dict[str, Any], *, environment: dict[str, Any], installed: dict[str,str], require_signature: bool = True) -> dict[str, Any]:
    errors=[]; manifest=package.get('manifest',{})
    for field in ('id','version','content_sha256'):
        if not manifest.get(field): errors.append(f'missing_{field}')
    try: _version(manifest.get('version',''))
    except ValueError: errors.append('invalid_version')
    if package.get('observed_content_sha256')!=manifest.get('content_sha256'): errors.append('content_hash_mismatch')
    if require_signature and not package.get('signature_evidence',{}).get('verified',False): errors.append('signature_not_verified')
    for key,value in manifest.get('environment',{}).items():
        if environment.get(key)!=value: errors.append(f'environment_mismatch:{key}')
    for dep,constraint in manifest.get('dependencies',{}).items():
        current=installed.get(dep)
        if current is None: errors.append(f'missing_dependency:{dep}'); continue
        if isinstance(constraint,str) and constraint.startswith('>='):
            try:
                if _version(current)<_version(constraint[2:]): errors.append(f'dependency_too_old:{dep}')
            except ValueError: errors.append(f'invalid_dependency_version:{dep}')
        elif current!=constraint: errors.append(f'dependency_mismatch:{dep}')
    return {'verdict':'VERIFIED' if not errors else 'REFUSE','errors':errors,'manifest':copy.deepcopy(manifest),'installed':False}


def plan(action: str, package: dict[str, Any], *, current_version: str | None = None, rollback_version: str | None = None) -> dict[str, Any]:
    version=package.get('manifest',{}).get('version'); errors=[]
    if action not in {'install','pin','update','quarantine','rollback'}: errors.append('unsupported_action')
    if action=='update' and current_version and version:
        try:
            if _version(version)<=_version(current_version): errors.append('update_not_newer')
        except ValueError: errors.append('invalid_version')
    if action=='rollback' and not rollback_version: errors.append('rollback_version_required')
    return {'schema':'axm.translation.package-lifecycle-plan/v1','verdict':'PLAN_READY' if not errors else 'REFUSE','action':action,'package_id':package.get('manifest',{}).get('id'),'target_version':rollback_version if action=='rollback' else version,'current_version':current_version,'errors':errors,'performed':False,'canon_promoted':False}


def run(package: dict[str, Any], **kwargs: Any) -> dict[str, Any]: return validate_package(package,**kwargs)
