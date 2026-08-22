from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "combinatorial_interaction_matrix.py"
SPEC = importlib.util.spec_from_file_location("combinatorial_interaction_matrix", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Gen=MODULE.CombinatorialInteractionMatrixGenerator();FACT={"os":["win","linux"],"role":["human","ai"],"mode":["on","off"]}
def test_pairwise_complete():assert Gen.generate(FACT,strength=2,max_cases=10)["complete"]
def test_reduces_vs_product():assert Gen.generate(FACT,strength=2,max_cases=10)["case_count"]<8
def test_deterministic():assert Gen.generate(FACT)==Gen.generate(FACT)
def test_limit_exposes_uncovered():
    result=Gen.generate(FACT,max_cases=1);assert not result["complete"] and result["uncovered_interactions"]
def test_full_strength():assert Gen.generate({"a":[1,2],"b":[1,2]},strength=2,max_cases=4)["case_count"]==4
def test_duplicate_values_refused():raises(MODULE.InteractionMatrixError,lambda:Gen.generate({"a":[1,1],"b":[1,2]}))
def test_too_few_factors_refused():raises(MODULE.InteractionMatrixError,lambda:Gen.generate({"a":[1]}))
def test_bad_strength_refused():raises(MODULE.InteractionMatrixError,lambda:Gen.generate(FACT,strength=4))
def test_product_ceiling_refused():raises(MODULE.InteractionMatrixError,lambda:Gen.generate(FACT,product_ceiling=2))
def test_boundary_truth():
    result=Gen.generate(FACT);assert result["brute_force_output"] is False and result["target_executed"] is False and result["authority"]=="NONE" and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} combinatorial-interaction-matrix tests")

if __name__ == "__main__":
    run()
