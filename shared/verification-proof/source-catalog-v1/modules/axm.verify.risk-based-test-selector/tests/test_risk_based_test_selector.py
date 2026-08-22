from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "risk_based_test_selector.py"
SPEC = importlib.util.spec_from_file_location("risk_based_test_selector", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Selector=MODULE.RiskBasedTestSelector()
def item(i,impact,cost=1,**kw):return {"test_id":i,"impact":impact,"cost":cost,**kw}
def test_high_risk_first():assert Selector.select([item("low",1),item("high",5)],max_tests=1)["selected"][0]["test_id"]=="high"
def test_mandatory_first():assert Selector.select([item("low",0,mandatory=True),item("high",5)],max_tests=1)["selected"][0]["test_id"]=="low"
def test_cost_ceiling():
    result=Selector.select([item("a",5,3),item("b",4,1)],max_tests=2,max_cost=1)
    assert [x["test_id"] for x in result["selected"]]==["b"]
def test_exclusion_reason_visible():assert Selector.select([item("a",5),item("b",4)],max_tests=1)["excluded"][0]["reason"]=="TEST_LIMIT"
def test_prior_failure_weight():
    result=Selector.select([{"test_id":"a","prior_failures":5},{"test_id":"b","impact":2}],max_tests=1)
    assert result["selected"][0]["test_id"]=="a"
def test_custom_weights():
    result=Selector.select([{"test_id":"a","impact":5},{"test_id":"b","likelihood":5}],max_tests=1,weights={"impact":0,"likelihood":10})
    assert result["selected"][0]["test_id"]=="b"
def test_duplicate_refused():raises(MODULE.RiskSelectionError,lambda:Selector.select([item("x",1),item("x",2)],max_tests=1))
def test_bad_dimension_refused():raises(MODULE.RiskSelectionError,lambda:Selector.select([item("x",6)],max_tests=1))
def test_mandatory_overflow_refused():raises(MODULE.RiskSelectionError,lambda:Selector.select([item("a",1,mandatory=True),item("b",1,mandatory=True)],max_tests=1))
def test_boundary_truth():
    result=Selector.select([item("a",1)],max_tests=1);assert result["tests_executed"] is False and result["selection_is_not_approval"] and result["authority"]=="NONE" and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} risk-based-test-selector tests")

if __name__ == "__main__":
    run()
