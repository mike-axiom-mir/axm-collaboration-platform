
"""Detached AXM Transparency Log Inclusion Proof v0.1.0."""
from __future__ import annotations
import hashlib
from typing import Any,Dict,Mapping
STATES={"PASS","FAIL","UNKNOWN","NOT_RUN"}
class TransparencyProofError(ValueError):pass
def hex_bytes(value:str)->bytes:
    if not isinstance(value,str) or len(value)!=64:raise TransparencyProofError("hash must be 64 hexadecimal characters")
    try:return bytes.fromhex(value)
    except ValueError as exc:raise TransparencyProofError("invalid hexadecimal hash") from exc
def leaf_hash(entry:bytes)->bytes:return hashlib.sha256(b"\x00"+entry).digest()
def node_hash(left:bytes,right:bytes)->bytes:return hashlib.sha256(b"\x01"+left+right).digest()
class TransparencyLogInclusionProof:
    def verify(self,entry:bytes,proof:Mapping[str,Any],signed_root:Mapping[str,Any])->Dict[str,Any]:
        if not isinstance(entry,bytes) or not isinstance(proof,Mapping) or not isinstance(signed_root,Mapping):raise TransparencyProofError("entry bytes, proof, and signed root are required")
        index=proof.get("leaf_index");size=proof.get("tree_size");path=proof.get("path")
        if not isinstance(index,int) or not isinstance(size,int) or size<=0 or index<0 or index>=size or not isinstance(path,list):raise TransparencyProofError("invalid leaf index, tree size, or path")
        current=leaf_hash(entry)
        for item in path:
            position=item.get("position") if isinstance(item,Mapping) else None;sibling=hex_bytes(item.get("hash") if isinstance(item,Mapping) else None)
            if position=="left":current=node_hash(sibling,current)
            elif position=="right":current=node_hash(current,sibling)
            else:raise TransparencyProofError("path position must be left or right")
        expected=hex_bytes(signed_root.get("root_hash"));status=signed_root.get("signature_status")
        if status not in STATES or not isinstance(signed_root.get("log_id"),str) or not signed_root.get("log_id"):raise TransparencyProofError("invalid signed-root receipt")
        root_matches=current==expected
        failures=[] if root_matches else [{"type":"root_mismatch","computed":current.hex(),"expected":expected.hex()}]
        if status=="FAIL":failures.append({"type":"signed_root_signature"})
        uncertainty=[]
        if status in {"UNKNOWN","NOT_RUN"}:uncertainty.append({"type":"signed_root_signature","status":status})
        verdict="FAIL" if failures else ("UNKNOWN" if uncertainty else "PASS")
        return {"schema_version":"axm.verify.transparency-inclusion/0.1","verdict_state":verdict,"log_id":signed_root["log_id"],"leaf_index":index,"tree_size":size,"leaf_hash":leaf_hash(entry).hex(),"computed_root":current.hex(),"root_matches":root_matches,"failures":failures,"uncertainty":uncertainty,"log_operator_authenticated_by_module":False,"tree_consistency_proven":False,"append_only_behavior_proven":False,"authority":"NONE","canon":False}
