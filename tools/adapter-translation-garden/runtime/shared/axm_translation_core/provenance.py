from __future__ import annotations
import copy
from typing import Any
_LEVELS={'public':0,'internal':1,'personal':2,'sensitive':3,'secret':4}

def new_provenance(*, source_id: str, classification: str='internal', consent_scopes: list[str] | None=None, lineage: list[dict[str,Any]] | None=None) -> dict[str,Any]:
    if not source_id: raise ValueError('source_id is required')
    if classification not in _LEVELS: raise ValueError('unsupported classification')
    return {'schema':'axm.translation.provenance/v1','source_ids':[source_id],'classification':classification,'consent_scopes':sorted(set(consent_scopes or [])),'lineage':copy.deepcopy(lineage or []),'released':False}

def merge_provenance(records: list[dict[str,Any]], *, operation: str, module_id: str) -> dict[str,Any]:
    if not records: raise ValueError('at least one provenance record is required')
    bad=[r for r in records if r.get('classification') not in _LEVELS]
    if bad: raise ValueError('unsupported classification')
    classification=max((r['classification'] for r in records),key=lambda x:_LEVELS[x])
    scopes=set(records[0].get('consent_scopes',[]))
    for r in records[1:]: scopes&=set(r.get('consent_scopes',[]))
    source_ids=sorted({sid for r in records for sid in r.get('source_ids',[])})
    lineage=[item for r in records for item in r.get('lineage',[])]+[{'operation':operation,'module_id':module_id,'input_classifications':[r['classification'] for r in records]}]
    return {'schema':'axm.translation.provenance/v1','source_ids':source_ids,'classification':classification,'consent_scopes':sorted(scopes),'lineage':lineage,'released':False}

def release_decision(record: dict[str,Any], *, target_max_classification: str, required_scope: str | None=None, explicit_downgrade_approval: bool=False) -> dict[str,Any]:
    source=record.get('classification'); errors=[]
    if source not in _LEVELS or target_max_classification not in _LEVELS: errors.append('unsupported_classification')
    else:
        if _LEVELS[source]>_LEVELS[target_max_classification] and not explicit_downgrade_approval: errors.append('classification_downgrade_not_approved')
    if required_scope and required_scope not in record.get('consent_scopes',[]): errors.append('required_consent_scope_missing')
    return {'schema':'axm.translation.release-decision/v1','verdict':'ALLOW' if not errors else 'REFUSE','errors':errors,'source_classification':source,'target_max_classification':target_max_classification,'released':False,'transmitted':False}
