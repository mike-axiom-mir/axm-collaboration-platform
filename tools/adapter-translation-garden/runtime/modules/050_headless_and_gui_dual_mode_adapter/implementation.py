from __future__ import annotations
import copy
from typing import Any


def _eligible(mode: dict[str, Any], required: set[str], require_visible: bool, max_authority: str | None) -> tuple[bool,list[str]]:
    reasons=[]
    if not required<=set(mode.get('capabilities',[])): reasons.append('missing_capabilities')
    if require_visible and not mode.get('human_visible',False): reasons.append('not_human_visible')
    levels={'read_only':0,'decision_only':1,'write_limited':2,'native':3}
    if max_authority and levels.get(mode.get('authority','native'),99)>levels.get(max_authority,-1): reasons.append('authority_too_high')
    return not reasons,reasons


def run(operation: dict[str, Any], *, headless: dict[str, Any] | None, gui: dict[str, Any] | None, preferred: str = 'auto', require_human_visible: bool = False, max_authority: str | None = 'decision_only') -> dict[str, Any]:
    required=set(operation.get('required_capabilities',[])); candidates=[]; rejected=[]
    for name,mode in [('headless',headless),('gui',gui)]:
        if not isinstance(mode,dict): rejected.append({'mode':name,'reasons':['missing_descriptor']}); continue
        ok,reasons=_eligible(mode,required,require_human_visible,max_authority)
        if ok: candidates.append({'mode':name,'descriptor':copy.deepcopy(mode)})
        else: rejected.append({'mode':name,'reasons':reasons})
    order={'headless':0,'gui':1}
    if preferred in {'headless','gui'}: order={preferred:0,('gui' if preferred=='headless' else 'headless'):1}
    candidates.sort(key=lambda x:order[x['mode']]); selected=candidates[0] if candidates else None
    return {'schema':'axm.translation.dual-mode-plan/v1','verdict':'PLAN_READY' if selected else 'REFUSE','operation':copy.deepcopy(operation),'selected':selected,'eligible':candidates,'rejected':rejected,'executed':False}
