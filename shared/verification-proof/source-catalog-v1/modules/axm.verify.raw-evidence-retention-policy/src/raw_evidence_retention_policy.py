"""Detached AXM Raw Evidence Retention Policy v0.1.0."""
from __future__ import annotations
from typing import Any,Dict,Mapping,Sequence

ACTIONS={"KEEP","SUMMARIZE","ROTATE","LOCAL_SEAL","DELETE"}
class RetentionPolicyError(ValueError):pass

def _matches(evidence:Mapping[str,Any],match:Mapping[str,Any])->bool:
    for key,value in match.items():
        if key=="min_age_days":
            if evidence["age_days"]<value:return False
        elif key=="max_age_days":
            if evidence["age_days"]>value:return False
        elif evidence.get(key)!=value:return False
    return True

class RawEvidenceRetentionPolicy:
    def decide(self,evidence:Mapping[str,Any],rules:Sequence[Mapping[str,Any]],actor_role:str,requested_action:str|None=None)->Dict[str,Any]:
        if not isinstance(evidence,Mapping) or not isinstance(rules,Sequence) or isinstance(rules,(str,bytes)) or not isinstance(actor_role,str) or not actor_role:raise RetentionPolicyError("evidence, rules, and actor role required")
        for key in ("evidence_id","category","sensitivity"):
            if not isinstance(evidence.get(key),str) or not evidence.get(key):raise RetentionPolicyError(f"missing {key}")
        if not isinstance(evidence.get("age_days"),int) or isinstance(evidence.get("age_days"),bool) or evidence["age_days"]<0:raise RetentionPolicyError("age_days must be a non-negative integer")
        if not isinstance(evidence.get("sealed"),bool) or not isinstance(evidence.get("legal_hold"),bool):raise RetentionPolicyError("sealed and legal_hold must be booleans")
        selected=None
        for index,rule in enumerate(rules):
            if not isinstance(rule,Mapping) or rule.get("action") not in ACTIONS or not isinstance(rule.get("authorized_roles"),list):raise RetentionPolicyError("invalid retention rule")
            if _matches(evidence,rule.get("match",{})):selected=(index,rule);break
        if selected is None:return {"schema_version":"axm.verify.raw-evidence-retention-decision/0.1","verdict_state":"UNKNOWN","decision":None,"reason":"NO_MATCHING_RULE","authorized":False,"action_executed":False,"authority":"NONE","canon":False}
        index,rule=selected;decision=rule["action"];overrides=[]
        if evidence["legal_hold"] and decision=="DELETE":decision="KEEP";overrides.append("LEGAL_HOLD_BLOCKED_DELETE")
        authorized=actor_role in rule["authorized_roles"]
        requested_matches=requested_action is None or requested_action==decision
        verdict="PASS" if authorized and requested_matches else "HUMAN_REVIEW"
        reason="POLICY_MATCH" if verdict=="PASS" else ("UNAUTHORIZED_ROLE" if not authorized else "REQUESTED_ACTION_DIFFERS")
        return {"schema_version":"axm.verify.raw-evidence-retention-decision/0.1","verdict_state":verdict,"decision":decision,"matched_rule_index":index,"authorized":authorized,"requested_action":requested_action,"requested_action_matches":requested_matches,"overrides":overrides,"reason":reason,"action_executed":False,"authority":"NONE","canon":False}
