from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "failure_memory_regression_selector.py"
SPEC = importlib.util.spec_from_file_location("failure_memory_regression_selector", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Selector=MODULE.FailureMemoryRegressionSelector()
def f(i,s="VERIFIED",keys=()):return {"failure_id":i,"status":s,"regression_keys":list(keys)}
def t(i,ids=(),keys=()):return {"test_id":i,"covers_failure_ids":list(ids),"regression_keys":list(keys)}
def test_verified_selected_by_id():assert Selector.select([f("f1")],[t("t1",ids=["f1"])])["verdict_state"]=="PASS"
def test_verified_selected_by_key():assert Selector.select([f("f1",keys=["save"])],[t("t1",keys=["save"])])["selected_tests"][0]["test_id"]=="t1"
def test_uncovered_verified_fails():assert Selector.select([f("f1")],[])["verdict_state"]=="FAIL"
def test_no_verified_unknown():assert Selector.select([f("f1","UNREVIEWED")],[])["verdict_state"]=="UNKNOWN"
def test_unreviewed_held_out():assert Selector.select([f("f1","UNREVIEWED")],[t("t",ids=["f1"])])["held_out_failures"]["UNREVIEWED"]==["f1"]
def test_test_ceiling():assert len(Selector.select([f("f1")],[t("a",ids=["f1"]),t("b",ids=["f1"])],max_tests=1)["selected_tests"])==1
def test_duplicate_failure_refused():raises(MODULE.FailureMemoryError,lambda:Selector.select([f("x"),f("x")],[]))
def test_duplicate_test_refused():raises(MODULE.FailureMemoryError,lambda:Selector.select([f("x")],[t("a"),t("a")]))
def test_bad_status_refused():raises(MODULE.FailureMemoryError,lambda:Selector.select([f("x","MAGIC")],[]))
def test_boundary_truth():
    result=Selector.select([f("f1")],[t("t1",ids=["f1"])]);assert result["only_verified_failures_auto_selected"] and result["tests_executed"] is False and result["authority"]=="NONE" and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} failure-memory-regression-selector tests")

if __name__ == "__main__":
    run()
