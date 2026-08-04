from __future__ import annotations
import copy
from typing import Any
from .core import contract_fingerprint


def build_replay_record(*, replay_id: str, module_id: str, module_version: str, request: Any, output: Any, authority: Any, proof_tip: str | None) -> dict[str, Any]:
    if not replay_id or not module_id or not module_version: raise ValueError('replay_id, module_id, and module_version are required')
    return {'schema':'axm.translation.replay-record/v1','replay_id':replay_id,'module':{'id':module_id,'version':module_version},'fingerprints':{'request':contract_fingerprint(request),'output':contract_fingerprint(output),'authority':contract_fingerprint(authority)},'proof_tip':proof_tip,'request':copy.deepcopy(request),'output':copy.deepcopy(output),'authority':copy.deepcopy(authority),'executed':False}


def verify_replay_record(record: dict[str, Any], *, request: Any, output: Any, authority: Any, proof_tip: str | None) -> dict[str, Any]:
    expected={'request':contract_fingerprint(request)['digest'],'output':contract_fingerprint(output)['digest'],'authority':contract_fingerprint(authority)['digest']}
    observed={k:record.get('fingerprints',{}).get(k,{}).get('digest') for k in expected}
    mismatches={k:{'expected':expected[k],'observed':observed[k]} for k in expected if expected[k]!=observed[k]}
    if record.get('proof_tip')!=proof_tip: mismatches['proof_tip']={'expected':proof_tip,'observed':record.get('proof_tip')}
    return {'verdict':'MATCH' if not mismatches else 'MISMATCH','mismatches':mismatches,'reexecuted':False}


def compare_replay_outputs(left: Any, right: Any) -> dict[str, Any]:
    l=contract_fingerprint(left); r=contract_fingerprint(right)
    return {'equal':l['digest']==r['digest'],'left':l,'right':r}
