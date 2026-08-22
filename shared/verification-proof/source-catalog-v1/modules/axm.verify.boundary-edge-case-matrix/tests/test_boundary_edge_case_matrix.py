from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "boundary_edge_case_matrix.py"
SPEC = importlib.util.spec_from_file_location("boundary_edge_case_matrix", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Gen=MODULE.BoundaryEdgeCaseMatrixGenerator()
def kinds(spec):return {x["case_kind"] for x in Gen.generate({"x":spec})["cases"]}
def test_integer_boundaries():assert {"minimum","maximum","zero","below_minimum","overflow"}<=kinds({"type":"integer","minimum":-1,"maximum":1})
def test_string_boundaries():assert {"empty","truncation","corruption"}<=kinds({"type":"string","min_length":1,"max_length":3})
def test_sequence_cases():assert {"duplication","invalid_order","overflow"}<=kinds({"type":"sequence","min_items":1,"max_items":2})
def test_boolean_cases():assert kinds({"type":"boolean"})=={"false","true"}
def test_nullable_case():assert "null" in kinds({"type":"boolean","nullable":True})
def test_optional_missing_case():
    result=Gen.generate({"x":{"type":"boolean","required":False}});missing=[x for x in result["cases"] if x["case_kind"]=="missing"][0];assert missing["present"] is False
def test_case_ceiling():assert Gen.generate({"x":{"type":"string","min_length":0,"max_length":5}},max_cases=2)["generated_case_count"]==2
def test_bad_numeric_range_refused():raises(MODULE.BoundaryMatrixError,lambda:Gen.generate({"x":{"type":"integer","minimum":2,"maximum":1}}))
def test_unknown_type_refused():raises(MODULE.BoundaryMatrixError,lambda:Gen.generate({"x":{"type":"magic"}}))
def test_boundary_truth():
    result=Gen.generate({"x":{"type":"boolean"}});assert result["target_executed"] is False and result["generated_cases_require_domain_review"] and result["authority"]=="NONE" and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} boundary-edge-case-matrix tests")

if __name__ == "__main__":
    run()
