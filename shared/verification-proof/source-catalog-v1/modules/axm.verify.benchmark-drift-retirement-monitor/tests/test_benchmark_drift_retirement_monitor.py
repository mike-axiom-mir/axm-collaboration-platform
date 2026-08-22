from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "benchmark_drift_retirement_monitor.py"
SPEC = importlib.util.spec_from_file_location("axm.verify.benchmark_drift_retirement_monitor", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
M=MODULE.BenchmarkDriftRetirementMonitor()
def base():return {"benchmark_id":"b1","dataset_age_days":10,"max_dataset_age_days":30,"task_success_rate":.5,"saturation_threshold":.95,"environment_fingerprint":"e1","reference_environment_fingerprint":"e1","baseline_valid":True,"distribution_shift_detected":False,"invalidated_assumptions":[],"evidence_ids":["r1"]}
def test_current_retained():assert M.evaluate(base())["recommendation"]=="RETAIN_CURRENT"
def test_stale_dataset_detected():
    x=base();x["dataset_age_days"]=31;assert M.evaluate(x)["signals"][0]["code"]=="STALE_DATASET"
def test_saturation_detected():
    x=base();x["task_success_rate"]=.95;assert any(s["code"]=="SATURATED_TASK" for s in M.evaluate(x)["signals"])
def test_environment_drift_detected():
    x=base();x["environment_fingerprint"]="e2";assert M.evaluate(x)["recommendation"]=="REVISE_AND_REVALIDATE"
def test_invalid_baseline_escalates_retirement_review():
    x=base();x["baseline_valid"]=False;assert M.evaluate(x)["recommendation"]=="RETIRE_REVIEW"
def test_invalidated_assumptions_preserved():
    x=base();x["invalidated_assumptions"]=["population changed"];assert M.evaluate(x)["signals"][-1]["items"]==["population changed"]
def test_shift_never_auto_retires():
    x=base();x["distribution_shift_detected"]=True;o=M.evaluate(x);assert o["benchmark_retired"] is False and o["action_applied"] is False
def test_invalid_rate_refused():
    x=base();x["task_success_rate"]=2;raises(MODULE.BenchmarkDriftMonitorError,lambda:M.evaluate(x))
def test_boolean_required():
    x=base();x["baseline_valid"]="yes";raises(MODULE.BenchmarkDriftMonitorError,lambda:M.evaluate(x))
def test_no_authority_or_canon():
    o=M.evaluate(base());assert o["authority"]=="NONE" and o["canon"] is False

def run():
    tests=[v for n,v in sorted(globals().items()) if n.startswith("test_") and callable(v)]
    for t in tests:t()
    print(f"PASS {len(tests)} benchmark-drift-retirement-monitor tests")
if __name__=="__main__":run()
