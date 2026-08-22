from __future__ import annotations
from dataclasses import dataclass
@dataclass(frozen=True)
class AuthorityPacket:
    packet_id:str; epoch:int; issued_seq:int; expires_seq:int; action:str

def validate_packet(p:AuthorityPacket,*,current_epoch:int,current_seq:int,allowed_actions:set[str])->dict:
    errors=[]
    if p.epoch<current_epoch: errors.append('STALE_EPOCH')
    if p.epoch>current_epoch: errors.append('FUTURE_EPOCH_HELD')
    if current_seq<p.issued_seq: errors.append('SEQUENCE_ROLLBACK_OR_FUTURE_ISSUE')
    if current_seq>p.expires_seq: errors.append('PACKET_EXPIRED')
    if p.action not in allowed_actions: errors.append('ACTION_NOT_ALLOWED')
    return {'ok':not errors,'errors':sorted(errors),'status':'AUTHORIZED' if not errors else 'DENIED_OR_HELD'}

def rotate_epoch(current_epoch:int,*,human_receipt:bool)->dict:
    if not human_receipt: return {'ok':False,'epoch':current_epoch,'error':'HUMAN_RECEIPT_REQUIRED'}
    return {'ok':True,'epoch':current_epoch+1,'receipt':f'EPOCH:{current_epoch}->{current_epoch+1}'}
