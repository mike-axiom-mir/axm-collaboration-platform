"""Detached AXM Property-Based Test Generator v0.1.0."""
from __future__ import annotations
from typing import Any, Callable, Dict, Mapping
import random

class PropertyTestError(ValueError):
    pass

class PropertyBasedTestGenerator:
    def __init__(self, generator_id: str, seed: int = 0):
        if not isinstance(generator_id, str) or not generator_id.strip():
            raise PropertyTestError("generator_id must be non-empty")
        if isinstance(seed, bool) or not isinstance(seed, int):
            raise PropertyTestError("seed must be an integer")
        self.generator_id = generator_id.strip(); self.seed = seed

    def _validate(self, strategy: Mapping[str, Any]):
        if not isinstance(strategy, Mapping): raise PropertyTestError("strategy must be a mapping")
        kind = strategy.get("type")
        if kind == "integer":
            lo, hi = strategy.get("minimum"), strategy.get("maximum")
            if isinstance(lo, bool) or isinstance(hi, bool) or not isinstance(lo, int) or not isinstance(hi, int) or lo > hi:
                raise PropertyTestError("invalid integer bounds")
        elif kind == "text":
            alphabet = strategy.get("alphabet", "abc")
            lo, hi = strategy.get("min_size", 0), strategy.get("max_size", 16)
            if not isinstance(alphabet, str) or not alphabet or not isinstance(lo, int) or not isinstance(hi, int) or lo < 0 or lo > hi:
                raise PropertyTestError("invalid text strategy")
        elif kind == "list":
            lo, hi = strategy.get("min_size", 0), strategy.get("max_size", 8)
            if not isinstance(lo, int) or not isinstance(hi, int) or lo < 0 or lo > hi:
                raise PropertyTestError("invalid list bounds")
            self._validate(strategy.get("items", {}))
        else:
            raise PropertyTestError("unsupported strategy type")

    def _one(self, strategy, rng):
        kind = strategy["type"]
        if kind == "integer": return rng.randint(strategy["minimum"], strategy["maximum"])
        if kind == "text":
            n=rng.randint(strategy.get("min_size",0),strategy.get("max_size",16));a=strategy.get("alphabet","abc");return "".join(rng.choice(a) for _ in range(n))
        n=rng.randint(strategy.get("min_size",0),strategy.get("max_size",8));return [self._one(strategy["items"],rng) for _ in range(n)]

    def examples(self, strategy: Mapping[str, Any], count: int) -> list[Any]:
        self._validate(strategy)
        if isinstance(count, bool) or not isinstance(count, int) or count < 1: raise PropertyTestError("count must be positive")
        rng=random.Random(self.seed);kind=strategy["type"];out=[]
        if kind=="integer":
            lo,hi=strategy["minimum"],strategy["maximum"]
            out.extend(x for x in (lo,hi,0,-1,1) if lo<=x<=hi)
        elif kind=="text":
            lo,hi=strategy.get("min_size",0),strategy.get("max_size",16);a=strategy.get("alphabet","abc")
            if lo==0:out.append("")
            out.extend([a[0]*lo,a[-1]*hi])
        else:
            lo,hi=strategy.get("min_size",0),strategy.get("max_size",8)
            if lo==0:out.append([])
            out.append([self._one(strategy["items"],rng) for _ in range(hi)])
        while len(out)<count:out.append(self._one(strategy,rng))
        return out[:count]

    def _fails(self, prop, value):
        try: result=prop(value)
        except Exception as exc: return True,{"type":type(exc).__name__,"message":str(exc)}
        if not isinstance(result,bool): raise PropertyTestError("property must return boolean")
        return not result,None

    def _shrink(self, value, prop):
        def complexity(item):
            if isinstance(item, int) and not isinstance(item, bool):
                return abs(item)
            if isinstance(item, (str, list)):
                return len(item)
            return 0
        current=value
        while True:
            if isinstance(current,int) and not isinstance(current,bool):
                candidates=[0,1 if current>0 else -1,current//2]
            elif isinstance(current,str):
                candidates=["",current[:len(current)//2],current[1:],current[:-1]]
            elif isinstance(current,list):
                candidates=[[],current[:len(current)//2],current[1:],current[:-1]]
            else:
                break
            replacement=None
            for candidate in candidates:
                if candidate==current or complexity(candidate)>=complexity(current):
                    continue
                failed,_=self._fails(prop,candidate)
                if failed:
                    replacement=candidate
                    break
            if replacement is None:
                break
            current=replacement
        return current

    def check(self, strategy: Mapping[str, Any], prop: Callable[[Any], bool], example_count: int = 100) -> Dict[str, Any]:
        values=self.examples(strategy,example_count)
        for index,value in enumerate(values):
            failed,exception=self._fails(prop,value)
            if failed:
                shrunk=self._shrink(value,prop)
                return {"schema_version":"axm.verify.property-test-receipt/0.1","generator_id":self.generator_id,"seed":self.seed,"examples_executed":index+1,"verdict_state":"FAIL","counterexample":value,"shrunk_counterexample":shrunk,"exception":exception,"exhaustive":False,"external_commands_executed":False,"authority":"NONE","canon":False}
        return {"schema_version":"axm.verify.property-test-receipt/0.1","generator_id":self.generator_id,"seed":self.seed,"examples_executed":len(values),"verdict_state":"PASS","counterexample":None,"shrunk_counterexample":None,"exception":None,"exhaustive":False,"external_commands_executed":False,"authority":"NONE","canon":False}
