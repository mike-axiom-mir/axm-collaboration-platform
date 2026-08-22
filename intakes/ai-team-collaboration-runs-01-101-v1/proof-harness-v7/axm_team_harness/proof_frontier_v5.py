from __future__ import annotations

def minimal_proof_frontier(obligations:set[str],coverage:dict[str,set[str]])->dict:
    uncovered=set(obligations); selected=[]
    while uncovered:
        ranked=sorted(((len(v&uncovered),k) for k,v in coverage.items()),key=lambda x:(-x[0],x[1]))
        if not ranked or ranked[0][0]==0: return {'ok':False,'selected':selected,'uncovered':sorted(uncovered)}
        _,test=ranked[0]; selected.append(test); uncovered-=coverage[test]
    return {'ok':True,'selected':selected,'uncovered':[]}

def evaluate_novelty(*,delta_digest:str,prior_digests:set[str],new_test:bool,new_evidence:bool,new_boundary:bool)->dict:
    novel=bool(delta_digest and delta_digest not in prior_digests and (new_test or new_evidence or new_boundary))
    return {'ok':novel,'status':'NOVEL_DELTA' if novel else 'NO_NOVEL_DELTA'}

def select_change_tests(*,root_change:bool,semantic_change:bool,module_test:str,all_tests:set[str])->dict:
    if root_change: return {'selected':sorted(all_tests),'forced_full':True}
    if semantic_change: return {'selected':[module_test],'forced_full':False}
    return {'selected':['smoke:registry'],'forced_full':False}
