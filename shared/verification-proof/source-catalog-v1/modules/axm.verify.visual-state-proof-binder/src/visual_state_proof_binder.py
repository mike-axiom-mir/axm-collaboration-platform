"""Detached AXM Visual State Proof Binder v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping, Sequence

RECEIPT_STATES={"PASS","FAIL","UNKNOWN","NOT_RUN","STALE"}; OBS_STATES=RECEIPT_STATES; REVIEW={"ACCEPT","REJECT","NEEDS_WORK","NOT_REVIEWED"}
class VisualBindingError(ValueError):pass
class VisualStateProofBinder:
    def bind(self,artifact:Mapping[str,Any],technical_receipts:Sequence[Mapping[str,Any]],native_observation:Mapping[str,Any]|None=None,human_review:Mapping[str,Any]|None=None)->Dict[str,Any]:
        aid=artifact.get("artifact_id") if isinstance(artifact,Mapping) else None; digest=artifact.get("digest") if isinstance(artifact,Mapping) else None
        if not isinstance(aid,str) or not aid or not isinstance(digest,str) or not digest:raise VisualBindingError("artifact_id and digest are required")
        seen=set();receipts=[];mismatches=[];failures=[];uncertain=[]
        for raw in technical_receipts:
            rid=raw.get("receipt_id") if isinstance(raw,Mapping) else None;status=raw.get("status") if isinstance(raw,Mapping) else None
            if not isinstance(rid,str) or not rid or rid in seen or status not in RECEIPT_STATES:raise VisualBindingError("invalid or duplicate technical receipt")
            seen.add(rid);row=dict(raw);receipts.append(row)
            if row.get("subject_digest")!=digest:mismatches.append({"receipt_id":rid,"observed_subject_digest":row.get("subject_digest")})
            if status=="FAIL":failures.append({"surface":"technical_receipt","receipt_id":rid})
            elif status in {"UNKNOWN","NOT_RUN","STALE"}:uncertain.append({"surface":"technical_receipt","receipt_id":rid,"status":status})
        observation=None
        if native_observation is not None:
            status=native_observation.get("status") if isinstance(native_observation,Mapping) else None
            if status not in OBS_STATES or not native_observation.get("observation_id") or not native_observation.get("native_surface"):raise VisualBindingError("invalid native observation")
            observation=dict(native_observation)
            if observation.get("artifact_digest")!=digest:mismatches.append({"observation_id":observation.get("observation_id"),"observed_artifact_digest":observation.get("artifact_digest")})
            if status=="FAIL":failures.append({"surface":"native_observation","observation_id":observation.get("observation_id")})
            elif status in {"UNKNOWN","NOT_RUN","STALE"}:uncertain.append({"surface":"native_observation","observation_id":observation.get("observation_id"),"status":status})
        review=None
        if human_review is not None:
            decision=human_review.get("decision") if isinstance(human_review,Mapping) else None
            if decision not in REVIEW or not human_review.get("reviewer_id"):raise VisualBindingError("invalid human review")
            review=dict(human_review)
            if decision=="REJECT":failures.append({"surface":"human_review","reviewer_id":review.get("reviewer_id")})
        if mismatches or failures:verdict="FAIL"
        elif observation is None or uncertain:verdict="UNKNOWN"
        elif review is None or review.get("decision") in {"NEEDS_WORK","NOT_REVIEWED"}:verdict="HUMAN_REVIEW"
        else:verdict="PASS"
        return {"schema_version":"axm.verify.visual-state-binding/0.1","verdict_state":verdict,"artifact":{"artifact_id":aid,"digest":digest},"technical_receipts":receipts,"native_observation":observation,"human_review":review,"identity_mismatches":mismatches,"failures":failures,"uncertain_evidence":uncertain,"pixels_are_not_approval":True,"receipt_truth_reverified":False,"authority":"NONE","canon":False}
