from __future__ import annotations
import hashlib, json
from dataclasses import dataclass

def digest_payload(payload:dict)->str:
    return hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(',',':')).encode()).hexdigest()
@dataclass(frozen=True)
class EvidenceRecord:
    evidence_id:str; payload:dict; owner:str

def commit(record:EvidenceRecord)->dict:
    return {'evidence_id':record.evidence_id,'owner':record.owner,'commitment':digest_payload(record.payload)}

def disclose(record:EvidenceRecord,*,allowed_fields:set[str],requested_fields:set[str],redaction_reason:str)->dict:
    forbidden=sorted(requested_fields-allowed_fields)
    if forbidden:
        return {'ok':False,'errors':['UNAUTHORIZED_FIELD_REQUEST'],'forbidden':forbidden}
    view={k:record.payload[k] for k in sorted(requested_fields) if k in record.payload}
    receipt={'evidence_id':record.evidence_id,'shown_fields':sorted(view),'redacted_fields':sorted(set(record.payload)-set(view)),'reason':redaction_reason,'source_commitment':digest_payload(record.payload),'view_digest':digest_payload(view)}
    return {'ok':True,'view':view,'receipt':receipt}

def verify_view(record:EvidenceRecord,disclosure:dict)->dict:
    if not disclosure.get('ok'): return {'ok':False,'error':'DISCLOSURE_NOT_AUTHORIZED'}
    r=disclosure['receipt']; expected=digest_payload(record.payload); actual=digest_payload(disclosure['view'])
    ok=r.get('source_commitment')==expected and r.get('view_digest')==actual
    return {'ok':ok,'error':None if ok else 'CUSTODY_OR_VIEW_TAMPER'}
