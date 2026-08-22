from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'baseline_reference_comparator.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.baseline_reference_comparator', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

C=MODULE.BaselineReferenceComparator()
def r(name,vals,version="1"):return {"name":name,"version":version,"configuration":{"mode":"x"},"samples":vals}
def test_higher_better_positive():assert C.compare(r("c",[3,4]),r("b",[1,2]),"HIGHER_BETTER")["verdict_state"]=="PASS"
def test_lower_better_positive():assert C.compare(r("c",[1]),r("b",[2]),"LOWER_BETTER")["signed_improvement"]==1
def test_negative_fails():assert C.compare(r("c",[1]),r("b",[2]),"HIGHER_BETTER")["verdict_state"]=="FAIL"
def test_negligible_unknown():assert C.compare(r("c",[2.05]),r("b",[2]),"HIGHER_BETTER",0.1)["verdict_state"]=="UNKNOWN"
def test_zero_baseline_relative_unknown():assert C.compare(r("c",[1]),r("b",[0]),"HIGHER_BETTER")["relative_difference"] is None
def test_range_overlap_retained():assert C.compare(r("c",[1,3]),r("b",[2,4]),"HIGHER_BETTER")["ranges_overlap"] is True
def test_invalid_direction_refused():raises(MODULE.BaselineComparisonError,lambda:C.compare(r("c",[1]),r("b",[1]),"UP"))
def test_nan_refused():raises(MODULE.BaselineComparisonError,lambda:C.compare(r("c",[float("nan")]),r("b",[1]),"HIGHER_BETTER"))
def test_identity_required():raises(MODULE.BaselineComparisonError,lambda:C.compare({"name":"","version":"1","samples":[1]},r("b",[1]),"HIGHER_BETTER"))
def test_no_universal_superiority():assert C.compare(r("c",[3]),r("b",[1]),"HIGHER_BETTER")["universal_superiority"] is False

def run():
    tests=[value for name,value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:test()
    print(f"PASS {len(tests)} baseline-reference-comparator tests")
if __name__=="__main__":run()
