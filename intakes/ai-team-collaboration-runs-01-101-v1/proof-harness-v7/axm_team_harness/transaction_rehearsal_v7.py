from __future__ import annotations
import hashlib, json

def _digest(x)->str: return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def prepare_transaction(operations:list[dict],*,manifest_digest:str,human_prepare_receipt:str)->dict:
    errors=[]
    if not human_prepare_receipt: errors.append('HUMAN_PREPARE_REQUIRED')
    if not manifest_digest: errors.append('MANIFEST_REQUIRED')
    if any(op.get('phase')!='PROPOSE' for op in operations): errors.append('NON_PROPOSAL_OPERATION')
    if any(op.get('irreversible') and not op.get('explicit_human_scope') for op in operations): errors.append('IRREVERSIBLE_SCOPE_MISSING')
    plan={'operations':operations,'manifest_digest':manifest_digest,'human_prepare_receipt':human_prepare_receipt}
    return {'ok':not errors,'errors':errors,'prepared_digest':_digest(plan) if not errors else None,'plan':plan,'state':'PREPARED' if not errors else 'HELD'}
def commit_rehearsal(prepared:dict,*,presented_digest:str,human_commit_receipt:str)->dict:
    errors=[]
    if not prepared.get('ok'): errors.append('NOT_PREPARED')
    if prepared.get('prepared_digest')!=presented_digest: errors.append('PREPARED_DIGEST_MISMATCH')
    if not human_commit_receipt: errors.append('HUMAN_COMMIT_REQUIRED')
    return {'ok':not errors,'errors':errors,'state':'REHEARSAL_COMMIT_PROVED' if not errors else 'ABORTED','runtime_applied':False}
def abort_rehearsal(prepared:dict)->dict:
    return {'ok':True,'state':'ABORTED_AND_CLEAN','prepared_digest':prepared.get('prepared_digest'),'runtime_applied':False}
