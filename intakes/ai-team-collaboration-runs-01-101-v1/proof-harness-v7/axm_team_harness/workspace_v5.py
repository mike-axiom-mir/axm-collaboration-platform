from __future__ import annotations
from dataclasses import dataclass
@dataclass(frozen=True)
class BranchPatch:
    branch_id:str; base_revision:int; writer:str; paths:frozenset[str]; semantic_keys:frozenset[str]; patch_digest:str

def merge_patches(patches:list[BranchPatch],*,current_revision:int)->dict:
    errors=[]; path_owner={}; semantic_owner={}
    for p in patches:
        if p.base_revision!=current_revision: errors.append(f'STALE_BASE:{p.branch_id}')
        if not p.patch_digest: errors.append(f'MISSING_DIGEST:{p.branch_id}')
        for path in p.paths:
            if path in path_owner: errors.append(f'PATH_CONFLICT:{path}')
            path_owner[path]=p.branch_id
        for key in p.semantic_keys:
            if key in semantic_owner: errors.append(f'SEMANTIC_CONFLICT:{key}')
            semantic_owner[key]=p.branch_id
    return {'ok':not errors,'errors':sorted(set(errors)),'status':'MERGE_PROPOSAL_READY' if not errors else 'CONFLICT_HELD','next_revision':current_revision+1 if not errors else current_revision,'last_write_wins':False}
