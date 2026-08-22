"""Detached AXM Structural Coverage Collector v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping

KINDS = {"line", "branch", "condition", "function", "state", "transition"}
class StructuralCoverageError(ValueError): pass

class StructuralCoverageCollector:
    def collect(self, coverage: Mapping[str, Mapping[str, Any]], *, default_threshold: float = 0.0) -> Dict[str, Any]:
        if not isinstance(coverage, Mapping) or not coverage:
            raise StructuralCoverageError("coverage must be a non-empty mapping")
        if isinstance(default_threshold, bool) or not isinstance(default_threshold, (int,float)) or not 0 <= default_threshold <= 1:
            raise StructuralCoverageError("default_threshold must be between 0 and 1")
        result = {}
        below = []
        unknown_kinds = []
        for kind, raw in coverage.items():
            if kind not in KINDS or not isinstance(raw, Mapping):
                raise StructuralCoverageError("unsupported coverage kind or payload")
            declared_raw = raw.get("declared", [])
            exercised_raw = raw.get("exercised", [])
            if isinstance(declared_raw, (str,bytes)) or isinstance(exercised_raw,(str,bytes)):
                raise StructuralCoverageError("coverage identifiers must be sequences")
            declared = {str(item) for item in declared_raw}
            exercised = {str(item) for item in exercised_raw}
            threshold = raw.get("threshold", default_threshold)
            if isinstance(threshold,bool) or not isinstance(threshold,(int,float)) or not 0 <= threshold <= 1:
                raise StructuralCoverageError("threshold must be between 0 and 1")
            covered = declared & exercised
            unknown = exercised - declared
            ratio = None if not declared else len(covered) / len(declared)
            state = "UNKNOWN" if ratio is None else ("PASS" if ratio >= threshold else "FAIL")
            if state == "FAIL": below.append(kind)
            if state == "UNKNOWN": unknown_kinds.append(kind)
            result[kind] = {"declared_count":len(declared),"covered_count":len(covered),"ratio":ratio,"threshold":float(threshold),"state":state,"uncovered":sorted(declared-covered),"unknown_exercised":sorted(unknown)}
        verdict = "FAIL" if below else ("UNKNOWN" if unknown_kinds else "PASS")
        return {"schema_version":"axm.verify.structural-coverage/0.1","verdict_state":verdict,"coverage":result,"below_threshold":below,"unknown_kinds":unknown_kinds,"coverage_is_not_correctness":True,"authority":"NONE","canon":False}
