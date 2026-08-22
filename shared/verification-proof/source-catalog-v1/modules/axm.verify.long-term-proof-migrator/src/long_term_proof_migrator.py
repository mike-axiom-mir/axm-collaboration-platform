"""Detached AXM Long-Term Proof and Schema Migrator v0.1.0."""
from __future__ import annotations
import hashlib,json
from typing import Any,Dict,Mapping,Sequence
class LongTermProofMigrationError(ValueError):pass

def _digest(data:bytes)->str:return hashlib.sha256(data).hexdigest()
def _canonical(value:Any)->bytes:
    try:return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False,allow_nan=False).encode()
    except (TypeError,ValueError) as exc:raise LongTermProofMigrationError("lineage must be deterministic JSON") from exc
class LongTermProofMigrator:
    def migrate(self,original_bytes:bytes,migrated_bytes:bytes,source_schema:str,target_schema:str,steps:Sequence[Mapping[str,Any]])->Dict[str,Any]:
        if not isinstance(original_bytes,bytes) or not isinstance(migrated_bytes,bytes):raise LongTermProofMigrationError("original and migrated content must be bytes")
        if not isinstance(source_schema,str) or not source_schema or not isinstance(target_schema,str) or not target_schema or source_schema==target_schema:raise LongTermProofMigrationError("distinct non-empty schemas required")
        if not isinstance(steps,Sequence) or isinstance(steps,(str,bytes)) or not steps:raise LongTermProofMigrationError("non-empty migration lineage required")
        original_sha=_digest(original_bytes);migrated_sha=_digest(migrated_bytes);lineage=[];expected_schema=source_schema;expected_hash=original_sha;ids=set()
        for raw in steps:
            if not isinstance(raw,Mapping):raise LongTermProofMigrationError("step mapping required")
            step={k:raw.get(k) for k in ("step_id","from_schema","to_schema","operation","input_sha256","output_sha256")}
            if any(not isinstance(step[k],str) or not step[k] for k in step):raise LongTermProofMigrationError("complete string step fields required")
            if step["step_id"] in ids:raise LongTermProofMigrationError("duplicate step id")
            if step["from_schema"]!=expected_schema or step["input_sha256"]!=expected_hash:raise LongTermProofMigrationError("broken migration lineage")
            ids.add(step["step_id"]);expected_schema=step["to_schema"];expected_hash=step["output_sha256"]
            lineage.append({**step,"notes":raw.get("notes","")})
        if expected_schema!=target_schema or expected_hash!=migrated_sha:raise LongTermProofMigrationError("final migration binding mismatch")
        packet_core={"source_schema":source_schema,"target_schema":target_schema,"original_sha256":original_sha,"migrated_sha256":migrated_sha,"lineage":lineage}
        return {"schema_version":"axm.verify.long-term-proof-migration/0.1","verdict_state":"PASS","original_bytes":original_bytes,"migrated_bytes":migrated_bytes,**packet_core,"packet_sha256":_digest(_canonical(packet_core)),"original_preserved":True,"migration_executed":False,"signature_validity_reestablished":False,"authority":"NONE","canon":False}
