from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'repeatability_reproducibility_runner.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.repeatability_reproducibility_runner', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

A=MODULE.RepeatabilityReproducibilityRunner()
def runs(vals):return [{"run_id":f"r{i}","setup_id":s,"status":"PASS","value":v} for i,(s,v) in enumerate(vals)]
def test_repeatable_and_reproducible_pass():assert A.assess(runs([("a",1),("a",1.1),("b",1.05),("b",1.0)]),0.2)["verdict_state"]=="PASS"
def test_repeatability_failure():assert A.assess(runs([("a",1),("a",2),("b",1),("b",1)]),0.2)["verdict_state"]=="FAIL"
def test_reproducibility_failure():assert A.assess(runs([("a",1),("a",1),("b",2),("b",2)]),0.2)["reproducibility"]=="FAIL"
def test_one_setup_unknown_reproducibility():assert A.assess(runs([("a",1),("a",1)]),0.2)["reproducibility"]=="UNKNOWN"
def test_one_run_setup_unknown_repeatability():assert A.assess(runs([("a",1),("b",1)]),0.2)["per_setup"]["a"]["repeatability"]=="UNKNOWN"
def test_failed_run_fails():assert A.assess([{"run_id":"x","setup_id":"a","status":"FAIL","value":None}],0.1)["verdict_state"]=="FAIL"
def test_duplicate_run_refused():raises(MODULE.RepeatabilityError,lambda:A.assess([{"run_id":"x","setup_id":"a","status":"PASS","value":1},{"run_id":"x","setup_id":"a","status":"PASS","value":1}],0.1))
def test_nonfinite_refused():raises(MODULE.RepeatabilityError,lambda:A.assess(runs([("a",float("inf"))]),0.1))
def test_negative_tolerance_refused():raises(MODULE.RepeatabilityError,lambda:A.assess(runs([("a",1)]),-1))
def test_boundaries_visible():
    out=A.assess(runs([("a",1),("a",1)]),0.1);assert out["evaluation_executed"] is False and out["external_independence_proven"] is False and out["canon"] is False

def run():
    tests=[value for name,value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:test()
    print(f"PASS {len(tests)} repeatability-reproducibility-runner tests")
if __name__=="__main__":run()
