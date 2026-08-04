from __future__ import annotations
from typing import Any

def _authority_unchanged(old: dict[str, Any], new: dict[str, Any]) -> bool:
    return old.get('authority_mode')==new.get('authority_mode') and old.get('default_enabled') is False and new.get('default_enabled') is False

def compare_pack_manifests(old: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
    same_module=old.get('module_id')==new.get('module_id') and old.get('module_number')==new.get('module_number')
    code_same=old.get('files_sha256',old.get('payload_files_sha256',{})).get('module/implementation.py')==new.get('payload_files_sha256',{}).get('module/implementation.py')
    authority_same=_authority_unchanged(old,new)
    revision_forward=int(new.get('pack_revision',1))>int(old.get('pack_revision',1))
    verdict='REVIEWABLE_COMPATIBLE_PACKAGE_REVISION' if same_module and code_same and authority_same and revision_forward else 'HOLD'
    return {'schema':'axm.translation.pack-comparison/v1','verdict':verdict,'same_module':same_module,'module_code_unchanged':code_same,'authority_unchanged':authority_same,'revision_forward':revision_forward,'automatic_install':False,'executed':False}

def build_upgrade_plan(old: dict[str, Any], new: dict[str, Any], *, previous_pack_sha256: str) -> dict[str, Any]:
    comparison=compare_pack_manifests(old,new)
    return {'schema':'axm.translation.package-upgrade-plan/v1','module_id':new.get('module_id'),'from_pack_revision':int(old.get('pack_revision',1)),'to_pack_revision':int(new.get('pack_revision',1)),'previous_pack_sha256':previous_pack_sha256,'verdict':comparison['verdict'],'comparison':comparison,'steps':['verify_previous_pack_hash','verify_new_payload_hashes','review_shared_contract_changes','run_smoke_test','human_accept_or_reject'],'automatic_install':False,'rollback_reference_required':True,'executed':False}

def build_downgrade_plan(current: dict[str, Any], target: dict[str, Any], *, target_pack_sha256: str) -> dict[str, Any]:
    same=current.get('module_id')==target.get('module_id'); authority=_authority_unchanged(target,current)
    return {'schema':'axm.translation.package-downgrade-plan/v1','module_id':current.get('module_id'),'target_pack_sha256':target_pack_sha256,'verdict':'REVIEWABLE' if same and authority else 'HOLD','automatic_install':False,'executed':False}

def verify_payload_hashes(files: dict[str, bytes], expected: dict[str, str]) -> dict[str, Any]:
    import hashlib
    missing=sorted(set(expected)-set(files)); extra=sorted(set(files)-set(expected)); mismatched=sorted(k for k in set(expected)&set(files) if hashlib.sha256(files[k]).hexdigest()!=expected[k])
    return {'schema':'axm.translation.payload-hash-verification/v1','verdict':'PASS' if not missing and not extra and not mismatched else 'FAIL','missing':missing,'extra':extra,'mismatched':mismatched,'executed':False}
