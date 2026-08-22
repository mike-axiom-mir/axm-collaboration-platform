"""Detached AXM Evidence Chain-of-Custody Ledger v0.1.0."""
from __future__ import annotations
import copy,hashlib,json
from datetime import datetime
from typing import Any,Dict,Mapping,Sequence

ACTIONS={"CREATE","MOVE","TRANSFORM","REVIEW","ACCEPT","REJECT","REDACT"}
ZERO="0"*64
class CustodyLedgerError(ValueError):pass

def _time(value:str)->datetime:
    if not isinstance(value,str) or not value:raise CustodyLedgerError("timestamp required")
    try:return datetime.fromisoformat(value.replace("Z","+00:00"))
    except ValueError as exc:raise CustodyLedgerError("timestamp must be ISO-8601") from exc

def _hash(payload:Mapping[str,Any])->str:
    try:data=json.dumps(payload,sort_keys=True,separators=(",",":"),ensure_ascii=False,allow_nan=False).encode()
    except (TypeError,ValueError) as exc:raise CustodyLedgerError("event must be JSON-compatible") from exc
    return hashlib.sha256(data).hexdigest()

class EvidenceChainOfCustodyLedger:
    def __init__(self)->None:self.entries=[]
    def append(self,event:Mapping[str,Any])->Dict[str,Any]:
        if not isinstance(event,Mapping):raise CustodyLedgerError("event mapping required")
        required=("object_id","actor","actor_type","action","timestamp","details")
        if any(key not in event for key in required):raise CustodyLedgerError("missing required event field")
        if any(not isinstance(event[key],str) or not event[key] for key in ("object_id","actor","actor_type")):raise CustodyLedgerError("identity fields must be non-empty strings")
        if event["action"] not in ACTIONS:raise CustodyLedgerError("unsupported custody action")
        timestamp=_time(event["timestamp"])
        if self.entries and timestamp < _time(self.entries[-1]["timestamp"]):raise CustodyLedgerError("timestamps must be monotonic")
        payload={"schema_version":"axm.verify.evidence-custody-entry/0.1","sequence":len(self.entries)+1,"object_id":event["object_id"],"actor":event["actor"],"actor_type":event["actor_type"],"action":event["action"],"timestamp":event["timestamp"],"details":copy.deepcopy(event["details"]),"claimed_authority_scope":event.get("claimed_authority_scope"),"previous_hash":self.entries[-1]["entry_hash"] if self.entries else ZERO,"identity_authenticated_by_module":False,"authority_authenticated_by_module":False,"canon":False}
        payload["entry_hash"]=_hash(payload);self.entries.append(payload);return copy.deepcopy(payload)
    def verify(self,entries:Sequence[Mapping[str,Any]]|None=None)->Dict[str,Any]:
        rows=list(self.entries if entries is None else entries);failures=[];previous=ZERO;last=None
        for index,row in enumerate(rows,1):
            if not isinstance(row,Mapping):failures.append({"sequence":index,"type":"invalid_entry"});continue
            supplied=row.get("entry_hash");body=dict(row);body.pop("entry_hash",None)
            if row.get("sequence")!=index:failures.append({"sequence":index,"type":"sequence_mismatch"})
            if row.get("previous_hash")!=previous:failures.append({"sequence":index,"type":"previous_hash_mismatch"})
            try:computed=_hash(body);current_time=_time(row.get("timestamp"))
            except CustodyLedgerError:computed=None;current_time=None;failures.append({"sequence":index,"type":"invalid_entry_content"})
            if computed!=supplied:failures.append({"sequence":index,"type":"entry_hash_mismatch"})
            if current_time is not None and last is not None and current_time<last:failures.append({"sequence":index,"type":"timestamp_regression"})
            if current_time is not None:last=current_time
            previous=supplied if isinstance(supplied,str) else previous
        return {"schema_version":"axm.verify.evidence-custody-verification/0.1","verdict_state":"FAIL" if failures else "PASS","entry_count":len(rows),"head_hash":previous,"failures":failures,"actor_identity_authenticated":False,"authority":"NONE","canon":False}
