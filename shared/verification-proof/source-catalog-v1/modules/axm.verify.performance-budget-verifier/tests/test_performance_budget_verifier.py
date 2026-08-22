from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "performance_budget_verifier.py"
SPEC = importlib.util.spec_from_file_location("performance_budget_verifier", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Verifier=MODULE.PerformanceBudgetVerifier();B=[{"workload_id":"w","metric":"latency","direction":"max","threshold":20,"unit":"ms","aggregation":"p95"}];O=[{"workload_id":"w","metric":"latency","unit":"ms","status":"PASS","samples":[10,12,15]}]
def test_passes_budget():assert Verifier.verify(B,O)['verdict_state']=="PASS"
def test_violation_fails():assert Verifier.verify(B,[{**O[0],"samples":[10,30]}])['verdict_state']=="FAIL"
def test_min_direction():assert Verifier.verify([{**B[0],"metric":"throughput","direction":"min","threshold":5,"unit":"ops","aggregation":"mean"}],[{"workload_id":"w","metric":"throughput","unit":"ops","status":"PASS","samples":[5,6]}])['verdict_state']=="PASS"
def test_missing_unknown():assert Verifier.verify(B,[])['verdict_state']=="UNKNOWN"
def test_stale_unknown():assert Verifier.verify(B,[{**O[0],"status":"STALE","samples":[]}])['verdict_state']=="UNKNOWN"
def test_unit_mismatch_fails():assert Verifier.verify(B,[{**O[0],"unit":"s"}])['verdict_state']=="FAIL"
def test_max_aggregation():assert Verifier.verify([{**B[0],"aggregation":"max"}],O)['results'][0]['observed']==15
def test_duplicate_budget_refused():raises(MODULE.PerformanceBudgetError,lambda:Verifier.verify(B+B,O))
def test_empty_samples_refused_for_pass():raises(MODULE.PerformanceBudgetError,lambda:Verifier.verify(B,[{**O[0],"samples":[]}]))
def test_boundary_truth():
    result=Verifier.verify(B,O);assert result['does_not_generate_load'] and result['samples_are_caller_supplied'] and result['environment_control_proven'] is False and result['canon'] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} performance-budget-verifier tests")

if __name__ == "__main__":
    run()
