from __future__ import annotations
import hashlib, json
from typing import Any

def _canon(value: Any) -> str:
    raw=json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode('utf-8')
    return hashlib.sha256(raw).hexdigest()

def build_source_snapshot(records: list[dict[str, Any]], source_id: str, observed_at: int) -> dict[str, Any]:
    by_path={}
    for record in records:
        path=str(record.get('path','')).strip()
        digest=str(record.get('sha256','')).lower()
        size=record.get('size_bytes')
        if not path or path.startswith('/') or '..' in path.split('/'):
            raise ValueError('unsafe_or_empty_path')
        if path in by_path: raise ValueError('duplicate_path')
        if len(digest)!=64 or any(c not in '0123456789abcdef' for c in digest): raise ValueError('invalid_sha256')
        if not isinstance(size,int) or size<0: raise ValueError('invalid_size')
        by_path[path]={'path':path,'sha256':digest,'size_bytes':size,'kind':str(record.get('kind','file'))}
    items=[by_path[k] for k in sorted(by_path)]
    body={'source_id':str(source_id),'observed_at':int(observed_at),'records':items}
    return {'schema':'axm.translation.source-snapshot/v1',**body,'snapshot_sha256':_canon(body)}

def compare_source_snapshots(baseline: dict[str, Any], current: dict[str, Any], allowed_changes: list[dict[str, str]] | None=None) -> dict[str, Any]:
    allowed={(str(x.get('path')),str(x.get('change'))) for x in (allowed_changes or [])}
    before={x['path']:x for x in baseline.get('records',[])}; after={x['path']:x for x in current.get('records',[])}
    changes=[]
    for path in sorted(set(before)|set(after)):
        if path not in before: kind='ADDED'
        elif path not in after: kind='REMOVED'
        elif before[path]['sha256']!=after[path]['sha256'] or before[path]['size_bytes']!=after[path]['size_bytes']: kind='CHANGED'
        else: continue
        changes.append({'path':path,'change':kind,'reviewed':(path,kind) in allowed})
    unexplained=[x for x in changes if not x['reviewed']]
    return {'schema':'axm.translation.source-drift-report/v1','baseline_sha256':baseline.get('snapshot_sha256'),'current_sha256':current.get('snapshot_sha256'),'changes':changes,'unexplained':unexplained,'verdict':'PASS' if not unexplained else 'HOLD','automatic_accept':False}

def lineage_continuity_decision(report: dict[str, Any], require_exact: bool=True) -> dict[str, Any]:
    changes=list(report.get('changes',[])); unexplained=list(report.get('unexplained',[]))
    exact=not changes
    accepted=(exact if require_exact else not unexplained)
    return {'schema':'axm.translation.lineage-continuity-decision/v1','decision':'CONTINUOUS' if accepted else 'HOLD','exact_match':exact,'reviewed_changes':len(changes)-len(unexplained),'unexplained_changes':len(unexplained),'require_exact':bool(require_exact),'human_review_required':not exact,'executed':False}

def summarize_source_drift(report: dict[str, Any]) -> dict[str, int | str]:
    counts={'ADDED':0,'REMOVED':0,'CHANGED':0}
    for item in report.get('changes',[]): counts[item['change']]=counts.get(item['change'],0)+1
    return {'verdict':str(report.get('verdict','HOLD')),'added':counts['ADDED'],'removed':counts['REMOVED'],'changed':counts['CHANGED'],'unexplained':len(report.get('unexplained',[]))}
