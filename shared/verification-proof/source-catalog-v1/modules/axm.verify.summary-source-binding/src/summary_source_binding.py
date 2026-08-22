"""Detached AXM Evidence Summary-to-Source Binder v0.1.0."""
from __future__ import annotations
import hashlib,json
from typing import Any,Dict,Mapping

STATES={"PASS","FAIL","UNKNOWN","NOT_RUN","STALE"}
class SummaryBindingError(ValueError):pass

def _hex(value:Any)->bool:
    if not isinstance(value,str) or len(value)!=64:return False
    try:bytes.fromhex(value);return True
    except ValueError:return False

class SummarySourceBinding:
    def bind(self,summary:Mapping[str,Any],sources:Mapping[str,Mapping[str,Any]])->Dict[str,Any]:
        if not isinstance(summary,Mapping) or not isinstance(sources,Mapping):raise SummaryBindingError("summary and source catalog required")
        if not isinstance(summary.get("summary_id"),str) or not summary["summary_id"] or not isinstance(summary.get("text"),str):raise SummaryBindingError("summary id and text required")
        claims=summary.get("claims")
        if not isinstance(claims,list):raise SummaryBindingError("claims list required")
        failures=[];uncertainty=[];bindings=[];seen=set()
        for claim in claims:
            if not isinstance(claim,Mapping) or not isinstance(claim.get("claim_id"),str) or not claim["claim_id"] or not isinstance(claim.get("text"),str):raise SummaryBindingError("invalid claim")
            cid=claim["claim_id"]
            if cid in seen:raise SummaryBindingError("duplicate claim id")
            seen.add(cid);refs=claim.get("source_refs")
            if not isinstance(refs,list) or not refs:failures.append({"type":"claim_without_source","claim_id":cid});continue
            for ref in refs:
                if not isinstance(ref,Mapping) or not isinstance(ref.get("source_id"),str) or not _hex(ref.get("digest")):raise SummaryBindingError("invalid source reference")
                source=sources.get(ref["source_id"])
                record={"claim_id":cid,"source_id":ref["source_id"],"digest_matches":False,"locator_matches":False}
                if not isinstance(source,Mapping):failures.append({"type":"missing_source","claim_id":cid,"source_id":ref["source_id"]});bindings.append(record);continue
                if not _hex(source.get("digest")) or source.get("availability_status") not in STATES:raise SummaryBindingError("invalid source catalog record")
                record["digest_matches"]=source["digest"]==ref["digest"]
                record["locator_matches"]=ref.get("locator")==source.get("locator")
                if not record["digest_matches"]:failures.append({"type":"digest_mismatch","claim_id":cid,"source_id":ref["source_id"]})
                if not record["locator_matches"]:failures.append({"type":"locator_mismatch","claim_id":cid,"source_id":ref["source_id"]})
                status=source["availability_status"]
                if status=="FAIL":failures.append({"type":"source_unavailable","claim_id":cid,"source_id":ref["source_id"]})
                elif status in {"UNKNOWN","NOT_RUN","STALE"}:uncertainty.append({"type":"source_state","claim_id":cid,"source_id":ref["source_id"],"status":status})
                bindings.append(record)
        canonical=json.dumps({"summary_id":summary["summary_id"],"bindings":bindings},sort_keys=True,separators=(",",":")).encode()
        verdict="FAIL" if failures else ("UNKNOWN" if uncertainty else "PASS")
        return {"schema_version":"axm.verify.summary-source-binding/0.1","verdict_state":verdict,"summary_id":summary["summary_id"],"binding_sha256":hashlib.sha256(canonical).hexdigest(),"bindings":bindings,"failures":failures,"uncertainty":uncertainty,"semantic_support_proven":False,"summary_authoritative":False,"authority":"NONE","canon":False}
