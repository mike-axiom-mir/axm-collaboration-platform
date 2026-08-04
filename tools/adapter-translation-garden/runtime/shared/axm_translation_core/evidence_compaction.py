from __future__ import annotations
import copy,hashlib,json
from typing import Any

def _canonical(value: Any) -> bytes:
    return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()

def _hash(value: Any) -> str:
    return hashlib.sha256(_canonical(value)).hexdigest()

def compact_evidence_bundle(items: list[dict[str,Any]], roots: list[str]|None=None) -> dict[str,Any]:
    objects={}; references={}; duplicate_count=0; issues=[]
    for item in items:
        item_id=str(item.get('id',''))
        if not item_id or item_id in references: issues.append('invalid_or_duplicate_id:'+item_id); continue
        payload=copy.deepcopy(item.get('payload')); digest=_hash(payload)
        if digest in objects: duplicate_count+=1
        else: objects[digest]=payload
        references[item_id]=digest
    root_ids=sorted(set(map(str,roots or [])))
    missing_roots=sorted(r for r in root_ids if r not in references)
    if missing_roots: issues.extend('missing_root:'+r for r in missing_roots)
    before_bytes=sum(len(_canonical(item.get('payload'))) for item in items)
    after_bytes=sum(len(_canonical(v)) for v in objects.values())+len(_canonical(references))+len(_canonical(root_ids))
    body={'objects':objects,'references':references,'roots':root_ids,'issues':issues,'item_count':len(references),'unique_object_count':len(objects),'duplicate_count':duplicate_count,'before_bytes':before_bytes,'after_bytes':after_bytes,'lossless':True}
    return {'schema':'axm.translation.compact-evidence-bundle/v1',**body,'bundle_sha256':_hash(body),'decision':'REVIEWABLE' if not issues else 'HOLD'}

def expand_evidence_bundle(bundle: dict[str,Any]) -> dict[str,Any]:
    objects=bundle.get('objects',{}); expanded=[]; issues=[]
    for item_id,digest in sorted(bundle.get('references',{}).items()):
        if digest not in objects: issues.append('missing_object:'+str(digest))
        else: expanded.append({'id':item_id,'payload':copy.deepcopy(objects[digest])})
    return {'schema':'axm.translation.expanded-evidence/v1','items':expanded,'roots':list(bundle.get('roots',[])),'issues':issues,'verdict':'PASS' if not issues else 'HOLD'}

def verify_compact_evidence_bundle(bundle: dict[str,Any]) -> dict[str,Any]:
    body={k:bundle.get(k) for k in ('objects','references','roots','issues','item_count','unique_object_count','duplicate_count','before_bytes','after_bytes','lossless')}
    valid=_hash(body)==bundle.get('bundle_sha256'); refs=all(d in bundle.get('objects',{}) for d in bundle.get('references',{}).values()); roots=all(r in bundle.get('references',{}) for r in bundle.get('roots',[])); counts=bundle.get('item_count')==len(bundle.get('references',{})) and bundle.get('unique_object_count')==len(bundle.get('objects',{}))
    return {'valid':valid and refs and roots and counts and bundle.get('lossless') is True,'hash_valid':valid,'references_valid':refs,'roots_valid':roots,'counts_valid':counts,'verdict':'PASS' if valid and refs and roots and counts and bundle.get('lossless') is True else 'HOLD'}

def evidence_reduction_report(bundle: dict[str,Any]) -> dict[str,Any]:
    before=int(bundle.get('before_bytes',0)); after=int(bundle.get('after_bytes',0)); saved=max(0,before-after); ratio=(saved/before) if before else 0.0
    return {'schema':'axm.translation.evidence-reduction-report/v1','before_bytes':before,'after_bytes':after,'saved_bytes':saved,'reduction_ratio':round(ratio,8),'duplicate_count':int(bundle.get('duplicate_count',0)),'lossless':bundle.get('lossless') is True,'claim_boundary':'JSON structural deduplication only; not a general binary compression benchmark.'}
