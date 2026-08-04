from __future__ import annotations
import hashlib, json
from typing import Any

def _hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()).hexdigest()

def build_pack_recovery_manifest(module_id: str, pack_sha256: str, pack_revision: int, previous_pack_sha256: str | None, rollback_candidates: list[dict[str, Any]], required_files: list[str]) -> dict[str, Any]:
    candidates=sorted([{'pack_sha256':str(x['pack_sha256']),'pack_revision':int(x['pack_revision']),'verified':bool(x.get('verified',False)),'compatible':bool(x.get('compatible',False))} for x in rollback_candidates],key=lambda x:x['pack_revision'],reverse=True)
    body={'module_id':str(module_id),'pack_sha256':str(pack_sha256),'pack_revision':int(pack_revision),'previous_pack_sha256':previous_pack_sha256,'rollback_candidates':candidates,'required_files':sorted(set(map(str,required_files))),'automatic_restore':False,'automatic_downgrade':False}
    return {'schema':'axm.translation.pack-recovery-manifest/v1',**body,'manifest_sha256':_hash(body)}

def verify_pack_recovery_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    body={k:manifest.get(k) for k in ('module_id','pack_sha256','pack_revision','previous_pack_sha256','rollback_candidates','required_files','automatic_restore','automatic_downgrade')}
    hash_valid=_hash(body)==manifest.get('manifest_sha256')
    chain_visible=(manifest.get('pack_revision')==1) or bool(manifest.get('previous_pack_sha256'))
    candidates=[x for x in manifest.get('rollback_candidates',[]) if x.get('verified') and x.get('compatible') and int(x.get('pack_revision',0))<int(manifest.get('pack_revision',0))]
    return {'valid':hash_valid and chain_visible,'hash_valid':hash_valid,'chain_visible':chain_visible,'reviewable_candidates':len(candidates),'verdict':'PASS' if hash_valid and chain_visible and candidates else 'HOLD'}

def select_pack_recovery_candidate(manifest: dict[str, Any]) -> dict[str, Any]:
    eligible=[x for x in manifest.get('rollback_candidates',[]) if x.get('verified') and x.get('compatible') and int(x.get('pack_revision',0))<int(manifest.get('pack_revision',0))]
    eligible.sort(key=lambda x:x['pack_revision'],reverse=True)
    return {'decision':'SELECT_FOR_HUMAN_REVIEW' if eligible else 'HOLD','candidate':eligible[0] if eligible else None,'automatic_restore':False,'executed':False}
