"""Detached AXM Static Analysis Findings Normalizer v0.1.0."""
from __future__ import annotations
from hashlib import sha256
from typing import Any, Dict, Mapping, Sequence

SEVERITIES={"INFO","WARNING","ERROR","CRITICAL"}
class StaticAnalysisError(ValueError):pass

def _text(x,n):
 if not isinstance(x,str) or not x.strip():raise StaticAnalysisError(f"{n} must be non-empty")
 return x.strip()
class StaticAnalysisFindingsNormalizer:
 def normalize(self,tool_runs:Sequence[Mapping[str,Any]],fail_severities:Sequence[str]=( "ERROR","CRITICAL"))->Dict[str,Any]:
  fail=set(fail_severities)
  if not fail<=SEVERITIES:raise StaticAnalysisError("unsupported fail severity")
  grouped={};incomplete=[]
  for run in tool_runs:
   if not isinstance(run,Mapping):raise StaticAnalysisError("tool run must be mapping")
   tool=_text(run.get("tool"),"tool");version=_text(run.get("version"),"version");completed=run.get("completed")
   if not isinstance(completed,bool):raise StaticAnalysisError("completed must be boolean")
   if not completed:incomplete.append({"tool":tool,"version":version})
   for raw in run.get("findings",[]):
    if not isinstance(raw,Mapping):raise StaticAnalysisError("finding must be mapping")
    rule=_text(raw.get("rule_id"),"rule_id");path=_text(raw.get("path"),"path");message=_text(raw.get("message"),"message");severity=raw.get("severity")
    if severity not in SEVERITIES:raise StaticAnalysisError("unsupported finding severity")
    line=raw.get("line")
    if line is not None and (isinstance(line,bool) or not isinstance(line,int) or line<1):raise StaticAnalysisError("line must be positive integer or null")
    fingerprint=sha256(f"{rule}|{path}|{line}|{message}".encode()).hexdigest()
    entry=grouped.setdefault(fingerprint,{"finding_id":fingerprint,"rule_id":rule,"path":path,"line":line,"message":message,"severity":severity,"suppressed":bool(raw.get("suppressed",False)),"tools":[]})
    entry["tools"].append({"name":tool,"version":version});entry["suppressed"]=entry["suppressed"] and bool(raw.get("suppressed",False))
    if ["INFO","WARNING","ERROR","CRITICAL"].index(severity)>["INFO","WARNING","ERROR","CRITICAL"].index(entry["severity"]):entry["severity"]=severity
  findings=sorted(grouped.values(),key=lambda x:(x["path"],x["line"] or 0,x["rule_id"]))
  policy_failures=[x for x in findings if not x["suppressed"] and x["severity"] in fail]
  verdict="UNKNOWN" if incomplete else ("FAIL" if policy_failures else "PASS")
  return {"schema_version":"axm.verify.static-analysis-receipt/0.1","verdict_state":verdict,"fail_severities":sorted(fail),"findings":findings,"policy_failure_ids":[x["finding_id"] for x in policy_failures],"suppressed_count":sum(1 for x in findings if x["suppressed"]),"incomplete_tools":incomplete,"analyzers_executed_by_normalizer":False,"agreement_is_not_proof":True,"policy_pass_is_not_correctness":True,"authority":"NONE","canon":False}
