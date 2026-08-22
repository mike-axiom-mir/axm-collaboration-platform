from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "structural_coverage_collector.py"
SPEC = importlib.util.spec_from_file_location("structural_coverage_collector", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Collector=MODULE.StructuralCoverageCollector()
def test_full_coverage_passes(): assert Collector.collect({"line":{"declared":[1,2],"exercised":[1,2],"threshold":1}})["verdict_state"]=="PASS"
def test_below_threshold_fails(): assert Collector.collect({"branch":{"declared":["a","b"],"exercised":["a"],"threshold":1}})["verdict_state"]=="FAIL"
def test_empty_declared_unknown(): assert Collector.collect({"state":{"declared":[],"exercised":[]}})["verdict_state"]=="UNKNOWN"
def test_unknown_exercised_retained(): assert Collector.collect({"line":{"declared":[1],"exercised":[1,2]}})["coverage"]["line"]["unknown_exercised"]==["2"]
def test_kinds_stay_separate():
    result=Collector.collect({"line":{"declared":[1],"exercised":[1]},"branch":{"declared":["a"],"exercised":[]}})
    assert result["coverage"]["line"]["ratio"]==1 and result["coverage"]["branch"]["ratio"]==0
def test_default_threshold_applies(): assert Collector.collect({"function":{"declared":["f"],"exercised":[]}},default_threshold=.5)["verdict_state"]=="FAIL"
def test_invalid_kind_refused(): raises(MODULE.StructuralCoverageError,lambda:Collector.collect({"magic":{"declared":[],"exercised":[]}}))
def test_string_identifiers_refused(): raises(MODULE.StructuralCoverageError,lambda:Collector.collect({"line":{"declared":"abc","exercised":[]}}))
def test_invalid_threshold_refused(): raises(MODULE.StructuralCoverageError,lambda:Collector.collect({"line":{"declared":[],"exercised":[],"threshold":2}}))
def test_boundary_truth():
    result=Collector.collect({"condition":{"declared":["c"],"exercised":["c"]}})
    assert result["coverage_is_not_correctness"] and result["authority"]=="NONE" and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} structural-coverage-collector tests")

if __name__ == "__main__":
    run()
