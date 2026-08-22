from __future__ import annotations
import hashlib, json
REQUIRED={'claim','support_refs','limitations','unknowns','status'}
def evidence_digest(evidence:dict)->str:
    return hashlib.sha256(json.dumps(evidence,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def make_summary(*,claim:str,support_refs:list[str],limitations:list[str],unknowns:list[str],status:str,evidence:dict)->dict:
    s={'claim':claim,'support_refs':support_refs,'limitations':limitations,'unknowns':unknowns,'status':status,'reconstruction_digest':evidence_digest(evidence)}
    return s

def validate_summary(summary:dict,*,evidence:dict,supported_claims:set[str],required_limitations:set[str])->dict:
    errors=[]
    if REQUIRED-set(summary): errors.append('MISSING_REQUIRED_FIELDS')
    if summary.get('claim') not in supported_claims: errors.append('UNSUPPORTED_CLAIM')
    if not required_limitations.issubset(set(summary.get('limitations',[]))): errors.append('LIMITATION_OMITTED')
    if summary.get('reconstruction_digest')!=evidence_digest(evidence): errors.append('RECONSTRUCTION_DIGEST_MISMATCH')
    if not summary.get('support_refs'): errors.append('MISSING_SUPPORT_REFS')
    return {'ok':not errors,'errors':sorted(errors),'status':'SUMMARY_VALID' if not errors else 'HELD'}
