from __future__ import annotations

def authorize_exchange(*,sender_role:str,receiver_role:str,payload_class:str,phase:str,receiver_output_sealed:bool)->dict:
    errors=[]
    if payload_class in {'PRIVATE_MEMORY','SECRET'}: errors.append('PRIVATE_PAYLOAD_DENIED')
    if receiver_role in {'VERIFIER','CHALLENGER'} and sender_role=='BUILDER' and phase=='INDEPENDENT_WORK' and not receiver_output_sealed:
        if payload_class in {'REASONING','DRAFT_ANSWER'}: errors.append('INDEPENDENCE_CONTAMINATION')
    if phase=='POST_SEAL' and payload_class=='EVIDENCE': pass
    return {'ok':not errors,'errors':errors,'status':'ALLOW' if not errors else 'DENY'}
