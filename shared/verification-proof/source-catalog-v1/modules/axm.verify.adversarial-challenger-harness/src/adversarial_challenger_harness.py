"""Detached AXM Adversarial Challenger Harness v0.1.0."""
from __future__ import annotations
from typing import Any,Dict,Mapping
class ChallengerHarnessError(ValueError):pass

def _strings(v:Any,field:str)->list[str]:
    if not isinstance(v,list) or any(not isinstance(x,str) or not x.strip() for x in v):raise ChallengerHarnessError(f"{field} must be string list")
    return [x.strip() for x in v]
class AdversarialChallengerHarness:
    def build_plan(self,claim:Mapping[str,Any],boundaries:Mapping[str,list[Any]],alternative_explanations:list[str],max_challenges:int=20)->Dict[str,Any]:
        if not isinstance(claim,Mapping) or not isinstance(claim.get("claim_id"),str) or not claim["claim_id"] or not isinstance(claim.get("statement"),str) or not claim["statement"].strip():raise ChallengerHarnessError("claim identity and statement required")
        assumptions=_strings(claim.get("assumptions",[]),"assumptions");dimensions=_strings(claim.get("input_dimensions",[]),"input_dimensions");alternatives=_strings(alternative_explanations,"alternative_explanations")
        if not isinstance(boundaries,Mapping) or any(not isinstance(k,str) or k not in dimensions or not isinstance(v,list) for k,v in boundaries.items()):raise ChallengerHarnessError("invalid boundaries")
        if isinstance(max_challenges,bool) or not isinstance(max_challenges,int) or not 1<=max_challenges<=100:raise ChallengerHarnessError("max_challenges must be 1..100")
        candidates=[]
        for assumption in assumptions:candidates.append({"type":"ASSUMPTION_CHALLENGE","target":assumption,"prompt":f"What evidence would show assumption '{assumption}' is false?"})
        for dimension in dimensions:
            for value in boundaries.get(dimension,[]):candidates.append({"type":"BOUNDARY_COUNTEREXAMPLE","target":dimension,"input":value,"prompt":f"Test claim at declared boundary for {dimension}."})
            candidates.append({"type":"HOSTILE_INPUT_PROBE","target":dimension,"input":None,"prompt":f"Test missing or malformed {dimension} under bounded safety controls."})
        for explanation in alternatives:candidates.append({"type":"ALTERNATIVE_EXPLANATION","target":explanation,"prompt":"Identify evidence that distinguishes this explanation from the claim."})
        candidates.append({"type":"FALSIFICATION_QUESTION","target":claim["claim_id"],"prompt":"What single bounded observation would most weaken this claim?"})
        selected=candidates[:max_challenges]
        for index,item in enumerate(selected,1):item["challenge_id"]=f"{claim['claim_id']}:challenge:{index:03d}";item["executed"]=False
        return {"schema_version":"axm.verify.adversarial-challenge-plan/0.1","claim_id":claim["claim_id"],"challenges":selected,"candidate_count":len(candidates),"truncated":len(candidates)>len(selected),"execution_performed":False,"claim_verdict":"NOT_DECIDED","approval_authority":False,"canon":False}
