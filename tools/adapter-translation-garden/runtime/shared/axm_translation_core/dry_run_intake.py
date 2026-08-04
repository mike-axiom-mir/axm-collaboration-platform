from __future__ import annotations
import hashlib,json
from pathlib import PurePosixPath
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def _safe(path: str) -> bool:
    p=PurePosixPath(str(path).replace('\\','/')); return not p.is_absolute() and '..' not in p.parts and bool(p.parts)

def simulate_dry_run_intake(order_plan: dict[str,Any], existing_paths: list[str], pack_files: dict[str,list[str]], target_prefix: str='incoming/adapters') -> dict[str,Any]:
    existing=set(str(x).replace('\\','/') for x in existing_paths); proposed=[]; unsafe=[]; duplicates=[]; collisions=[]; seen=set()
    for mid in order_plan.get('ordered_module_ids',[]):
        for rel in pack_files.get(mid,[]):
            if not _safe(rel): unsafe.append({'module_id':mid,'path':rel}); continue
            target=f"{target_prefix.rstrip('/')}/{mid}/{str(rel).replace(chr(92),'/')}"
            if target in seen: duplicates.append(target)
            if target in existing: collisions.append(target)
            seen.add(target); proposed.append({'module_id':mid,'source_path':rel,'target_path':target})
    body={'target_prefix':target_prefix,'proposed_files':proposed,'unsafe_paths':unsafe,'duplicate_targets':sorted(set(duplicates)),'existing_collisions':sorted(set(collisions)),'decision':'DRY_RUN_PASS' if order_plan.get('decision')=='READY_FOR_STAGED_INTAKE' and not unsafe and not duplicates and not collisions else 'HOLD','filesystem_writes':False,'archive_extraction':False,'automatic_install':False}
    return {'schema':'axm.translation.dry-run-intake/v1',**body,'dry_run_sha256':_hash(body)}

def verify_dry_run_intake(report: dict[str,Any]) -> dict[str,Any]:
    body={k:report.get(k) for k in ('target_prefix','proposed_files','unsafe_paths','duplicate_targets','existing_collisions','decision','filesystem_writes','archive_extraction','automatic_install')}; errors=[]
    if _hash(body)!=report.get('dry_run_sha256'): errors.append('hash')
    if any(report.get(k) is not False for k in ('filesystem_writes','archive_extraction','automatic_install')): errors.append('side_effect')
    if report.get('decision')=='DRY_RUN_PASS' and (report.get('unsafe_paths') or report.get('duplicate_targets') or report.get('existing_collisions')): errors.append('decision')
    return {'schema':'axm.translation.dry-run-intake-verification/v1','verdict':'PASS' if not errors else 'HOLD','errors':errors,'proposed_file_count':len(report.get('proposed_files',[]))}
