from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "adversarial_challenger_harness.py"
SPEC = importlib.util.spec_from_file_location("axm.verify.adversarial_challenger_harness", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
H=MODULE.AdversarialChallengerHarness()
def claim():return {"claim_id":"c1","statement":"system reconnects","assumptions":["network exists"],"input_dimensions":["latency"]}
def test_assumption_challenge_created():assert H.build_plan(claim(),{"latency":[0]},[],10)["challenges"][0]["type"]=="ASSUMPTION_CHALLENGE"
def test_boundary_challenge_preserves_value():assert any(x.get("input")==0 for x in H.build_plan(claim(),{"latency":[0]},[],10)["challenges"])
def test_hostile_probe_is_unexecuted():assert any(x["type"]=="HOSTILE_INPUT_PROBE" and x["executed"] is False for x in H.build_plan(claim(),{},[],10)["challenges"])
def test_alternative_explanation_created():assert any(x["type"]=="ALTERNATIVE_EXPLANATION" for x in H.build_plan(claim(),{},["cached result"],10)["challenges"])
def test_ceiling_enforced():assert len(H.build_plan(claim(),{"latency":[0,1,2]},["a"],2)["challenges"])==2
def test_truncation_visible():assert H.build_plan(claim(),{"latency":[0,1,2]},[],1)["truncated"] is True
def test_unknown_dimension_refused():raises(MODULE.ChallengerHarnessError,lambda:H.build_plan(claim(),{"memory":[1]},[],10))
def test_invalid_ceiling_refused():raises(MODULE.ChallengerHarnessError,lambda:H.build_plan(claim(),{},[],0))
def test_missing_claim_refused():raises(MODULE.ChallengerHarnessError,lambda:H.build_plan({}, {}, [],10))
def test_no_execution_or_decision():
    o=H.build_plan(claim(),{},[],10);assert o["execution_performed"] is False and o["claim_verdict"]=="NOT_DECIDED" and o["canon"] is False

def run():
    tests=[v for n,v in sorted(globals().items()) if n.startswith("test_") and callable(v)]
    for t in tests:t()
    print(f"PASS {len(tests)} adversarial-challenger-harness tests")
if __name__=="__main__":run()
