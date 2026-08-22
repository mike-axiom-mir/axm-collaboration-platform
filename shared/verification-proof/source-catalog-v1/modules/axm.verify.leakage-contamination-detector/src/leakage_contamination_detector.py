"""Detached AXM Benchmark Leakage and Contamination Detector v0.1.0."""
from __future__ import annotations
import hashlib,re
from typing import Any,Dict,Mapping,Sequence
class LeakageDetectionError(ValueError):pass

def _normalize(value:str)->str:return re.sub(r"\s+"," ",value.strip().lower())
def _items(values:Sequence[Mapping[str,Any]],label:str)->list[Dict[str,Any]]:
    if not isinstance(values,Sequence) or isinstance(values,(str,bytes)):raise LeakageDetectionError(f"{label} sequence required")
    out=[];ids=set()
    for raw in values:
        if not isinstance(raw,Mapping) or not isinstance(raw.get("id"),str) or not raw.get("id") or raw["id"] in ids:raise LeakageDetectionError(f"unique {label} ids required")
        content=raw.get("content")
        if not isinstance(content,(str,bytes)):raise LeakageDetectionError("content must be text or bytes")
        ids.add(raw["id"]);data=content.encode() if isinstance(content,str) else content
        out.append({"id":raw["id"],"sha256":hashlib.sha256(data).hexdigest(),"normalized":_normalize(content) if isinstance(content,str) else None,"metadata":raw.get("metadata",{})})
    return out
class LeakageContaminationDetector:
    def detect(self,training_items:Sequence[Mapping[str,Any]],evaluation_items:Sequence[Mapping[str,Any]],output_items:Sequence[Mapping[str,Any]]|None=None,hint_patterns:Sequence[str]=())->Dict[str,Any]:
        train=_items(training_items,"training");evals=_items(evaluation_items,"evaluation");outputs=_items(output_items or [],"output")
        findings=[];train_ids={x["id"] for x in train};train_hash={x["sha256"]:x["id"] for x in train};train_norm={x["normalized"]:x["id"] for x in train if x["normalized"]}
        for item in evals:
            if item["id"] in train_ids:findings.append({"type":"ID_OVERLAP","evaluation_id":item["id"]})
            if item["sha256"] in train_hash:findings.append({"type":"EXACT_CONTENT_OVERLAP","evaluation_id":item["id"],"training_id":train_hash[item["sha256"]]})
            elif item["normalized"] and item["normalized"] in train_norm:findings.append({"type":"NORMALIZED_TEXT_OVERLAP","evaluation_id":item["id"],"training_id":train_norm[item["normalized"]]})
            meta=item["metadata"] if isinstance(item["metadata"],Mapping) else {}
            if meta.get("hidden_hint") not in (None,False,""):findings.append({"type":"HIDDEN_HINT_DECLARED","evaluation_id":item["id"]})
            for pattern in hint_patterns:
                if not isinstance(pattern,str) or not pattern:raise LeakageDetectionError("non-empty hint patterns required")
                if item["normalized"] and pattern.lower() in item["normalized"]:findings.append({"type":"HINT_PATTERN_MATCH","evaluation_id":item["id"],"pattern":pattern})
        eval_hash={x["sha256"]:x["id"] for x in evals}
        for item in outputs:
            if item["sha256"] in eval_hash:findings.append({"type":"OUTPUT_EXACTLY_MATCHES_EVALUATION_CONTENT","output_id":item["id"],"evaluation_id":eval_hash[item["sha256"]]})
        severity="FAIL" if any(x["type"] in {"ID_OVERLAP","EXACT_CONTENT_OVERLAP","HIDDEN_HINT_DECLARED","HINT_PATTERN_MATCH"} for x in findings) else ("HUMAN_REVIEW" if findings else "UNKNOWN")
        return {"schema_version":"axm.verify.leakage-contamination-detection/0.1","verdict_state":severity,"findings":findings,"checked_surfaces":["identifier overlap","exact bytes","normalized exact text","declared or patterned hints","exact output/evaluation bytes"],"semantic_contamination_excluded":False,"training_corpus_completeness_proven":False,"authority":"NONE","canon":False}
