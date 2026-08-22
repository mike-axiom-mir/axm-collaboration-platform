from __future__ import annotations
import hashlib

def h(x:bytes)->str: return hashlib.sha256(x).hexdigest()
def leaf_hash(text:str)->str: return h(('L:'+text).encode())
def pair_hash(a:str,b:str)->str: return h(('N:'+a+':'+b).encode())

def build_merkle(values:list[str])->dict:
    if not values: raise ValueError('values required')
    level=[leaf_hash(v) for v in values]; levels=[level]
    while len(level)>1:
        if len(level)%2: level=level+[level[-1]]
        level=[pair_hash(level[i],level[i+1]) for i in range(0,len(level),2)]
        levels.append(level)
    return {'root':level[0],'levels':levels,'leaf_count':len(values)}

def inclusion_proof(tree:dict,index:int)->list[dict]:
    if index<0 or index>=tree['leaf_count']: raise IndexError(index)
    proof=[]; idx=index
    for level in tree['levels'][:-1]:
        padded=level if len(level)%2==0 else level+[level[-1]]
        sib=idx-1 if idx%2 else idx+1
        proof.append({'hash':padded[sib],'side':'LEFT' if sib<idx else 'RIGHT'})
        idx//=2
    return proof

def verify(value:str,index:int,proof:list[dict],root:str)->bool:
    cur=leaf_hash(value)
    for p in proof:
        cur=pair_hash(p['hash'],cur) if p['side']=='LEFT' else pair_hash(cur,p['hash'])
    return cur==root

def changed_branches(old_values:list[str],new_values:list[str])->list[int]:
    if len(old_values)!=len(new_values): return list(range(max(len(old_values),len(new_values))))
    return [i for i,(a,b) in enumerate(zip(old_values,new_values)) if a!=b]
