from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "change_impact_regression_selector.py"
SPEC = importlib.util.spec_from_file_location("change_impact_regression_selector", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Selector=MODULE.ChangeImpactRegressionSelector()
EDGES=[{"source":"a","target":"b"},{"source":"b","target":"c"}]
TESTS=[{"test_id":"tb","covers":["b"]},{"test_id":"tc","covers":["c"]}]
def test_direct_and_transitive():assert [x["node"] for x in Selector.select(["a"],EDGES,TESTS)["impacted"]]==["a","b","c"]
def test_tests_selected():assert {x["test_id"] for x in Selector.select(["a"],EDGES,TESTS)["selected_tests"]}=={"tb","tc"}
def test_depth_bound():assert [x["node"] for x in Selector.select(["a"],EDGES,TESTS,max_depth=1)["impacted"]]==["a","b"]
def test_cycle_safe():assert len(Selector.select(["a"],EDGES+[{"source":"c","target":"a"}],TESTS)["impacted"])==3
def test_uncovered_visible():assert "a" in Selector.select(["a"],EDGES,TESTS)["uncovered_impacted"]
def test_node_ceiling_truncates():assert Selector.select(["a"],EDGES,TESTS,max_nodes=1)["truncated"]
def test_duplicate_test_refused():raises(MODULE.ChangeImpactError,lambda:Selector.select(["a"],EDGES,[TESTS[0],TESTS[0]]))
def test_bad_edge_refused():raises(MODULE.ChangeImpactError,lambda:Selector.select(["a"],[{"source":"a"}],TESTS))
def test_empty_changed_refused():raises(MODULE.ChangeImpactError,lambda:Selector.select([],EDGES,TESTS))
def test_boundary_truth():
    result=Selector.select(["a"],EDGES,TESTS);assert result["tests_executed"] is False and result["graph_is_caller_supplied"] and result["authority"]=="NONE" and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} change-impact-regression-selector tests")

if __name__ == "__main__":
    run()
