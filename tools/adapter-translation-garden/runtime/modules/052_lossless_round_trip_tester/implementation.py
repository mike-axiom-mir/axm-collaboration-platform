from __future__ import annotations
from copy import deepcopy
from typing import Any, Callable

from axm_translation_core import diff_values


def run(source: Any, forward: Callable[[Any],Any], backward: Callable[[Any],Any], *, semantic_projector: Callable[[Any],Any]|None=None) -> dict[str, Any]:
    original=deepcopy(source); forward_input=deepcopy(source)
    try:
        intermediate=forward(forward_input)
    except Exception as exc:
        return {'schema':'axm.translation.roundtrip-test/v1','verdict':'FAIL','stage':'forward','exception':{'type':type(exc).__name__,'message':str(exc)},'input_mutated':forward_input!=original}
    backward_input=deepcopy(intermediate); intermediate_before=deepcopy(intermediate)
    try:
        roundtripped=backward(backward_input)
    except Exception as exc:
        return {'schema':'axm.translation.roundtrip-test/v1','verdict':'FAIL','stage':'backward','exception':{'type':type(exc).__name__,'message':str(exc)},'source_input_mutated':forward_input!=original,'intermediate_input_mutated':backward_input!=intermediate_before}
    byte_claim=isinstance(source,(bytes,bytearray,memoryview)) and isinstance(roundtripped,(bytes,bytearray,memoryview))
    byte_exact=bytes(source)==bytes(roundtripped) if byte_claim else None
    changes=diff_values(source,roundtripped)
    structure_exact=not changes
    semantic_exact=None
    semantic_error=None
    if semantic_projector:
        try: semantic_exact=semantic_projector(source)==semantic_projector(roundtripped)
        except Exception as exc: semantic_error={'type':type(exc).__name__,'message':str(exc)}
    mutation=forward_input!=original or backward_input!=intermediate_before
    if mutation: verdict='FAIL'
    elif byte_exact is True: verdict='PASS_BYTE_EXACT'
    elif structure_exact: verdict='PASS_STRUCTURE_EXACT'
    elif semantic_exact is True: verdict='PASS_SEMANTIC_ONLY'
    else: verdict='FAIL'
    return {'schema':'axm.translation.roundtrip-test/v1','verdict':verdict,'intermediate':deepcopy(intermediate),'roundtripped':deepcopy(roundtripped),'claims':{'byte_exact':byte_exact,'structure_exact':structure_exact,'semantic_exact':semantic_exact},'structure_diff':changes,'semantic_error':semantic_error,'source_input_mutated':forward_input!=original,'intermediate_input_mutated':backward_input!=intermediate_before,'limitations':['Callables run in the caller process. Passing fixtures does not prove universal fidelity.']}
