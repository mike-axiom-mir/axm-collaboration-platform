"""Detached AXM Mutation Testing Scorecard v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping, Sequence

STATUSES={"KILLED","SURVIVED","TIMEOUT","ERROR","NOT_RUN","EQUIVALENT_CANDIDATE"}
class MutationScoreError(ValueError):pass
class MutationTestingScorecard:
 def score(self,mutants:Sequence[Mapping[str,Any]],threshold:float=0.8)->Dict[str,Any]:
  if isinstance(threshold,bool) or not isinstance(threshold,(int,float)) or not 0<=threshold<=1:raise MutationScoreError("threshold must be between 0 and 1")
  if not mutants:raise MutationScoreError("mutants must not be empty")
  seen=set();items=[]
  for raw in mutants:
   if not isinstance(raw,Mapping):raise MutationScoreError("mutant must be mapping")
   mid=raw.get("mutant_id");status=raw.get("status")
   if not isinstance(mid,str) or not mid.strip():raise MutationScoreError("mutant_id must be non-empty")
   if mid in seen:raise MutationScoreError("duplicate mutant_id")
   if status not in STATUSES:raise MutationScoreError("unsupported mutant status")
   seen.add(mid);items.append({"mutant_id":mid,"status":status,"location":raw.get("location"),"operator":raw.get("operator")})
  counts={status:sum(1 for x in items if x["status"]==status) for status in sorted(STATUSES)}
  assessable=counts["KILLED"]+counts["SURVIVED"]
  score=None if assessable==0 else counts["KILLED"]/assessable
  unresolved=[x for x in items if x["status"] in {"TIMEOUT","ERROR","NOT_RUN"}]
  equivalents=[x for x in items if x["status"]=="EQUIVALENT_CANDIDATE"]
  survivors=[x for x in items if x["status"]=="SURVIVED"]
  if score is None or unresolved or equivalents:verdict="UNKNOWN"
  else:verdict="PASS" if score>=threshold else "FAIL"
  return {"schema_version":"axm.verify.mutation-scorecard/0.1","verdict_state":verdict,"threshold":float(threshold),"counts":counts,"assessable_denominator":assessable,"mutation_score":score,"survivors":survivors,"unresolved":unresolved,"equivalent_candidates":equivalents,"equivalent_candidates_excluded_from_score":True,"mutants_executed_by_scorecard":False,"score_is_not_correctness":True,"authority":"NONE","canon":False}
