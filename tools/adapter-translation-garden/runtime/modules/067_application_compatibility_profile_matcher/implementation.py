from __future__ import annotations
import copy
from typing import Any


def _match(evidence: dict[str, Any], profile: dict[str, Any]) -> tuple[bool,list[str],int]:
    reasons=[]; score=0; criteria=profile.get('match',{})
    for key in ('sha256','platform','architecture','version'):
        expected=criteria.get(key)
        if expected is not None:
            if evidence.get(key)!=expected: reasons.append(f'{key}_mismatch')
            else: score+=3
    required=set(criteria.get('required_files',[])); files=set(evidence.get('files',[]))
    if not required<=files: reasons.append('required_files_missing')
    else: score+=len(required)
    forbidden=set(criteria.get('forbidden_files',[]))
    if forbidden & files: reasons.append('forbidden_file_present')
    for refusal in profile.get('refuse_when',[]):
        if isinstance(refusal,dict) and all(evidence.get(k)==v for k,v in refusal.items()): reasons.append('known_refusal_condition')
    return not reasons,reasons,score


def run(evidence: dict[str, Any], profiles: list[dict[str, Any]], *, require_tested: bool = True) -> dict[str, Any]:
    matches=[]; rejected=[]
    for profile in profiles:
        if require_tested and not profile.get('tested',False): rejected.append({'id':profile.get('id'),'reasons':['not_tested']}); continue
        ok,reasons,score=_match(evidence,profile)
        if ok: matches.append({'id':profile.get('id'),'score':score,'profile':copy.deepcopy(profile)})
        else: rejected.append({'id':profile.get('id'),'reasons':reasons})
    matches.sort(key=lambda x:(-x['score'],str(x['id'])))
    top=[x for x in matches if matches and x['score']==matches[0]['score']]
    if len(top)==1: verdict='MATCHED'; selected=top[0]
    elif len(top)>1: verdict='REFUSE'; selected=None
    else: verdict='NO_MATCH'; selected=None
    return {'schema':'axm.translation.compatibility-profile-match/v1','verdict':verdict,'selected':selected,'candidates':matches,'rejected':rejected,'ambiguous':len(top)>1,'applied':False,'launched':False}
