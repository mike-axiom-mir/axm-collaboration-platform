from __future__ import annotations
from copy import deepcopy
from typing import Any,Callable


def _version(value: str) -> tuple[int,...]:
    out=[]
    for part in value.replace('-','.').split('.'):
        digits=''.join(ch for ch in part if ch.isdigit())
        if not digits: break
        out.append(int(digits))
    return tuple(out)

def _relation(writer: str, reader: str) -> str:
    w,r=_version(writer),_version(reader)
    if not w or not r: return 'unknown'
    if r>w: return 'backward_compatibility'
    if r<w: return 'forward_compatibility'
    return 'same_version'

def run(producers: dict[str,Callable[[Any],Any]], consumers: dict[str,Callable[[Any],Any]], fixtures: list[dict[str,Any]]) -> dict[str,Any]:
    cells=[]
    for writer,producer in sorted(producers.items()):
        produced=[]
        for index,fixture in enumerate(fixtures):
            source=deepcopy(fixture.get('value')); before=deepcopy(source)
            try: payload=producer(source); p_error=None
            except Exception as exc: payload=None; p_error={'type':type(exc).__name__,'message':str(exc)}
            produced.append((fixture.get('name',f'fixture-{index}'),payload,p_error,source!=before))
        for reader,consumer in sorted(consumers.items()):
            results=[]
            for name,payload,p_error,p_mutated in produced:
                if p_error:
                    results.append({'fixture':name,'passed':False,'producer_error':p_error,'producer_input_mutated':p_mutated}); continue
                consumer_input=deepcopy(payload); before=deepcopy(payload)
                try:
                    outcome=consumer(consumer_input); passed=outcome is not False; c_error=None
                except Exception as exc:
                    outcome=None; passed=False; c_error={'type':type(exc).__name__,'message':str(exc)}
                mutated=consumer_input!=before
                if mutated: passed=False
                results.append({'fixture':name,'passed':passed,'consumer_result':deepcopy(outcome),'consumer_error':c_error,'producer_input_mutated':p_mutated,'consumer_input_mutated':mutated})
            cell_pass=all(r['passed'] and not r['producer_input_mutated'] for r in results)
            cells.append({'writer':writer,'reader':reader,'relation':_relation(writer,reader),'passed':cell_pass,'results':results})
    return {'schema':'axm.translation.compatibility-matrix/v1','verdict':'PASS' if all(c['passed'] for c in cells) else 'FAIL','cells':cells,'fixtures':len(fixtures),'universal_compatibility_claimed':False,'limitations':['Producers and consumers run in the caller process. Results prove only the supplied fixture combinations.']}
