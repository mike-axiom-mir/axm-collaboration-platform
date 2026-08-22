from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'reproducible_build_verifier.py'
SPEC = importlib.util.spec_from_file_location('reproducible_build_verifier', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Verifier=MODULE.ReproducibleBuildVerifier();A={"build_id":"a","status":"PASS","source_digest":"s","environment_digest":"e","instructions_digest":"i","outputs":{"app":"o","map":"m"}};B={**A,"build_id":"b"}
def test_equal_builds_pass():assert Verifier.verify([A,B])["verdict_state"]=="PASS"
def test_output_mismatch_fails():assert Verifier.verify([A,{**B,"outputs":{"app":"x","map":"m"}}])["verdict_state"]=="FAIL"
def test_source_mismatch_fails():assert Verifier.verify([A,{**B,"source_digest":"x"}])["verdict_state"]=="FAIL"
def test_environment_mismatch_fails():assert Verifier.verify([A,{**B,"environment_digest":"x"}])["verdict_state"]=="FAIL"
def test_instruction_mismatch_fails():assert Verifier.verify([A,{**B,"instructions_digest":"x"}])["verdict_state"]=="FAIL"
def test_missing_output_fails():assert Verifier.verify([A,{**B,"outputs":{"app":"o"}}],["map"])["verdict_state"]=="FAIL"
def test_not_run_unknown():assert Verifier.verify([A,{**B,"status":"NOT_RUN"}])["verdict_state"]=="UNKNOWN"
def test_failed_build_fails():assert Verifier.verify([A,{**B,"status":"FAIL"}])["verdict_state"]=="FAIL"
def test_duplicate_build_refused():raises(MODULE.ReproducibleBuildError,lambda:Verifier.verify([A,A]))
def test_boundary_truth():
    result=Verifier.verify([A,B]);assert result["builds_executed_by_module"] is False and result["functional_correctness_proven"] is False and result["safety_proven"] is False and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} reproducible-build-verifier tests")

if __name__ == "__main__":
    run()
