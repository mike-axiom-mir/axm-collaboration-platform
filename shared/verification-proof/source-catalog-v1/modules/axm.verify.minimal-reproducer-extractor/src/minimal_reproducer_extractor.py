"""Detached AXM Minimal Reproducer Extractor v0.1.0."""
from __future__ import annotations
from typing import Any, Callable, Dict, Mapping, Sequence
import json
class MinimalReproducerError(ValueError):pass
class _Budget(Exception):pass
class MinimalReproducerExtractor:
 def __init__(self,extractor_id:str,max_evaluations:int=1000):
  if not isinstance(extractor_id,str) or not extractor_id.strip():raise MinimalReproducerError("extractor_id must be non-empty")
  if isinstance(max_evaluations,bool) or not isinstance(max_evaluations,int) or max_evaluations<1:raise MinimalReproducerError("invalid max_evaluations")
  self.extractor_id=extractor_id.strip();self.max_evaluations=max_evaluations
 def _shrink_list(self,original:list[Any],predicate:Callable[[list[Any]],bool]):
  evaluations=0
  def test(x):
   nonlocal evaluations
   if evaluations>=self.max_evaluations:raise _Budget
   evaluations+=1;result=predicate(x)
   if not isinstance(result,bool):raise MinimalReproducerError("predicate must return boolean")
   return result
  if not test(original.copy()):raise MinimalReproducerError("initial input does not preserve failure")
  current=original.copy();n=2;budget=False
  try:
   while len(current)>=2:
    size=(len(current)+n-1)//n;reduced=False
    for start in range(0,len(current),size):
     candidate=current[:start]+current[start+size:]
     if test(candidate):current=candidate;n=max(n-1,2);reduced=True;break
    if not reduced:
     if n>=len(current):break
     n=min(len(current),n*2)
   changed=True
   while changed:
    changed=False
    for i in range(len(current)):
     candidate=current[:i]+current[i+1:]
     if test(candidate):current=candidate;changed=True;break
  except _Budget:budget=True
  return current,evaluations,budget
 def _receipt(self,kind:str,original_size:int,result:Any,evaluations:int,budget:bool)->Dict[str,Any]:
  final_size=len(result);return {"schema_version":"axm.verify.minimal-reproducer-receipt/0.1","extractor_id":self.extractor_id,"kind":kind,"original_size":original_size,"final_size":final_size,"reduction":original_size-final_size,"evaluations":evaluations,"max_evaluations":self.max_evaluations,"budget_exhausted":budget,"verdict_state":"UNKNOWN" if budget else "PASS","result":result,"failure_preserved":True,"minimality_claim":"BEST_FOUND_WITHIN_BUDGET" if budget else "ONE_MINIMAL_UNDER_TESTED_SINGLE_REMOVALS","global_minimum_proven":False,"external_commands_executed":False,"authority":"NONE","canon":False}
 def shrink_sequence(self,value:Sequence[Any],predicate:Callable[[list[Any]],bool])->Dict[str,Any]:
  if not isinstance(value,(list,tuple)):raise MinimalReproducerError("value must be list or tuple")
  result,e,b=self._shrink_list(list(value),predicate);return self._receipt("SEQUENCE",len(value),result,e,b)
 def shrink_mapping(self,value:Mapping[str,Any],predicate:Callable[[Dict[str,Any]],bool])->Dict[str,Any]:
  if not isinstance(value,Mapping):raise MinimalReproducerError("value must be mapping")
  keys=sorted(value);result,e,b=self._shrink_list(keys,lambda ks:predicate({k:value[k] for k in ks}));out={k:value[k] for k in result};return self._receipt("MAPPING",len(value),out,e,b)
 def shrink_bytes(self,value:bytes,predicate:Callable[[bytes],bool])->Dict[str,Any]:
  if not isinstance(value,bytes):raise MinimalReproducerError("value must be bytes")
  result,e,b=self._shrink_list(list(value),lambda xs:predicate(bytes(xs)));out=bytes(result);r=self._receipt("BYTES",len(value),out.hex(),e,b);r["result_encoding"]="HEX";return r
