"""Detached AXM Coverage-Guided Fuzz Harness v0.1.0."""
from __future__ import annotations
from typing import Any, Callable, Dict, Mapping, Sequence
import random

class FuzzHarnessError(ValueError): pass

class CoverageGuidedFuzzHarness:
    def __init__(self,harness_id:str,seed:int=0,max_cases:int=100,max_input_bytes:int=1024):
        if not isinstance(harness_id,str) or not harness_id.strip():raise FuzzHarnessError("harness_id must be non-empty")
        if isinstance(seed,bool) or not isinstance(seed,int):raise FuzzHarnessError("seed must be integer")
        if any(isinstance(x,bool) or not isinstance(x,int) or x<1 for x in (max_cases,max_input_bytes)):raise FuzzHarnessError("invalid limits")
        self.harness_id=harness_id.strip();self.seed=seed;self.max_cases=max_cases;self.max_input_bytes=max_input_bytes
    def _observe(self,target,data):
        try:result=target(data)
        except Exception as exc:return {"coverage":set(),"failure":{"kind":"EXCEPTION","type":type(exc).__name__,"message":str(exc)}}
        if not isinstance(result,Mapping):raise FuzzHarnessError("target must return a mapping")
        coverage=result.get("coverage",[])
        if isinstance(coverage,(str,bytes)) or not hasattr(coverage,"__iter__"):raise FuzzHarnessError("coverage must be iterable tokens")
        failure=None
        if result.get("violation"):failure={"kind":"VIOLATION","details":result.get("details")}
        return {"coverage":{str(x) for x in coverage},"failure":failure}
    def _mutate(self,data,rng):
        if not data:return bytes([rng.randrange(256)])
        choice=rng.randrange(4);buf=bytearray(data);i=rng.randrange(len(buf))
        if choice==0:buf[i]^=1<<rng.randrange(8)
        elif choice==1 and len(buf)>1:del buf[i]
        elif choice==2 and len(buf)<self.max_input_bytes:buf.insert(i,rng.randrange(256))
        else:buf[i]=rng.randrange(256)
        return bytes(buf[:self.max_input_bytes])
    def _minimize(self,data,target):
        current=data;size=max(1,len(current)//2)
        while size>=1 and current:
            changed=False
            for start in range(0,len(current),size):
                candidate=current[:start]+current[start+size:]
                if self._observe(target,candidate)["failure"] is not None:
                    current=candidate;changed=True;break
            if not changed:size//=2
        return current
    def run(self,seed_corpus:Sequence[bytes],target:Callable[[bytes],Mapping[str,Any]])->Dict[str,Any]:
        if not seed_corpus:raise FuzzHarnessError("seed_corpus must not be empty")
        corpus=[]
        for item in seed_corpus:
            if not isinstance(item,bytes):raise FuzzHarnessError("seed corpus items must be bytes")
            if len(item)>self.max_input_bytes:raise FuzzHarnessError("seed exceeds max_input_bytes")
            if item not in corpus:corpus.append(item)
        rng=random.Random(self.seed);queue=list(corpus);coverage=set();cases=0;failure=None;failing_input=None
        while cases<self.max_cases:
            if queue:data=queue.pop(0)
            else:data=self._mutate(rng.choice(corpus),rng)
            observation=self._observe(target,data);cases+=1
            new=observation["coverage"]-coverage
            if new:
                coverage|=new
                if data not in corpus:corpus.append(data)
            if observation["failure"] is not None:
                failure=observation["failure"];failing_input=data;break
            if cases<self.max_cases:queue.append(self._mutate(data,rng))
        minimized=self._minimize(failing_input,target) if failure is not None else None
        return {"schema_version":"axm.verify.fuzz-run-receipt/0.1","harness_id":self.harness_id,"seed":self.seed,"max_cases":self.max_cases,"cases_executed":cases,"coverage_token_count":len(coverage),"coverage_tokens":sorted(coverage),"retained_corpus_size":len(corpus),"verdict_state":"FAIL" if failure else "PASS","failure":failure,"failing_input_hex":None if failing_input is None else failing_input.hex(),"minimized_input_hex":None if minimized is None else minimized.hex(),"bounded_campaign_only":True,"external_commands_executed":False,"authority":"NONE","canon":False}
