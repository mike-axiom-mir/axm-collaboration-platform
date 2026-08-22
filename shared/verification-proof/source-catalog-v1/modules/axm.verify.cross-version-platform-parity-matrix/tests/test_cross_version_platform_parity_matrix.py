from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "cross_version_platform_parity_matrix.py"
SPEC = importlib.util.spec_from_file_location("cross_version_platform_parity_matrix", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Matrix=MODULE.CrossVersionPlatformParityMatrix();PRO=[{"profile_id":"p1","os":"windows"},{"profile_id":"p2","os":"linux"}];BEH=["save"]
def obs(p,status="PASS",out=1,**kw):return {"profile_id":p,"behavior_id":"save","status":status,"output":out,**kw}
def test_equal_passes():assert Matrix.compare(PRO,BEH,[obs("p1"),obs("p2")])["verdict_state"]=="PASS"
def test_divergence_fails():assert Matrix.compare(PRO,BEH,[obs("p1",out=1),obs("p2",out=2)])["verdict_state"]=="FAIL"
def test_explicit_failure_fails():assert Matrix.compare(PRO,BEH,[obs("p1"),obs("p2",status="FAIL")])["verdict_state"]=="FAIL"
def test_missing_unknown():assert Matrix.compare(PRO,BEH,[obs("p1")])["verdict_state"]=="UNKNOWN"
def test_error_unknown():assert Matrix.compare(PRO,BEH,[obs("p1"),obs("p2",status="ERROR")])["verdict_state"]=="UNKNOWN"
def test_equivalence_key_allows_normalized_parity():
    result=Matrix.compare(PRO,BEH,[obs("p1",out={"path":"a"},equivalence_key="ok"),obs("p2",out={"path":"b"},equivalence_key="ok")]);assert result["verdict_state"]=="PASS"
def test_duplicate_profile_refused():raises(MODULE.ParityMatrixError,lambda:Matrix.compare(PRO+PRO[:1],BEH,[]))
def test_duplicate_observation_refused():raises(MODULE.ParityMatrixError,lambda:Matrix.compare(PRO,BEH,[obs("p1"),obs("p1")]))
def test_unknown_profile_refused():raises(MODULE.ParityMatrixError,lambda:Matrix.compare(PRO,BEH,[obs("other")]))
def test_boundary_truth():
    result=Matrix.compare(PRO,BEH,[obs("p1"),obs("p2")]);assert result["observations_are_caller_supplied"] and result["parity_is_not_general_correctness"] and result["authority"]=="NONE" and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} cross-version-platform-parity-matrix tests")

if __name__ == "__main__":
    run()
