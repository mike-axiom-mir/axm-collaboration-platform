"""Detached AXM Motion Sequence Proof v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping, Sequence

PLAYBACK={"PASS","FAIL","UNKNOWN","NOT_RUN","STALE"}
class MotionProofError(ValueError):pass
class MotionSequenceProof:
    def verify(self,frames:Sequence[Mapping[str,Any]],timing_contract:Mapping[str,Any],playback_evidence:Mapping[str,Any]|None=None)->Dict[str,Any]:
        if len(frames)<2:raise MotionProofError("at least two frames are required")
        max_gap=timing_contract.get("max_gap_ms") if isinstance(timing_contract,Mapping) else None;max_duration=timing_contract.get("max_duration_ms") if isinstance(timing_contract,Mapping) else None
        if not isinstance(max_gap,(int,float)) or max_gap<=0 or (max_duration is not None and (not isinstance(max_duration,(int,float)) or max_duration<=0)):raise MotionProofError("invalid timing contract")
        normalized=[];seen=set()
        for raw in frames:
            idx=raw.get("index") if isinstance(raw,Mapping) else None;ts=raw.get("timestamp_ms") if isinstance(raw,Mapping) else None;digest=raw.get("digest") if isinstance(raw,Mapping) else None
            if not isinstance(idx,int) or idx in seen or not isinstance(ts,(int,float)) or not isinstance(digest,str) or not digest:raise MotionProofError("invalid or duplicate frame")
            seen.add(idx);normalized.append(dict(raw))
        violations=[]
        for expected,row in enumerate(normalized, start=timing_contract.get("start_index",0)):
            if row["index"]!=expected:violations.append({"type":"frame_index","expected":expected,"observed":row["index"]})
        gaps=[]
        for left,right in zip(normalized,normalized[1:]):
            gap=right["timestamp_ms"]-left["timestamp_ms"];gaps.append(gap)
            if gap<=0:violations.append({"type":"non_monotonic_time","from":left["index"],"to":right["index"],"gap_ms":gap})
            elif gap>max_gap:violations.append({"type":"frame_gap","from":left["index"],"to":right["index"],"gap_ms":gap,"max_gap_ms":max_gap})
            if timing_contract.get("continuity_required",True) and right.get("continuous_from_previous") is False:violations.append({"type":"declared_discontinuity","index":right["index"]})
        duration=normalized[-1]["timestamp_ms"]-normalized[0]["timestamp_ms"]
        if max_duration is not None and duration>max_duration:violations.append({"type":"duration","duration_ms":duration,"max_duration_ms":max_duration})
        playback=None;uncertain=False
        if playback_evidence is not None:
            status=playback_evidence.get("status") if isinstance(playback_evidence,Mapping) else None
            if status not in PLAYBACK or not playback_evidence.get("native_surface"):raise MotionProofError("invalid playback evidence")
            playback=dict(playback_evidence);uncertain=status in {"UNKNOWN","NOT_RUN","STALE"}
            if status=="FAIL":violations.append({"type":"native_playback_failure"})
        if violations:verdict="FAIL"
        elif playback is None or uncertain:verdict="UNKNOWN"
        else:verdict="PASS"
        return {"schema_version":"axm.verify.motion-sequence-proof/0.1","verdict_state":verdict,"frame_count":len(normalized),"duration_ms":duration,"observed_gaps_ms":gaps,"violations":violations,"playback_evidence":playback,"frames_are_caller_supplied":True,"aesthetic_quality_judged":False,"authority":"NONE","canon":False}
