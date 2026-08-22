"""Detached AXM Stateful Model-Based Test Runner v0.1.0."""
from __future__ import annotations
from copy import deepcopy
from typing import Any, Callable, Dict, Mapping, Sequence

class StatefulModelError(ValueError):
    pass

class StatefulModelBasedRunner:
    def __init__(self, runner_id: str, initial_state: str, transitions: Sequence[Mapping[str, str]], max_depth: int = 4, max_sequences: int = 100):
        if not isinstance(runner_id,str) or not runner_id.strip(): raise StatefulModelError("runner_id must be non-empty")
        if not isinstance(initial_state,str) or not initial_state: raise StatefulModelError("initial_state must be non-empty")
        if isinstance(max_depth,bool) or not isinstance(max_depth,int) or max_depth<0: raise StatefulModelError("invalid max_depth")
        if isinstance(max_sequences,bool) or not isinstance(max_sequences,int) or max_sequences<1: raise StatefulModelError("invalid max_sequences")
        table={}
        for item in transitions:
            if not isinstance(item,Mapping): raise StatefulModelError("transition must be mapping")
            source,action,target=item.get("from"),item.get("action"),item.get("to")
            if not all(isinstance(x,str) and x for x in (source,action,target)): raise StatefulModelError("invalid transition")
            key=(source,action)
            if key in table and table[key]!=target: raise StatefulModelError("ambiguous transition")
            table[key]=target
        self.runner_id=runner_id.strip();self.initial_state=initial_state;self.table=table;self.max_depth=max_depth;self.max_sequences=max_sequences

    def sequences(self):
        out=[];queue=[(self.initial_state,[])]
        while queue and len(out)<self.max_sequences:
            state,seq=queue.pop(0)
            if seq: out.append(seq)
            if len(seq)>=self.max_depth: continue
            options=sorted((action,target) for (source,action),target in self.table.items() if source==state)
            for action,target in options: queue.append((target,seq+[action]))
        return out[:self.max_sequences]

    def run(self, implementation_initial_state: Any, implementation_step: Callable[[Any,str],Any], observe: Callable[[Any],str] | None = None) -> Dict[str,Any]:
        if not callable(implementation_step): raise StatefulModelError("implementation_step must be callable")
        observe=observe or (lambda state: state)
        explored=0;transitions_checked=0
        for sequence in self.sequences():
            model=self.initial_state;system=deepcopy(implementation_initial_state);trace=[]
            for action in sequence:
                expected=self.table[(model,action)]
                try: system=implementation_step(system,action);observed=observe(system)
                except Exception as exc:
                    return self._receipt("FAIL",explored+1,transitions_checked,sequence,trace,{"type":type(exc).__name__,"message":str(exc)})
                transitions_checked+=1;trace.append({"from":model,"action":action,"expected":expected,"observed":observed})
                if observed!=expected:
                    return self._receipt("FAIL",explored+1,transitions_checked,sequence,trace,None)
                model=expected
            explored+=1
        return self._receipt("PASS",explored,transitions_checked,None,None,None)

    def _receipt(self, verdict, explored, checked, failing_sequence, trace, exception):
        return {"schema_version":"axm.verify.stateful-model-receipt/0.1","runner_id":self.runner_id,"verdict_state":verdict,"max_depth":self.max_depth,"max_sequences":self.max_sequences,"sequences_explored":explored,"transitions_checked":checked,"failing_sequence":failing_sequence,"failure_trace":trace,"exception":exception,"complete_state_space_proven":False,"external_commands_executed":False,"authority":"NONE","canon":False}
