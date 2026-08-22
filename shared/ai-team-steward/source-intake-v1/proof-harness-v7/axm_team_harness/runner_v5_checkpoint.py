from __future__ import annotations
import json
from pathlib import Path
from .registry import harness_root
from .coalition_v5 import CoalitionMember,CoalitionCharter,validate_coalition,dissolve
from .freshness_v5 import EvidenceNode,evaluate_freshness
from .revocation_v5 import LeaseNode,cascade_revoke,authorize
from .workspace_v5 import BranchPatch,merge_patches
from .proof_frontier_v5 import minimal_proof_frontier,evaluate_novelty

def run_checkpoint_v5()->dict:
    d=json.loads((harness_root()/'registry'/'seed_registry_v5_checkpoint.json').read_text()); c={k:0 for k in ['coalition','freshness','revocation','workspace','frontier']}
    for e in d['entries']:
        mid=e['module_id']; ps=e['proof_slice_id']; m=CoalitionMember('s',frozenset({'SCOUT'}),frozenset({'read'}),frozenset({'internal'})); ch=CoalitionCharter('c',mid,'human',(m,),frozenset({'read'}),frozenset({'internal'}),0,10,1)
        c['coalition']+=int(validate_coalition(ch,now_tick=1,max_members=2,max_depth=2)['ok'] and not dissolve(ch,{'l'})['residual_authority'])
        c['freshness']+=int(evaluate_freshness([EvidenceNode('a',0,10),EvidenceNode('b',0,10,('a',))],now_tick=1)['ok'])
        nodes=[LeaseNode('r',None,'h',frozenset({'read'})),LeaseNode('c','r','s',frozenset({'read'}))]; rv=cascade_revoke(nodes,'r'); c['revocation']+=int(not authorize(rv['nodes'],'c','read')['ok'])
        c['workspace']+=int(merge_patches([BranchPatch('a',1,'x',frozenset({'a'}),frozenset({'x'}),ps)],current_revision=1)['ok'])
        c['frontier']+=int(minimal_proof_frontier({'a','b'},{'t1':{'a'},'t2':{'b'}})['ok'] and not evaluate_novelty(delta_digest='x',prior_digests={'x'},new_test=False,new_evidence=False,new_boundary=False)['ok'])
    return {'checkpoint':'RUNS_72_76','counts':c,'passed':all(v==100 for v in c.values()),'canon':False,'axm_runtime_integrated':False}
