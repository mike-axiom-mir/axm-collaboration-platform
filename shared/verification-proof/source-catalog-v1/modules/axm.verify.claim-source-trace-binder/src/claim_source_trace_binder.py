"""Detached AXM Claim-to-Source Trace Binder v0.1.0."""
from __future__ import annotations

from typing import Any, Dict, Mapping
import copy
import hashlib
import json

LOCAL_COPY_STATES = ("CAPTURED", "NOT_CAPTURED")

class SourceTraceBindingError(ValueError):
    """A source trace is incomplete or ambiguous."""

def _text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise SourceTraceBindingError(f"{field} must be a non-empty string")
    return value.strip()

def _validate_local_copy(raw: Any) -> Dict[str, Any]:
    if not isinstance(raw, Mapping):
        raise SourceTraceBindingError("local_evidence_copy must be an object")
    item = copy.deepcopy(dict(raw))
    status = _text(item.get("status"), "local_evidence_copy.status").upper()
    if status not in LOCAL_COPY_STATES:
        raise SourceTraceBindingError("local_evidence_copy.status must be CAPTURED or NOT_CAPTURED")
    item["status"] = status
    if status == "CAPTURED":
        for field in ("path", "digest_algorithm", "digest"):
            item[field] = _text(item.get(field), f"local_evidence_copy.{field}")
        item.pop("reason", None)
    else:
        item["reason"] = _text(item.get("reason"), "local_evidence_copy.reason")
        item.pop("path", None)
        item.pop("digest_algorithm", None)
        item.pop("digest", None)
    return item

def bind_claim_to_source(claim_id: str, source: Mapping[str, Any]) -> Dict[str, Any]:
    cid = _text(claim_id, "claim_id")
    if not isinstance(source, Mapping):
        raise SourceTraceBindingError("source must be an object")
    item = copy.deepcopy(dict(source))
    for field in ("source_id", "source_type", "title", "source_version", "locator", "observed_date", "excerpt"):
        item[field] = _text(item.get(field), f"source.{field}")
    if not isinstance(item.get("location"), Mapping) or not item["location"]:
        raise SourceTraceBindingError("source.location must be a non-empty object")
    item["location"] = copy.deepcopy(dict(item["location"]))
    item["local_evidence_copy"] = _validate_local_copy(item.get("local_evidence_copy"))

    identity_material = {"claim_id": cid, "source": item}
    trace_id = "source-trace:" + hashlib.sha256(json.dumps(identity_material, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
    return {
        "schema_version": "axm.verify.claim-source-trace/0.1",
        "trace_id": trace_id,
        "claim_id": cid,
        "source": item,
        "support_status": "UNCHECKED",
        "quote_fidelity_status": "NOT_RUN",
        "network_action": "NONE",
        "authority": "NONE",
        "canon": False,
    }
