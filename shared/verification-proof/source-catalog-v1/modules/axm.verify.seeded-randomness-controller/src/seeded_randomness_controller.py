"""Detached AXM Seeded Randomness Controller v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Sequence
import hashlib, json, platform, random
class RandomnessControllerError(ValueError):pass
def _text(v:Any,f:str)->str:
 if not isinstance(v,str) or not v.strip():raise RandomnessControllerError(f"{f} must be non-empty")
 return v.strip()
class SeededRandomnessController:
 def __init__(self,controller_id:str,seed:int|str):
  self.controller_id=_text(controller_id,"controller_id")
  if isinstance(seed,bool) or not isinstance(seed,(int,str)):raise RandomnessControllerError("seed must be an integer or string")
  if isinstance(seed,str) and not seed:raise RandomnessControllerError("string seed cannot be empty")
  self.seed=seed;self._rng=random.Random(seed);self._transcript=[];self._exceptions=[]
 def _record(self,op:str,args:Dict[str,Any],result:Any)->Any:
  self._transcript.append({"index":len(self._transcript),"operation":op,"arguments":args,"result":result});return result
 def random(self)->float:return self._record("random",{},self._rng.random())
 def randint(self,a:int,b:int)->int:
  if isinstance(a,bool) or isinstance(b,bool) or not isinstance(a,int) or not isinstance(b,int) or a>b:raise RandomnessControllerError("invalid integer range")
  return self._record("randint",{"a":a,"b":b},self._rng.randint(a,b))
 def choice(self,population:Sequence[Any])->Any:
  if not isinstance(population,(list,tuple)) or not population:raise RandomnessControllerError("population must be non-empty")
  index=self._rng.randrange(len(population));return self._record("choice",{"population_size":len(population),"selected_index":index},population[index])
 def sample(self,population:Sequence[Any],k:int)->list[Any]:
  if not isinstance(population,(list,tuple)) or isinstance(k,bool) or not isinstance(k,int) or k<0 or k>len(population):raise RandomnessControllerError("invalid sample size")
  indices=self._rng.sample(range(len(population)),k);return self._record("sample",{"population_size":len(population),"k":k,"selected_indices":indices},[population[i] for i in indices])
 def shuffle_copy(self,items:Sequence[Any])->list[Any]:
  if not isinstance(items,(list,tuple)):raise RandomnessControllerError("items must be a sequence")
  out=list(items);self._rng.shuffle(out);return self._record("shuffle_copy",{"item_count":len(out)},out.copy())
 def declare_exception(self,description:str)->None:self._exceptions.append(_text(description,"description"))
 def receipt(self)->Dict[str,Any]:
  state_digest=hashlib.sha256(repr(self._rng.getstate()).encode()).hexdigest()
  return {"schema_version":"axm.verify.seeded-randomness-receipt/0.1","controller_id":self.controller_id,"seed":self.seed,"generator":"python.random.MT19937","python_version":platform.python_version(),"transcript":json.loads(json.dumps(self._transcript,default=repr)),"state_digest":state_digest,"nondeterministic_exceptions":list(self._exceptions),"cryptographic_randomness":False,"authority":"NONE","canon":False}
