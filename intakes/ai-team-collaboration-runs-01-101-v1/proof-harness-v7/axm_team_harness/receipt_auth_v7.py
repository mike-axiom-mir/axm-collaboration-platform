from __future__ import annotations
import hashlib, hmac, json

def _canon(payload:dict)->bytes:
    return json.dumps(payload,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode('utf-8')
def sign_receipt(payload:dict,*,key_id:str,key:bytes,epoch:int)->dict:
    body={'payload':payload,'key_id':key_id,'epoch':epoch,'algorithm':'HMAC-SHA256'}
    body['mac']=hmac.new(key,_canon(body),hashlib.sha256).hexdigest()
    return body
def verify_receipt(env:dict,*,keyring:dict[str,bytes],current_epoch:int,revoked_keys:set[str])->dict:
    errors=[]; key_id=env.get('key_id')
    if key_id in revoked_keys: errors.append('KEY_REVOKED')
    key=keyring.get(key_id)
    if key is None: errors.append('UNKNOWN_KEY')
    if env.get('epoch')!=current_epoch: errors.append('STALE_KEY_EPOCH')
    if env.get('algorithm')!='HMAC-SHA256': errors.append('ALGORITHM_MISMATCH')
    if key is not None:
        body={k:v for k,v in env.items() if k!='mac'}
        expected=hmac.new(key,_canon(body),hashlib.sha256).hexdigest()
        if not hmac.compare_digest(str(env.get('mac','')),expected): errors.append('MAC_INVALID')
    return {'ok':not errors,'errors':sorted(set(errors)),'scope':'LOCAL_SHARED_SECRET_AUTHENTICITY_ONLY'}
