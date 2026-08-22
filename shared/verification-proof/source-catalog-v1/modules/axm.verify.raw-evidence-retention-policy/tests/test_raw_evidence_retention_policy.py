from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'raw_evidence_retention_policy.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.raw_evidence_retention_policy', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
P=MODULE.RawEvidenceRetentionPolicy()
def evidence(**changes):
    base={"evidence_id":"e1","category":"test","sensitivity":"PRIVATE","age_days":10,"sealed":True,"legal_hold":False};base.update(changes);return base
def rule(action="KEEP",match=None,roles=None):return {"match":match or {},"action":action,"authorized_roles":roles or ["steward"]}
def test_matching_rule_passes():assert P.decide(evidence(),[rule()],"steward")["verdict_state"]=="PASS"
def test_first_matching_rule_wins():assert P.decide(evidence(),[rule("SUMMARIZE"),rule("KEEP")],"steward")["decision"]=="SUMMARIZE"
def test_no_match_is_unknown():assert P.decide(evidence(category="x"),[rule(match={"category":"y"})],"steward")["verdict_state"]=="UNKNOWN"
def test_unauthorized_role_needs_review():assert P.decide(evidence(),[rule(roles=["owner"])],"steward")["verdict_state"]=="HUMAN_REVIEW"
def test_legal_hold_blocks_delete():
    out=P.decide(evidence(legal_hold=True),[rule("DELETE")],"steward");assert out["decision"]=="KEEP" and out["overrides"]
def test_requested_mismatch_needs_review():assert P.decide(evidence(),[rule("KEEP")],"steward","DELETE")["verdict_state"]=="HUMAN_REVIEW"
def test_age_range_matches():assert P.decide(evidence(age_days=30),[rule("ROTATE",{"min_age_days":20})],"steward")["decision"]=="ROTATE"
def test_invalid_action_refused():raises(MODULE.RetentionPolicyError,lambda:P.decide(evidence(),[{"match":{},"action":"DESTROY","authorized_roles":[]}],"steward"))
def test_negative_age_refused():raises(MODULE.RetentionPolicyError,lambda:P.decide(evidence(age_days=-1),[rule()],"steward"))
def test_boundary_truth():
    out=P.decide(evidence(),[rule("DELETE")],"steward");assert out["action_executed"] is False and out["authority"]=="NONE" and out["canon"] is False
def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} raw-evidence-retention-policy tests")

if __name__ == "__main__":
    run()
