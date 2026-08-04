from __future__ import annotations
import copy
from typing import Any


def run(candidates: list[dict[str, Any]], *, required_semantics: list[str], allowed_degradations: list[str], accepted_material_degradation: bool = False) -> dict[str, Any]:
    required=set(required_semantics); allowed=set(allowed_degradations); eligible=[]; rejected=[]
    for candidate in candidates:
        missing=required-set(candidate.get('preserved_semantics',[])); degradations=set(candidate.get('degradations',[])); reasons=[]
        if missing: reasons.append({'missing_semantics':sorted(missing)})
        disallowed=degradations-allowed
        if disallowed: reasons.append({'disallowed_degradations':sorted(disallowed)})
        material=bool(candidate.get('material_degradation',False) or degradations)
        if material and not accepted_material_degradation: reasons.append({'material_degradation_not_accepted':True})
        if reasons: rejected.append({'id':candidate.get('id'),'reasons':reasons}); continue
        score=float(candidate.get('quality',0))-float(candidate.get('cost',0))-float(candidate.get('latency',0))
        eligible.append({'id':candidate.get('id'),'score':score,'candidate':copy.deepcopy(candidate)})
    eligible.sort(key=lambda x:(-x['score'],str(x['id']))); selected=eligible[0] if eligible else None
    return {'schema':'axm.translation.fallback-selection/v1','verdict':'SELECTED' if selected else 'REFUSE','selected':selected,'eligible':eligible,'rejected':rejected,'executed':False,'silent_approximation':False}
