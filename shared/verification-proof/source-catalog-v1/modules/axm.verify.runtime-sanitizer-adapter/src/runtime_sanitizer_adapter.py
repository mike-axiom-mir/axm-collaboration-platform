"""Detached AXM Runtime Sanitizer Adapter v0.1.0."""
from __future__ import annotations
from hashlib import sha256
from typing import Any, Dict
import re

class SanitizerAdapterError(ValueError): pass
PATTERNS=[
 ("ADDRESS","AddressSanitizer",re.compile(r"ERROR: AddressSanitizer:\s*([^\n]+)")),
 ("LEAK","LeakSanitizer",re.compile(r"ERROR: LeakSanitizer:\s*([^\n]+)")),
 ("THREAD","ThreadSanitizer",re.compile(r"(?:WARNING|ERROR): ThreadSanitizer:\s*([^\n]+)")),
 ("UNDEFINED_BEHAVIOR","UndefinedBehaviorSanitizer",re.compile(r"runtime error:\s*([^\n]+)")),
]
class RuntimeSanitizerAdapter:
 def normalize(self,*,tool_name:str,tool_version:str,enabled:bool,completed:bool,exit_code:int|None,report_text:str)->Dict[str,Any]:
  if not isinstance(tool_name,str) or not tool_name.strip() or not isinstance(tool_version,str) or not tool_version.strip():raise SanitizerAdapterError("tool identity required")
  if not isinstance(enabled,bool) or not isinstance(completed,bool):raise SanitizerAdapterError("enabled and completed must be booleans")
  if exit_code is not None and (isinstance(exit_code,bool) or not isinstance(exit_code,int)):raise SanitizerAdapterError("exit_code must be integer or null")
  if not isinstance(report_text,str):raise SanitizerAdapterError("report_text must be string")
  findings=[];seen=set()
  for kind,source,pattern in PATTERNS:
   for match in pattern.finditer(report_text):
    message=match.group(1).strip();fingerprint=sha256(f"{kind}|{message}".encode()).hexdigest()
    if fingerprint not in seen:
     seen.add(fingerprint);findings.append({"finding_id":fingerprint,"kind":kind,"source_pattern":source,"message":message})
  if not enabled:verdict="NOT_RUN"
  elif not completed:verdict="UNKNOWN"
  elif findings:verdict="FAIL"
  elif exit_code==0:verdict="PASS"
  else:verdict="UNKNOWN"
  return {"schema_version":"axm.verify.sanitizer-receipt/0.1","tool":{"name":tool_name.strip(),"version":tool_version.strip()},"enabled":enabled,"completed":completed,"exit_code":exit_code,"verdict_state":verdict,"findings":findings,"raw_report_sha256":sha256(report_text.encode()).hexdigest(),"raw_report_bytes":len(report_text.encode()),"sanitizer_executed_by_adapter":False,"clean_claim_scope":"SUPPLIED_COMPLETED_RUN_ONLY","authority":"NONE","canon":False}
