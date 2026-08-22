"""Detached AXM Synthetic Fixture Generator v0.1.0."""
from __future__ import annotations
from typing import Any, Dict, Mapping
import hashlib,json,random,string
class SyntheticFixtureError(ValueError):pass
def _text(v:Any,f:str)->str:
 if not isinstance(v,str) or not v.strip():raise SyntheticFixtureError(f"{f} must be non-empty")
 return v.strip()
class SyntheticFixtureGenerator:
 def __init__(self,generator_id:str,seed:int|str,max_depth:int=8):
  self.generator_id=_text(generator_id,"generator_id")
  if isinstance(seed,bool) or not isinstance(seed,(int,str)):raise SyntheticFixtureError("seed must be integer or string")
  if isinstance(max_depth,bool) or not isinstance(max_depth,int) or max_depth<1 or max_depth>32:raise SyntheticFixtureError("invalid max_depth")
  self.seed=seed;self.max_depth=max_depth;self._rng=random.Random(seed);self._counter=0
 def _string(self,schema:Mapping[str,Any],field_name:str)->str:
  kind=schema.get("x-axm-kind")
  self._counter+=1;n=self._counter
  if kind=="synthetic_id":return f"synthetic-{n:06d}"
  if kind=="email":return f"synthetic-user-{n:06d}@example.invalid"
  if kind=="name":return f"Synthetic Person {n:06d}"
  if kind=="phone":return f"+000000{n:06d}"
  if kind in {"secret","token","password"}:return f"SYNTHETIC_{kind.upper()}_{n:06d}"
  lo=schema.get("minLength",1);hi=schema.get("maxLength",max(lo,12))
  if not isinstance(lo,int) or not isinstance(hi,int) or lo<0 or hi<lo or hi>1024:raise SyntheticFixtureError("invalid string bounds")
  length=self._rng.randint(lo,hi);alphabet=string.ascii_lowercase+string.digits
  return "".join(self._rng.choice(alphabet) for _ in range(length))
 def _gen(self,schema:Mapping[str,Any],depth:int,field_name:str="value")->Any:
  if depth>self.max_depth:raise SyntheticFixtureError("maximum schema depth exceeded")
  if not isinstance(schema,Mapping):raise SyntheticFixtureError("schema must be a mapping")
  if any(k in schema for k in ("source_values","examples")) or schema.get("x-axm-real-data") is True:raise SyntheticFixtureError("real or source values are forbidden")
  if "enum" in schema:
   values=schema["enum"]
   if not isinstance(values,list) or not values:raise SyntheticFixtureError("enum must be non-empty list")
   return json.loads(json.dumps(self._rng.choice(values)))
  typ=schema.get("type")
  if typ=="object":
   props=schema.get("properties",{});required=schema.get("required",list(props))
   if not isinstance(props,Mapping) or not isinstance(required,list):raise SyntheticFixtureError("invalid object schema")
   return {k:self._gen(props[k],depth+1,k) for k in required if k in props}
  if typ=="array":
   lo=schema.get("minItems",1);hi=schema.get("maxItems",lo)
   if not isinstance(lo,int) or not isinstance(hi,int) or lo<0 or hi<lo or hi>1000:raise SyntheticFixtureError("invalid array bounds")
   return [self._gen(schema.get("items",{}),depth+1,field_name) for _ in range(self._rng.randint(lo,hi))]
  if typ=="string":return self._string(schema,field_name)
  if typ=="integer":
   lo=schema.get("minimum",0);hi=schema.get("maximum",100)
   if isinstance(lo,bool) or isinstance(hi,bool) or not isinstance(lo,int) or not isinstance(hi,int) or lo>hi:raise SyntheticFixtureError("invalid integer bounds")
   return self._rng.randint(lo,hi)
  if typ=="number":
   lo=schema.get("minimum",0.0);hi=schema.get("maximum",1.0)
   if not isinstance(lo,(int,float)) or not isinstance(hi,(int,float)) or isinstance(lo,bool) or isinstance(hi,bool) or lo>hi:raise SyntheticFixtureError("invalid number bounds")
   return lo+(hi-lo)*self._rng.random()
  if typ=="boolean":return bool(self._rng.getrandbits(1))
  if typ=="null":return None
  raise SyntheticFixtureError("unsupported schema type")
 def generate(self,schema:Mapping[str,Any])->Dict[str,Any]:
  canonical=json.dumps(schema,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode();value=self._gen(schema,0)
  return {"schema_version":"axm.verify.synthetic-fixture/0.1","generator_id":self.generator_id,"seed":self.seed,"input_schema_sha256":hashlib.sha256(canonical).hexdigest(),"value":value,"synthetic":True,"real_personal_data_used":False,"representativeness_proven":False,"authority":"NONE","canon":False}
